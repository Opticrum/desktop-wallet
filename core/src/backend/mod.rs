//! Backend bundle — composes the four domain backends behind one handle.
//!
//! The shell holds an `Arc<BackendBundle>` and dispatches each IPC command to
//! the matching domain. The runtime mock layer was removed; every domain is
//! served by the real backend.

pub mod network;
pub mod real;
pub mod real_liquidity;
pub mod traits;

use std::sync::{Arc, Mutex};

use crate::wire::{Chain, CommandError, TxProgress};

pub use traits::{ChannelsBackend, LiquidityBackend, NodeBackend, WalletBackend};

/// Connection/paths for the real backend.
#[derive(Debug, Clone)]
pub struct BackendConfig {
  pub database_url: String,
  pub keystore_path: String,
  pub node_config_path: String,
  pub data_dir: String,
  pub testnet_rpc_url: String,
  pub testnet_indexer_url: String,
  pub mainnet_rpc_url: String,
  pub mainnet_indexer_url: String,
  pub fee_rate: u64,
  /// Initial fallback before `wallet-network.json` is loaded.
  pub network: Chain,
}

impl Default for BackendConfig {
  fn default() -> Self {
    Self {
      database_url: "data/opticrum.db".to_string(),
      keystore_path: "data/keystore.json".to_string(),
      node_config_path: "data/node-config.json".to_string(),
      data_dir: "data".to_string(),
      testnet_rpc_url: network::TESTNET_RPC.to_string(),
      testnet_indexer_url: network::TESTNET_INDEXER.to_string(),
      mainnet_rpc_url: network::MAINNET_RPC.to_string(),
      mainnet_indexer_url: network::MAINNET_INDEXER.to_string(),
      fee_rate: 1000,
      network: Chain::Testnet,
    }
  }
}

/// Receives transaction lifecycle progress (broadcasting → confirming) for the
/// frontend's transaction-confirmation modal. The Tauri command layer implements
/// this over a per-invocation `tauri::ipc::Channel`; tests and mock callers use
/// the no-op default. Kept Tauri-free so the core stays a pure library.
pub trait TxProgressReporter: Send + Sync {
  fn report(&self, progress: TxProgress);
}

/// No-op progress reporter — for callers with no UI to feed.
#[derive(Debug, Default)]
pub struct NoopTxProgressReporter;

impl TxProgressReporter for NoopTxProgressReporter {
  fn report(&self, _progress: TxProgress) {}
}

/// Internal seam — the wallet's signing identity, shared with the liquidity
/// backend so order/match operations can sign buyer/seller transactions.
pub trait SigningWallet: Send + Sync {
  fn is_unlocked(&self) -> bool;
  /// `(CKB address, secp256k1 secret key)` of the wallet's first HD child —
  /// the identity used to sign liquidity transactions.
  fn signing_identity(
    &self,
  ) -> Option<(
    String,
    ckb_cinnabar_calculator::re_exports::secp256k1::SecretKey,
  )>;
}

/// The four domain backends the shell dispatches to.
pub struct BackendBundle {
  pub wallet: Arc<dyn WalletBackend>,
  pub node: Arc<dyn NodeBackend>,
  pub channels: Arc<dyn ChannelsBackend>,
  pub liquidity: Arc<dyn LiquidityBackend>,
}

impl BackendBundle {
  /// Compose the four real domain backends.
  pub async fn real(cfg: BackendConfig) -> Result<Self, CommandError> {
    use crate::db;
    use network::NetworkController;

    let data_dir = std::path::Path::new(&cfg.data_dir);
    std::fs::create_dir_all(data_dir).map_err(|e| CommandError::io(e.to_string()))?;

    let network = NetworkController::bootstrap(
      data_dir,
      cfg.network,
      &cfg.testnet_rpc_url,
      &cfg.testnet_indexer_url,
      &cfg.mainnet_rpc_url,
      &cfg.mainnet_indexer_url,
    )
    .await?;
    let resources = network.resources();
    let rpc = resources.rpc.clone();
    let provider = resources.provider.clone();
    let testnet = resources.testnet;
    let db = db::init_db(&cfg.database_url)?;

    // One live node config shared by the node backend (owns save) and the
    // wallet backend (reads fiber contract scripts for tx classification).
    let node_config = Arc::new(Mutex::new(crate::node::real_node::load_config(
      std::path::Path::new(&cfg.node_config_path),
    )));
    // The fiber node's identity pubkey, shared between the node backend (writes
    // it on start) and the liquidity backend (attributes new orders to it).
    let node_pubkey = Arc::new(Mutex::new(None::<String>));

    let wallet = Arc::new(crate::backend::real::RealWalletBackend::new_with_network(
      rpc.clone(),
      provider.clone(),
      db,
      std::path::PathBuf::from(&cfg.keystore_path),
      testnet,
      cfg.fee_rate,
      node_config.clone(),
      Some(network.clone()),
    ));
    let liquidity = Arc::new(
      crate::backend::real_liquidity::RealLiquidityBackend::new_with_network(
        rpc,
        provider,
        wallet.clone(),
        testnet,
        node_pubkey.clone(),
        // Separate connection for the personal-order cache (SQLite is cheap).
        Some(db::init_db(&cfg.database_url)?),
        Some(network),
      ),
    );

    // Node + channels share a hot-swappable Fiber RPC client so set_active
    // retargets every Fiber call without rebuilding the backends.
    use crate::node::fiber_api::{FiberNodeApi, FiberRpcApi};
    use crate::node::fiber_client::FiberClientHandle;
    use crate::node::rpc_client::RpcClient as FiberRpcClient;
    use crate::node::{real_channels::RealChannelsBackend, real_node::RealNodeBackend, targets};
    let fiber_url = {
      let cfg = node_config.lock().unwrap();
      cfg.rpc.listening_addr.clone()
    };
    let fiber_client = FiberRpcClient::new(&fiber_url, false, None).expect("valid fiber rpc url");
    let handle = FiberClientHandle::new(fiber_client);
    let fiber_api: Arc<dyn FiberNodeApi> = Arc::new(FiberRpcApi::new(handle.clone()));
    let node_config_path = std::path::PathBuf::from(&cfg.node_config_path);
    let node_base_dir = node_config_path
      .parent()
      .unwrap_or(std::path::Path::new("data"))
      .join("fiber-node");
    let targets_path = targets::targets_path_beside(&node_config_path);
    let node = Arc::new(RealNodeBackend::new(
      fiber_api,
      node_config_path,
      node_base_dir,
      wallet.clone(),
      node_config,
      node_pubkey,
      handle.clone(),
      targets_path,
    ));
    node.restore_active().await;
    let channels = Arc::new(RealChannelsBackend::new(Arc::new(
      crate::node::real_channels::RealFiberChannels::new(handle),
    )));

    Ok(BackendBundle {
      wallet,
      node,
      channels,
      liquidity,
    })
  }
}
