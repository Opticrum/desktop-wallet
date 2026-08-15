//! Real chain provider — production implementation of `ChainProvider`.
//!
//! Wraps `ckb_cinnabar_calculator::rpc::RpcClient` to provide real CKB RPC
//! and indexer access.

use async_trait::async_trait;
use ckb_cinnabar_calculator::rpc::{RpcClient, RPC};

use crate::chain::chain_provider::{CellOutput, ChainProvider, TransactionInfo};
use crate::wire::{Chain, CommandError};

/// Production chain provider backed by a real CKB RPC node and indexer.
pub struct RealChainProvider {
  rpc: RpcClient,
  network: Chain,
}

impl RealChainProvider {
  /// Create a new real chain provider.
  ///
  /// `ckb_rpc_url` — CKB JSON-RPC endpoint (e.g. `http://localhost:8114`).
  /// `ckb_indexer_url` — CKB indexer endpoint (e.g. `http://localhost:8116`).
  ///
  /// The CKB network ("testnet" or "mainnet") is auto-detected from the
  /// RPC URL.
  pub fn new(ckb_rpc_url: &str, ckb_indexer_url: &str) -> Self {
    let rpc = RpcClient::new(ckb_rpc_url, Some(ckb_indexer_url));
    let network = Self::detect_network(ckb_rpc_url);

    log::info!(
      "RealChainProvider: rpc={}, idx={}, network={}",
      ckb_rpc_url,
      ckb_indexer_url,
      network
    );

    Self { rpc, network }
  }

  /// Auto-detect the CKB network from the RPC URL.
  ///
  /// Heuristics (checked in order):
  /// - URL contains "testnet" or "aggron"         → testnet
  /// - Port is 28114 (standard CKB testnet port)  → testnet
  /// - URL contains "mainnet" or "lina"           → mainnet
  /// - Falls back to "testnet" (conservative default — port 8114 is
  ///   used by both mainnet and custom testnet setups)
  fn detect_network(rpc_url: &str) -> Chain {
    let lower = rpc_url.to_lowercase();

    // Explicit testnet indicators
    if lower.contains("testnet") || lower.contains("aggron") || lower.contains(":28114") {
      return Chain::Testnet;
    }

    // Explicit mainnet indicators
    if lower.contains("mainnet") || lower.contains("lina") {
      return Chain::Mainnet;
    }

    // Ambiguous — default to testnet for safety. Common case: localhost:8114
    // which could be either. Users with mainnet nodes should use a URL
    // containing "mainnet" (e.g. http://ckb-mainnet.local:8114).
    log::info!(
      "Network not obvious from RPC URL '{}' — defaulting to testnet. \
             Add 'mainnet' or 'testnet' to the URL host to disambiguate.",
      rpc_url
    );
    Chain::Testnet
  }

  /// Get a reference to the underlying CKB RPC client.
  pub fn rpc_client(&self) -> &RpcClient {
    &self.rpc
  }

  /// The configured CKB network ("testnet" or "mainnet").
  pub fn network(&self) -> Chain {
    self.network
  }

  fn map_err(e: impl std::fmt::Display) -> CommandError {
    CommandError::chain(format!("Chain RPC error: {}", e))
  }
}

#[async_trait]
impl ChainProvider for RealChainProvider {
  fn network(&self) -> Chain {
    self.network
  }

  async fn get_tip_block_number(&self) -> Result<u64, CommandError> {
    self
      .rpc
      .get_tip_block_number()
      .await
      .map(u64::from)
      .map_err(Self::map_err)
  }

  async fn send_transaction(&self, tx_hex: &str) -> Result<String, CommandError> {
    use ckb_cinnabar_calculator::re_exports::ckb_jsonrpc_types::{OutputsValidator, Transaction};

    let bytes =
      hex::decode(tx_hex).map_err(|e| CommandError::chain(format!("decode tx_hex: {e}")))?;
    let tx: Transaction = serde_json::from_slice(&bytes)
      .map_err(|e| CommandError::chain(format!("parse tx from hex: {e}")))?;
    let hash = self
      .rpc
      .send_transaction(tx, Some(OutputsValidator::Passthrough))
      .await
      .map_err(Self::map_err)?;
    Ok(format!("0x{}", hex::encode(hash.as_bytes())))
  }

