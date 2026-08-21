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
  /// Upper bound for a single RPC request. Kept as a field so tests can inject
  /// a short value; a hung endpoint can no longer wedge a blocking await.
  request_timeout: std::time::Duration,
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

    Self {
      rpc,
      network,
      request_timeout: std::time::Duration::from_secs(15),
    }
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
    use std::time::{Duration, Instant};

    let hash = parse_tx_hash(tx_hash)?;
    if confirm_count == 0 {
      return Ok(tx_hash.to_string());
    }

    // Poll until committed and `confirm_count` blocks have passed — mirrors
    // `TransactionSkeleton::send_and_wait`. Every RPC call is bounded by
    // `request_timeout` so a hung endpoint can't wedge the wait forever, and
    // the wall-clock `deadline` is the true upper bound on the whole wait.
    let deadline = timeout.map(|t| Instant::now() + t);
    let interval = Duration::from_secs(3);
    let mut committed_block: Option<u64> = None;

    loop {
      if deadline.is_some_and(|dl| Instant::now() >= dl) {
        return Err(CommandError::chain(format!(
          "timeout waiting for tx {tx_hash} to confirm after {}s",
          timeout.map_or(0, |t| t.as_secs()),
        )));
      }

      let tx =
        match tokio::time::timeout(self.request_timeout, self.rpc.get_transaction(&hash)).await {
          Ok(res) => res.map_err(Self::map_err)?,
          Err(_) => continue, // request hung — keep polling until the deadline
        };
      let Some(tx) = tx else {
        continue; // not visible to this node yet (lagging/restarted) — keep polling
      };
      if tx.tx_status.status == Status::Rejected {
        let reason = tx.tx_status.reason.unwrap_or_else(|| "unknown".to_string());
        return Err(CommandError::chain(format!(
          "tx {tx_hash} rejected: {reason}"
        )));
      }
      if tx.tx_status.status != Status::Committed {
        tokio::time::sleep(interval).await;
        continue;
      }
      // A committed observation may come without a block number (some nodes
      // report it transiently as null) — keep the first one we capture in an
      // `Option` instead of overloading `0` as a "not yet set" sentinel.
      if committed_block.is_none() {
        committed_block = tx.tx_status.block_number.map(|n| n.value());
      }
      if let Some(block) = committed_block {
        let tip =
          match tokio::time::timeout(self.request_timeout, self.get_tip_block_number()).await {
            Ok(Ok(tip)) => Some(tip),
            Ok(Err(e)) => return Err(e),
            Err(_) => None, // tip call hung — keep polling
          };
        if let Some(tip) = tip {
          if tip >= block + confirm_count as u64 {
            break;
          }
        }
      }
      tokio::time::sleep(interval).await;
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
  use std::io::{Read, Write};
  use std::net::TcpListener;
  use std::sync::atomic::{AtomicUsize, Ordering};
  use std::sync::Arc;
  use std::time::{Duration, Instant};

  const TEST_HASH: &str = "0x0000000000000000000000000000000000000000000000000000000000000000";

  fn provider(url: &str) -> RealChainProvider {
    RealChainProvider::new(url, url)
  }

  /// Wrap a JSON-RPC body in a canned HTTP response.
  fn http_response(body: &str) -> String {
    format!(
      "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
      body.len(),
      body
    )
  }

  /// Canned `get_transaction` result: committed in block `n` (or block_number null).
  fn committed_tx_json(block: Option<u64>) -> String {
    let block = block
      .map(|n| format!(r#""{:#x}""#, n))
      .unwrap_or_else(|| "null".to_string());
    format!(
      r#"{{"jsonrpc":"2.0","result":{{"transaction":null,"cycles":null,"time_added_to_pool":null,"tx_status":{{"status":"committed","block_number":{block},"block_hash":null,"tx_index":null,"reason":null}},"fee":null,"min_replace_fee":null}},"id":0}}"#,
      block = block
    )
  }

  fn tip_json(n: u64) -> String {
    format!(r#"{{"jsonrpc":"2.0","result":"{:#x}","id":0}}"#, n)
  }

  /// Spawn a canned JSON-RPC server on an ephemeral port; the responder is
  /// routed by request method and returns a JSON-RPC body.
  fn spawn_rpc_server(respond: impl Fn(&str) -> String + Send + 'static) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    std::thread::spawn(move || {
      for stream in listener.incoming() {
        let mut stream = match stream {
          Ok(s) => s,
          Err(_) => break,
        };
        let mut buf = [0u8; 8192];
        let n = match stream.read(&mut buf) {
          Ok(0) | Err(_) => break,
          Ok(n) => n,
        };
        let req = String::from_utf8_lossy(&buf[..n]).to_string();
        let method = req
          .split("\r\n\r\n")
          .nth(1)
          .and_then(|body| serde_json::from_str::<serde_json::Value>(body).ok())
          .and_then(|v| v["method"].as_str().map(str::to_string))
          .unwrap_or_default();
        let body = respond(&method);
        let resp = http_response(&body);
        let _ = stream.write_all(resp.as_bytes());
      }
    });
    format!("http://{addr}")
  }

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

  #[tokio::test]
  async fn wait_for_confirmation_resolves_when_committed_and_tip_advances() {
    let url = spawn_rpc_server(|method| {
      if method == "get_transaction" {
        committed_tx_json(Some(5))
      } else {
        tip_json(6)
      }
    });
    let res = provider(&url)
      .wait_for_confirmation(TEST_HASH, 1, Some(Duration::from_secs(30)))
      .await;
    assert_eq!(res.unwrap(), TEST_HASH);
  }

  #[tokio::test]
  async fn wait_for_confirmation_keeps_polling_until_committed() {
    // First observation is still pending; the loop must keep polling until the
    // tx becomes committed and the tip advances past its block.
    let calls = Arc::new(AtomicUsize::new(0));
    let counter = calls.clone();
    let url = spawn_rpc_server(move |method| {
      if method == "get_transaction" {
        if counter.fetch_add(1, Ordering::SeqCst) == 0 {
          r#"{"jsonrpc":"2.0","result":{"transaction":null,"cycles":null,"time_added_to_pool":null,"tx_status":{"status":"pending","block_number":null,"block_hash":null,"tx_index":null,"reason":null},"fee":null,"min_replace_fee":null},"id":0}"#.to_string()
        } else {
          committed_tx_json(Some(5))
        }
      } else {
        tip_json(6)
      }
    });
    let res = provider(&url)
      .wait_for_confirmation(TEST_HASH, 1, Some(Duration::from_secs(30)))
      .await;
    assert_eq!(res.unwrap(), TEST_HASH);
    assert!(calls.load(Ordering::SeqCst) >= 2);
  }

  #[tokio::test]
  async fn wait_for_confirmation_handles_missing_block_number_then_captures() {
    // A committed observation reported without a block_number used to wedge the
    // old `0`-sentinel logic forever; it must keep polling and confirm once a
    // later observation supplies one.
    let calls = Arc::new(AtomicUsize::new(0));
    let counter = calls.clone();
    let url = spawn_rpc_server(move |method| {
      if method == "get_transaction" {
        let n = counter.fetch_add(1, Ordering::SeqCst);
        committed_tx_json(if n == 0 { None } else { Some(5) })
      } else {
        tip_json(6)
      }
    });
    let res = provider(&url)
      .wait_for_confirmation(TEST_HASH, 1, Some(Duration::from_secs(30)))
      .await;
    assert_eq!(res.unwrap(), TEST_HASH);
    assert!(calls.load(Ordering::SeqCst) >= 2);
  }

  #[tokio::test]
  async fn wait_for_confirmation_bounds_a_hung_rpc() {
    // Endpoint accepts connections but never responds. The pre-fix code had no
    // per-request timeout, so this wedged the wait forever; now the deadline
    // must surface a timeout error instead.
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    std::thread::spawn(move || {
      // Hold each connection open without writing a response.
      for stream in listener.incoming() {
        let _ = stream;
        std::thread::sleep(Duration::from_secs(30));
      }
    });
    let mut provider = provider(&format!("http://{addr}"));
    provider.request_timeout = Duration::from_millis(100);

    let started = Instant::now();
    let res = provider
      .wait_for_confirmation(TEST_HASH, 1, Some(Duration::from_secs(1)))
      .await;
    let elapsed = started.elapsed();
    let err = res.expect_err("hung endpoint should time out");
    assert!(err.to_string().contains("timeout"), "err: {err}");
    assert!(elapsed < Duration::from_secs(5), "elapsed: {elapsed:?}");
  }
}
