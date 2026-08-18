//! Backend bundle — composes the four domain backends behind one handle.
//!
//! The shell holds an `Arc<BackendBundle>` and dispatches each IPC command to
//! the matching domain. The runtime mock layer was removed; every domain is
//! served by the real backend.

pub mod real;
pub mod real_liquidity;
pub mod traits;

use std::sync::Arc;

use crate::wire::{Chain, CommandError};

pub use traits::{ChannelsBackend, LiquidityBackend, NodeBackend, WalletBackend};

/// Connection/paths for the real backend.
#[derive(Debug, Clone)]
pub struct BackendConfig {
  pub database_url: String,
  pub keystore_path: String,
  pub node_config_path: String,
  pub ckb_rpc_url: String,
  pub ckb_indexer_url: String,
  pub fee_rate: u64,
  pub network: Chain,
}

impl Default for BackendConfig {
  fn default() -> Self {
    Self {
      database_url: "data/opticrum.db".to_string(),
      keystore_path: "data/keystore.json".to_string(),
      node_config_path: "data/node-config.json".to_string(),
      ckb_rpc_url: "https://testnet.ckbapp.dev".to_string(),
      ckb_indexer_url: "https://testnet.ckb.dev/indexer".to_string(),
      fee_rate: 1000,
      network: Chain::Testnet,
    }
  }
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
    use crate::chain::chain_provider::ChainProvider;
    use crate::chain::real_chain_provider::RealChainProvider;
    use crate::db;

    let mut rpc =
      ckb_cinnabar_calculator::rpc::RpcClient::new(&cfg.ckb_rpc_url, Some(&cfg.ckb_indexer_url));
    // `RpcClient::new` marks the network as `Network::Custom`; the SDK's
    // `opticrum_contract_type_id` panics on Custom. Resolve it by asking the
    // chain (cinnabar maps the official testnet/mainnet chain id to Testnet/
    // Mainnet). If the node is unreachable at startup, keep the configured
    // network as a fallback so the app still boots to honest empty states.
    if let Err(e) = rpc.update_network().await {
      log::warn!("ckb network detection failed (node unreachable?): {e:#}");
      let fallback = if cfg.network == Chain::Testnet {
        ckb_cinnabar_calculator::rpc::Network::Testnet
      } else {
        ckb_cinnabar_calculator::rpc::Network::Mainnet
      };
      rpc.set_network(fallback);
    }
    let provider: Arc<dyn ChainProvider> = Arc::new(RealChainProvider::new(
      &cfg.ckb_rpc_url,
      &cfg.ckb_indexer_url,
    ));
    let db = db::init_db(&cfg.database_url)?;
    let testnet = cfg.network == Chain::Testnet;

    let wallet = Arc::new(crate::backend::real::RealWalletBackend::new(
      rpc.clone(),
      provider.clone(),
      db,
      std::path::PathBuf::from(&cfg.keystore_path),
      testnet,
      cfg.fee_rate,
    ));
    let liquidity = Arc::new(crate::backend::real_liquidity::RealLiquidityBackend::new(
      rpc,
      provider.clone(),
      wallet.clone(),
      testnet,
      // Separate connection for the personal-order cache (SQLite is cheap).
      Some(db::init_db(&cfg.database_url)?),
    ));

    // Node + channels: attached fiber node at the default config's RPC address
    // (dynamic reconnect on config change is a P5 refinement).
    use crate::node::fiber_api::{FiberNodeApi, FiberRpcApi};
    use crate::node::rpc_client::RpcClient as FiberRpcClient;
    use crate::node::{real_channels::RealChannelsBackend, real_node::RealNodeBackend};
    let fiber_url = crate::node::default_config::default_config()
      .rpc
      .listening_addr;
    let fiber_client = FiberRpcClient::new(&fiber_url, false, None).expect("valid fiber rpc url");
    let fiber_api: Arc<dyn FiberNodeApi> = Arc::new(FiberRpcApi::new(fiber_client.clone()));
    let node_config_path = std::path::PathBuf::from(&cfg.node_config_path);
    let node_base_dir = node_config_path
      .parent()
      .unwrap_or(std::path::Path::new("data"))
      .join("fiber-node");
    let node = Arc::new(RealNodeBackend::new(
      fiber_api,
      node_config_path,
      node_base_dir,
      wallet.clone(),
    ));
    let channels = Arc::new(RealChannelsBackend::new(Arc::new(
      crate::node::real_channels::RealFiberChannels::new(fiber_client),
    )));

    Ok(BackendBundle {
      wallet,
      node,
      channels,
      liquidity,
    })
  }
}