  async fn wait_for_confirmation(
    &self,
    tx_hash: &str,
    confirm_count: u8,
    timeout: Option<std::time::Duration>,
  ) -> Result<String, CommandError> {
    use ckb_cinnabar_calculator::re_exports::ckb_jsonrpc_types::Status;

    let hash = parse_tx_hash(tx_hash)?;
    if confirm_count == 0 {
      return Ok(tx_hash.to_string());
    }

    // Poll every 3s until committed and `confirm_count` blocks have passed —
    // mirrors `TransactionSkeleton::send_and_wait`.
    let mut block_number = 0u64;
    let mut time_used = std::time::Duration::from_secs(0);
    let interval = std::time::Duration::from_secs(3);
    loop {
      if let Some(t) = timeout {
        if time_used > t {
          return Err(CommandError::chain(format!(
            "timeout waiting for tx {tx_hash} to confirm"
          )));
        }
        time_used += interval;
      }
      tokio::time::sleep(interval).await;

      let tx = self
        .rpc
        .get_transaction(&hash)
        .await
        .map_err(Self::map_err)?;
      let Some(tx) = tx else {
        return Err(CommandError::chain(format!("tx {tx_hash} not found")));
      };
      if tx.tx_status.status == Status::Rejected {
        let reason = tx.tx_status.reason.unwrap_or_else(|| "unknown".to_string());
        return Err(CommandError::chain(format!("tx {tx_hash} rejected: {reason}")));
      }
      if tx.tx_status.status != Status::Committed {
        continue;
      }
      if block_number == 0 {
        if let Some(n) = tx.tx_status.block_number {
          block_number = n.value();
        }
      } else {
        let tip = self.get_tip_block_number().await?;
        if tip >= block_number + confirm_count as u64 {
          break;
        }
      }
    }
    Ok(tx_hash.to_string())
  }

  async fn get_cells_by_lock_arg(
    &self,
    lock_arg: &[u8; 20],
  ) -> Result<Vec<CellOutput>, CommandError> {
    use crate::wallet::address::{script_lock_hash, secp256k1_blake160_lock_script};
    use ckb_cinnabar_calculator::indexer::{ScriptType, SearchKey};
    use ckb_cinnabar_calculator::re_exports::ckb_jsonrpc_types::JsonBytes;
    use ckb_cinnabar_calculator::rpc::RPC;

    let script: ckb_cinnabar_calculator::re_exports::ckb_jsonrpc_types::Script =
      serde_json::from_value(secp256k1_blake160_lock_script(lock_arg))
        .map_err(|e| CommandError::chain(format!("Build lock script for indexer: {e}")))?;

    let search_key = SearchKey {
      script,
      script_type: ScriptType::Lock,
      script_search_mode: None,
      filter: None,
      with_data: None,
      group_by_transaction: None,
    };

    let lock_hash = script_lock_hash(lock_arg);
    let mut cells = Vec::new();
    let mut cursor: Option<JsonBytes> = None;

    loop {
      let page = self
        .rpc
        .get_cells(search_key.clone(), 1000, cursor.clone())
        .await
        .map_err(Self::map_err)?;

      if page.objects.is_empty() {
        break;
      }

      for cell in page.objects {
        let capacity = cell.output.capacity.value();
        cells.push(CellOutput {
          capacity,
          lock_hash,
          type_hash: None,
          data: vec![],
        });
      }

      let next = page.last_cursor;
      if next.as_bytes().is_empty() || Some(next.clone()) == cursor {
        break;
      }
      cursor = Some(next);
    }

    log::debug!(
      "Indexer cells fetched: lock_arg={}, count={}, total={}",
      hex::encode(lock_arg),
      cells.len(),
      cells.iter().map(|c| c.capacity).sum::<u64>(),
    );

    Ok(cells)
  }

