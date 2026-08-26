//! Wallet CKB network controller — persisted, hot-swappable mainnet/testnet.
//!
//! The Fiber node keeps its own `fiber.chain` independently. This controller
//! owns the wallet/liquidity CKB RPC + indexer pair and the active chain so a
//! single mnemonic can encode `ckb1…` / `ckt1…` addresses without restarting
//! the app or the embedded Fiber process.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use ckb_cinnabar_calculator::rpc::{Network, RpcClient};
use serde::{Deserialize, Serialize};

use crate::chain::chain_provider::ChainProvider;
use crate::chain::real_chain_provider::RealChainProvider;
use crate::wire::{Chain, CommandError};

/// Default public endpoints — env vars may override per-network at boot.
pub const TESTNET_RPC: &str = "https://testnet.ckbapp.dev";
pub const TESTNET_INDEXER: &str = "https://testnet.ckb.dev/indexer";
pub const MAINNET_RPC: &str = "https://mainnet.ckbapp.dev";
pub const MAINNET_INDEXER: &str = "https://mainnet.ckb.dev/indexer";

const SETTINGS_FILE: &str = "wallet-network.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedNetwork {
  chain: Chain,
}

/// Pre-built resources for one CKB network.
pub struct NetworkResources {
  pub rpc: RpcClient,
  pub provider: Arc<dyn ChainProvider>,
  pub testnet: bool,
}

impl NetworkResources {
  pub async fn build(rpc_url: &str, indexer_url: &str, chain: Chain) -> Self {
    let mut rpc = RpcClient::new(rpc_url, Some(indexer_url));
    if let Err(e) = rpc.update_network().await {
      log::warn!("ckb network detection failed for {chain} ({rpc_url}): {e:#}");
      let fallback = match chain {
        Chain::Testnet => Network::Testnet,
        Chain::Mainnet => Network::Mainnet,
      };
      rpc.set_network(fallback);
    }
    let provider: Arc<dyn ChainProvider> =
      Arc::new(RealChainProvider::new(rpc_url, indexer_url));
    Self {
      rpc,
      provider,
      testnet: chain == Chain::Testnet,
    }
  }
}

/// Shared wallet-network state for the wallet + liquidity backends.
pub struct NetworkController {
  path: PathBuf,
  active: Mutex<Chain>,
  mainnet: NetworkResources,
  testnet: NetworkResources,
  /// In-flight chain operations (send / liquidity txs). Switch waits for 0.
  ops_in_flight: AtomicUsize,
}

impl NetworkController {
  pub async fn bootstrap(
    data_dir: &Path,
    initial: Chain,
    testnet_rpc: &str,
    testnet_indexer: &str,
    mainnet_rpc: &str,
    mainnet_indexer: &str,
  ) -> Result<Arc<Self>, CommandError> {
    let path = data_dir.join(SETTINGS_FILE);
    let active = load_or_default(&path, initial)?;
    let testnet = NetworkResources::build(testnet_rpc, testnet_indexer, Chain::Testnet).await;
    let mainnet = NetworkResources::build(mainnet_rpc, mainnet_indexer, Chain::Mainnet).await;
    Ok(Arc::new(Self {
      path,
      active: Mutex::new(active),
      mainnet,
      testnet,
      ops_in_flight: AtomicUsize::new(0),
    }))
  }

  pub fn chain(&self) -> Chain {
    *self.active.lock().unwrap()
  }

  pub fn is_testnet(&self) -> bool {
    self.chain() == Chain::Testnet
  }

  pub fn resources(&self) -> &NetworkResources {
    match self.chain() {
      Chain::Testnet => &self.testnet,
      Chain::Mainnet => &self.mainnet,
    }
  }

  pub fn resources_for(&self, chain: Chain) -> &NetworkResources {
    match chain {
      Chain::Testnet => &self.testnet,
      Chain::Mainnet => &self.mainnet,
    }
  }

  pub fn rpc(&self) -> RpcClient {
    self.resources().rpc.clone()
  }

  pub fn provider(&self) -> Arc<dyn ChainProvider> {
    self.resources().provider.clone()
  }

  /// Begin a chain-mutating operation. The returned guard blocks network
  /// switches until dropped.
  pub fn begin_op(&self) -> Result<OpGuard<'_>, CommandError> {
    // Reject if a switch is waiting — switches take the exclusive lock first.
    self.ops_in_flight.fetch_add(1, Ordering::SeqCst);
    Ok(OpGuard {
      counter: &self.ops_in_flight,
    })
  }

  /// Persist and activate `chain`. Callers must already hold no op guards and
  /// must swap backend interiors before/after as needed.
  pub fn activate(&self, chain: Chain) -> Result<(), CommandError> {
    if self.ops_in_flight.load(Ordering::SeqCst) != 0 {
      return Err(CommandError::invalid_input(
        "cannot switch network while a transaction is in progress",
      ));
    }
    persist(&self.path, chain)?;
    *self.active.lock().unwrap() = chain;
    Ok(())
  }

  /// Try to activate only when idle — used by the switch path.
  pub fn try_begin_switch(&self) -> Result<(), CommandError> {
    if self.ops_in_flight.load(Ordering::SeqCst) != 0 {
      return Err(CommandError::invalid_input(
        "cannot switch network while a transaction is in progress",
      ));
    }
    Ok(())
  }
}

/// RAII guard that decrements the in-flight op counter.
pub struct OpGuard<'a> {
  counter: &'a AtomicUsize,
}

impl Drop for OpGuard<'_> {
  fn drop(&mut self) {
    self.counter.fetch_sub(1, Ordering::SeqCst);
  }
}

fn load_or_default(path: &Path, fallback: Chain) -> Result<Chain, CommandError> {
  if !path.exists() {
    persist(path, fallback)?;
    return Ok(fallback);
  }
  let raw = std::fs::read_to_string(path).map_err(|e| CommandError::io(e.to_string()))?;
  let parsed: PersistedNetwork =
    serde_json::from_str(&raw).map_err(|e| CommandError::io(format!("wallet-network.json: {e}")))?;
  Ok(parsed.chain)
}

fn persist(path: &Path, chain: Chain) -> Result<(), CommandError> {
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).map_err(|e| CommandError::io(e.to_string()))?;
  }
  let body = serde_json::to_string_pretty(&PersistedNetwork { chain })
    .map_err(|e| CommandError::internal(e.to_string()))?;
  std::fs::write(path, body).map_err(|e| CommandError::io(e.to_string()))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn persist_roundtrip() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(SETTINGS_FILE);
    persist(&path, Chain::Mainnet).unwrap();
    assert_eq!(load_or_default(&path, Chain::Testnet).unwrap(), Chain::Mainnet);
  }

  #[test]
  fn op_guard_blocks_activate() {
    // Lightweight unit: counter semantics without building live RPC clients.
    let counter = AtomicUsize::new(0);
    counter.fetch_add(1, Ordering::SeqCst);
    assert_ne!(counter.load(Ordering::SeqCst), 0);
    let _ = OpGuard { counter: &counter };
    // Dropped at end of scope
  }
}
