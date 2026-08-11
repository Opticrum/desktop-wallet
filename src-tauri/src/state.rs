//! Shared mutable store backing the IPC commands.
//!
//! Holds the seeded mock data plus the session/sidecar state that write
//! commands mutate: wallet unlock status, node running flag, the liquidity
//! order/match lists, and the local `outpoint → {rental_days, created_at_ms,
//! deposit_ckb}` sidecar that `publish_order` writes.

use std::collections::HashMap;
use std::sync::Mutex;

use crate::mock_data;
use crate::wire::*;

/// Local sidecar entry — written by `publish_order`, joined by
/// `get_orders` / `get_matches`. Absent ⇒ order predates local tracking.
#[derive(Debug, Clone)]
pub struct SidecarEntry {
  pub rental_days: u32,
  pub created_at_ms: u64,
  pub deposit_ckb: f64,
}

pub struct Store {
  pub has_wallet: bool,
  pub unlocked: bool,
  pub wallet_address: String,
  pub wallet_addresses: Vec<WalletAddress>,
  pub available_ckb: f64,
  pub total_ckb: f64,
  pub locked_ckb: f64,
  pub fiat_usd: Option<f64>,
  pub txs: Vec<WalletTx>,
  pub logs: Vec<NodeLog>,
  pub running: bool,
  pub uptime_hours: u32,
  pub chain: Chain,
  pub config: NodeConfig,
  pub watchtower: WatchtowerConfig,
  pub channels: ChannelList,
  pub orders: Vec<LiquidityOrder>,
  pub matches: Vec<LiquidityMatch>,
  pub sidecar: HashMap<String, SidecarEntry>,
  /// Running counter for `open_channel` channel ids.
  pub(crate) next_channel: u32,
}

impl Store {
  pub fn new() -> Self {
    let (wallet, txs) = mock_data::mock_wallet();
    let channels = mock_data::mock_channels();
    let orders = mock_data::mock_orders();
    let matches = mock_data::mock_matches();

    // Pre-seed the sidecar for the seeded orders so dwell/rental badges render
    // exactly like the mockup (null would hide them).
    let sidecar: HashMap<String, SidecarEntry> = orders
      .iter()
      .map(|o| {
        (
          o.outpoint.clone(),
          SidecarEntry {
            rental_days: o.rental_days.unwrap_or(30),
            created_at_ms: o.created_at_ms.unwrap_or(0),
            deposit_ckb: o.deposit_ckb,
          },
        )
      })
      .collect();

    let mut config = mock_data::mock_config();
    let runtime = mock_data::mock_runtime();
    config.fiber.chain = chain_str(runtime.chain);

    Store {
      has_wallet: wallet.has_wallet,
      unlocked: wallet.unlocked,
      wallet_address: wallet.address,
      wallet_addresses: wallet.addresses,
      available_ckb: wallet.available_ckb,
      total_ckb: wallet.total_ckb,
      locked_ckb: wallet.locked_ckb,
      fiat_usd: wallet.fiat_usd,
      txs,
      logs: mock_data::mock_logs(),
      running: runtime.running,
      uptime_hours: runtime.uptime_hours,
      chain: runtime.chain,
      config,
      watchtower: runtime.watchtower,
      channels,
      orders,
      matches,
      sidecar,
      next_channel: 8,
    }
  }

  /// `wallet.get_summary` — assembled from the snapshot + session state.
  pub fn wallet_summary(&self) -> WalletSummary {
    WalletSummary {
      has_wallet: self.has_wallet,
      unlocked: self.unlocked,
      address: self.wallet_address.clone(),
      available_ckb: self.available_ckb,
      total_ckb: self.total_ckb,
      locked_ckb: self.locked_ckb,
      fiat_usd: self.fiat_usd,
      chain: self.chain,
    }
  }

  /// `node.get_runtime` — assembled from node subprocess + config state.
  pub fn node_runtime(&self) -> NodeRuntime {
    NodeRuntime {
      running: self.running,
      alias: Some(self.config.fiber.announced_node_name.clone()),
      uptime_hours: if self.running { self.uptime_hours } else { 0 },
      fiber_pubkey: "02ab91f4c5d27b8e6a1f4d3c9a72e881f0c5b7d4e3a9f8b6c1d2e5f4a3b7c9d1".to_string(),
      fiber_addr: Some(self.config.fiber.listening_addr.clone()),
      addresses: vec![self.config.fiber.listening_addr.clone()],
      chain: self.chain,
      version: Some("0.1.0".to_string()),
      commit_hash: Some("3c25bcf1".to_string()),
      peers_count: 48,
      channel_count: self
        .channels
        .nodes
        .iter()
        .map(|n| n.channels.len() as u32)
        .sum(),
      pending_channel_count: self
        .channels
        .nodes
        .iter()
        .flat_map(|n| &n.channels)
        .filter(|c| c.state == "NegotiatingFunding")
        .count() as u32,
      watchtower: self.watchtower.clone(),
    }
  }

  /// `liquidity.get_dashboard` — aggregate over the current order/match lists.
  pub fn dashboard(&self) -> DashboardData {
    mock_data::mock_dashboard(&self.orders, &self.matches)
  }
}

impl Default for Store {
  fn default() -> Self {
    Self::new()
  }
}

pub fn chain_str(chain: Chain) -> String {
  match chain {
    Chain::Mainnet => "mainnet".to_string(),
    Chain::Testnet => "testnet".to_string(),
  }
}

/// Tauri-managed shared state.
pub struct AppState(pub Mutex<Store>);

impl AppState {
  pub fn new() -> Self {
    AppState(Mutex::new(Store::new()))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn store_seeds_expected_data() {
    let s = Store::new();
    assert!(s.has_wallet);
    assert!(s.unlocked);
    assert_eq!(s.available_ckb, 9820.12);
    assert_eq!(s.txs.len(), 10);
    assert_eq!(s.orders.len(), 6);
    assert_eq!(s.matches.len(), 5);
    assert_eq!(s.sidecar.len(), 6, "sidecar pre-seeded for every order");
    assert_eq!(s.logs.len(), 54, "full mock log set");
  }

  #[test]
  fn wallet_summary_shapes_expected() {
    let s = Store::new();
    let w = s.wallet_summary();
    assert!(w.unlocked);
    assert_eq!(w.chain, Chain::Testnet);
    assert_eq!(w.fiat_usd, Some(1842.1));
    assert!(w.address.starts_with("ckt1"));
  }

  #[test]
  fn dashboard_total_matches_is_market_kpi() {
    let s = Store::new();
    let d = s.dashboard();
    // market-wide KPI (mockup badge), independent of the 5 seeded matches
    assert_eq!(d.total_matches, 42);
    assert_eq!(d.recent_matches.len(), 5);
  }

  #[test]
  fn runtime_watchtower_is_standalone() {
    let s = Store::new();
    let r = s.node_runtime();
    assert!(r.running);
    assert_eq!(r.watchtower.mode, WatchtowerMode::Standalone);
    assert_eq!(r.watchtower.endpoint.as_deref(), Some("/ip4/45.77.65.221/tcp/8115"));
  }
}