  async fn get_cells_by_lock(&self, lock_hash: &[u8; 32]) -> Result<Vec<CellOutput>, CommandError> {
    // Without lock args we cannot query the indexer efficiently; callers should
    // prefer get_cells_by_lock_arg / get_balance_by_address.
    log::debug!(
      "get_cells_by_lock called without lock args — returning empty (lock_hash={})",
      hex::encode(lock_hash)
    );
    Ok(Vec::new())
  }

  async fn get_block_timestamp(&self, block_number: u64) -> Result<u64, CommandError> {
    use ckb_cinnabar_calculator::rpc::RPC;
    let number: ckb_cinnabar_calculator::re_exports::ckb_jsonrpc_types::Uint64 =
      block_number.into();
    match self.rpc.get_block_by_number(number).await {
      Ok(Some(block)) => Ok(block.header.inner.timestamp.value()),
      _ => Ok(0),
    }
  }

  async fn get_transaction(&self, tx_hash: &str) -> Result<TransactionInfo, CommandError> {
    use crate::chain::chain_provider::{TxInputInfo, TxOutputInfo};
    use ckb_cinnabar_calculator::re_exports::ckb_jsonrpc_types::Either;
    use ckb_cinnabar_calculator::rpc::RPC;

    let hash = parse_tx_hash(tx_hash)?;
    match self
      .rpc
      .get_transaction(&hash)
      .await
      .map_err(Self::map_err)?
    {
      Some(tx) => {
        let block = tx.tx_status.block_number.unwrap_or_default();

        // Extract structured I/O from the transaction view
        let (inputs, outputs) = tx
          .transaction
          .as_ref()
          .and_then(|rf| match &rf.inner {
            Either::Left(txv) => Some(&txv.inner),
            Either::Right(_) => None,
          })
          .map(|inner| {
            let inputs: Vec<TxInputInfo> = inner
              .inputs
              .iter()
              .map(|input| TxInputInfo {
                previous_tx_hash: hex::encode(input.previous_output.tx_hash.as_bytes()),
                previous_index: input.previous_output.index.value(),
              })
              .collect();

            let outputs: Vec<TxOutputInfo> = inner
              .outputs
              .iter()
              .enumerate()
              .map(|(i, output)| {
                let data = inner
                  .outputs_data
                  .get(i)
                  .map(|d| hex::encode(d.as_bytes()))
                  .unwrap_or_default();
                let args_bytes = output.lock.args.as_bytes();
                TxOutputInfo {
                  capacity: output.capacity.value(),
                  lock_code_hash: hex::encode(output.lock.code_hash.as_bytes()),
                  lock_hash_type: format!("{:?}", output.lock.hash_type),
                  lock_args_hex: hex::encode(args_bytes),
                  lock_args_len: args_bytes.len(),
                  data_hex: data,
                }
              })
              .collect();

            (inputs, outputs)
          })
          .unwrap_or_default();

        Ok(TransactionInfo {
          tx_hash: tx_hash.to_string(),
          block_number: block.value(),
          inputs,
          outputs,
        })
      }
      None => Err(CommandError::invalid_input(format!(
        "Transaction {tx_hash} not found"
      ))),
    }
  }
}

/// Parse a tx-hash string into an `H256`.
///
/// Accepts both the `0x`-prefixed form returned by `send_transaction` and the
/// bare 64-hex form the extraction path feeds in; `H256::from_str` itself wants
/// exactly 64 bare chars and rejects the prefix.
fn parse_tx_hash(
  s: &str,
) -> Result<ckb_cinnabar_calculator::re_exports::ckb_types::H256, CommandError> {
  s.strip_prefix("0x")
    .unwrap_or(s)
    .parse()
    .map_err(|_| CommandError::chain("invalid tx hash"))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parse_tx_hash_accepts_bare_and_prefixed() {
    let bare = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    assert!(parse_tx_hash(bare).is_ok());
    assert!(parse_tx_hash(&format!("0x{bare}")).is_ok());
  }

  #[test]
  fn parse_tx_hash_rejects_malformed() {
    assert!(parse_tx_hash("not-a-hash").is_err());
    assert!(parse_tx_hash("0xshort").is_err());
  }
}
