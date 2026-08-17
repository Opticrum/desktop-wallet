//! Backend traits — the seam between the thin Tauri shell and the backend.
//!
//! Each trait mirrors one domain of `docs/ipc/ipc-api.md`. Methods return the
//! wire types directly (no parallel domain type system) so `src-tauri`
//! commands are pure arg-validation + dispatch.
//!
//! `WalletBackend` is async because the real impl needs on-chain balances and
//! a broadcast; node/channels/liquidity are sync because the mock impls only
//! mutate in-memory state.

use async_trait::async_trait;

use crate::wire::{
  ChannelList, CommandError, ConnectPeerResult, CreateWalletResult, DashboardData, ExtractResult,
  LiquidityMatch, LiquidityOrder, LogLevel, MatchDeadline, NodeConfig, NodeLog, NodeRuntime,
  OpenChannelResult, PublishOrderResult, SaveConfigResult, TxHashResult, WalletAddress,
  WalletStatus, WalletSummary, WalletTx,
};

#[async_trait]
pub trait WalletBackend: Send + Sync {
  async fn get_summary(&self) -> Result<WalletSummary, CommandError>;
  /// Fast wallet state (no chain query) — used to gate the unlock form without
  /// waiting for the on-chain balance in `get_summary`.
  async fn get_status(&self) -> Result<WalletStatus, CommandError>;
  async fn get_addresses(&self) -> Result<Vec<WalletAddress>, CommandError>;
  async fn get_transactions(
    &self,
    limit: Option<u32>,
    offset: Option<u32>,
  ) -> Result<Vec<WalletTx>, CommandError>;
  async fn unlock(
    &self,
    password: String,
    label: Option<String>,
  ) -> Result<WalletSummary, CommandError>;
  fn lock(&self) -> Result<(), CommandError>;
  async fn create_hd_wallet(
    &self,
    label: String,
    password: String,
    address_count: u32,
  ) -> Result<CreateWalletResult, CommandError>;
  async fn import_mnemonic(
    &self,
    mnemonic: String,
    password: String,
    label: String,
  ) -> Result<WalletSummary, CommandError>;
  async fn import_private_key(
    &self,
    private_key_hex: String,
    password: String,
    label: String,
  ) -> Result<WalletSummary, CommandError>;
  async fn derive_addresses(&self, count: u32) -> Result<Vec<String>, CommandError>;
  async fn send_ckb(
    &self,
    address: String,
    amount_shannons: u64,
  ) -> Result<TxHashResult, CommandError>;
}

#[async_trait]
pub trait NodeBackend: Send + Sync {
  async fn get_runtime(&self) -> Result<NodeRuntime, CommandError>;
  async fn start(&self, config: Option<NodeConfig>) -> Result<NodeRuntime, CommandError>;
  async fn stop(&self) -> Result<(), CommandError>;
  async fn get_logs(
    &self,
    level: Option<LogLevel>,
    since_ts_ms: Option<u64>,
    limit: Option<u32>,
  ) -> Result<Vec<NodeLog>, CommandError>;
  async fn get_config(&self) -> Result<NodeConfig, CommandError>;
  async fn save_config(&self, config: NodeConfig) -> Result<SaveConfigResult, CommandError>;
}

#[async_trait]
pub trait ChannelsBackend: Send + Sync {
  async fn list(&self) -> Result<ChannelList, CommandError>;
  async fn connect_peer(
    &self,
    addr: String,
    pubkey: Option<String>,
    alias: Option<String>,
  ) -> Result<ConnectPeerResult, CommandError>;
  async fn disconnect_peer(&self, peer_id: String) -> Result<(), CommandError>;
  async fn open_channel(
    &self,
    peer_id: String,
    capacity_shannons: u64,
    base_fee_mshannons: Option<u64>,
    fee_rate_ppm: Option<u64>,
  ) -> Result<OpenChannelResult, CommandError>;
  async fn close_channel(&self, channel_id: String, force: bool) -> Result<(), CommandError>;
}

#[async_trait]
pub trait LiquidityBackend: Send + Sync {
  async fn get_dashboard(&self) -> Result<DashboardData, CommandError>;
  async fn get_orders(&self, scope: Option<String>) -> Result<Vec<LiquidityOrder>, CommandError>;
  /// Re-scan the chain and sync the personal-order cache; returns the fresh list.
  async fn refresh_orders(&self) -> Result<Vec<LiquidityOrder>, CommandError>;
  async fn get_matches(&self, scope: Option<String>) -> Result<Vec<LiquidityMatch>, CommandError>;
  async fn get_matches_near_exhaustion(
    &self,
    blocks_threshold: u64,
  ) -> Result<Vec<MatchDeadline>, CommandError>;
  async fn publish_order(
    &self,
    capacity_shannons: u64,
    shannons_per_block: u64,
    rent_capacity_shannons: u64,
    rental_days: u32,
    fiber_address: Option<String>,
  ) -> Result<PublishOrderResult, CommandError>;
  async fn cancel_order(&self, outpoint: String) -> Result<TxHashResult, CommandError>;
  async fn inject_deposit(
    &self,
    match_outpoint: String,
    amount_shannons: u64,
  ) -> Result<TxHashResult, CommandError>;
  async fn withdraw_deposit(
    &self,
    match_outpoint: String,
    amount_shannons: u64,
  ) -> Result<TxHashResult, CommandError>;
  async fn extract_spent_match(
    &self,
    match_outpoint: String,
  ) -> Result<ExtractResult, CommandError>;
}
