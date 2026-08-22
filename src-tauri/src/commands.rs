//! Thin IPC command implementations.
//!
//! Each command deserializes its args, dispatches to the matching domain
//! backend on the shared `BackendBundle`, and returns the result. No business
//! logic lives here — it all lives in `opticrum-wallet-core`.

use opticrum_wallet_core::backend::TxProgressReporter;
use opticrum_wallet_core::wire::*;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use crate::fnn_cli::FnnCliStatus;
use crate::AppState;

/// Stream tx lifecycle progress (broadcasting → confirming) to the frontend's
/// transaction-confirmation modal over a per-invocation Tauri channel.
struct ChannelReporter {
  channel: Channel<TxProgress>,
}

impl TxProgressReporter for ChannelReporter {
  fn report(&self, progress: TxProgress) {
    let _ = self.channel.send(progress);
  }
}

// ── app ───────────────────────────────────────────────────────────────────────

/// Sync the UI locale to the shell so native tray menu text stays bilingual.
#[tauri::command]
pub fn app_set_locale(app: AppHandle, locale: String) -> Result<(), CommandError> {
  crate::tray::set_locale(&app, &locale);
  Ok(())
}

/// Actually quit — invoked by the frontend after the tray-exit risk prompt is
/// confirmed. `AppHandle::exit` terminates the process without emitting a
/// window `CloseRequested`, so it is not intercepted by the hide-to-tray handler.
#[tauri::command]
pub fn app_exit(app: AppHandle) -> Result<(), CommandError> {
  app.exit(0);
  Ok(())
}

// ── wallet ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn wallet_get_summary(state: State<'_, AppState>) -> Result<WalletSummary, CommandError> {
  state.0.wallet.get_summary().await
}

#[tauri::command]
pub async fn wallet_get_status(state: State<'_, AppState>) -> Result<WalletStatus, CommandError> {
  state.0.wallet.get_status().await
}

#[tauri::command]
pub async fn wallet_get_addresses(
  state: State<'_, AppState>,
) -> Result<Vec<WalletAddress>, CommandError> {
  state.0.wallet.get_addresses().await
}

#[tauri::command]
pub async fn wallet_get_transactions(
  state: State<'_, AppState>,
  limit: Option<u32>,
  offset: Option<u32>,
) -> Result<Vec<WalletTx>, CommandError> {
  state.0.wallet.get_transactions(limit, offset).await
}

#[tauri::command]
pub async fn wallet_unlock(
  state: State<'_, AppState>,
  password: String,
  label: Option<String>,
) -> Result<WalletSummary, CommandError> {
  state.0.wallet.unlock(password, label).await
}

#[tauri::command]
pub fn wallet_lock(state: State<'_, AppState>) -> Result<(), CommandError> {
  state.0.wallet.lock()
}

#[tauri::command]
pub async fn wallet_create_hd_wallet(
  state: State<'_, AppState>,
  label: String,
  password: String,
  address_count: u32,
) -> Result<CreateWalletResult, CommandError> {
  state
    .0
    .wallet
    .create_hd_wallet(label, password, address_count)
    .await
}

#[tauri::command]
pub async fn wallet_import_mnemonic(
  state: State<'_, AppState>,
  mnemonic: String,
  password: String,
  label: String,
) -> Result<WalletSummary, CommandError> {
  state
    .0
    .wallet
    .import_mnemonic(mnemonic, password, label)
    .await
}

#[tauri::command]
pub async fn wallet_import_private_key(
  state: State<'_, AppState>,
  private_key_hex: String,
  password: String,
  label: String,
) -> Result<WalletSummary, CommandError> {
  state
    .0
    .wallet
    .import_private_key(private_key_hex, password, label)
    .await
}

#[tauri::command]
pub async fn wallet_derive_addresses(
  state: State<'_, AppState>,
  count: u32,
) -> Result<Vec<String>, CommandError> {
  state.0.wallet.derive_addresses(count).await
}

#[tauri::command]
pub async fn wallet_send_ckb(
  state: State<'_, AppState>,
  address: String,
  amount_shannons: u64,
  channel: Channel<TxProgress>,
) -> Result<TxHashResult, CommandError> {
  let progress = ChannelReporter { channel };
  state
    .0
    .wallet
    .send_ckb(address, amount_shannons, &progress)
    .await
}

// ── node ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn node_get_runtime(state: State<'_, AppState>) -> Result<NodeRuntime, CommandError> {
  state.0.node.get_runtime().await
}

#[tauri::command]
pub async fn node_start(
  state: State<'_, AppState>,
  config: Option<NodeConfig>,
) -> Result<NodeRuntime, CommandError> {
  state.0.node.start(config).await
}

#[tauri::command]
pub async fn node_stop(state: State<'_, AppState>) -> Result<(), CommandError> {
  state.0.node.stop().await
}

#[tauri::command]
pub async fn node_get_logs(
  state: State<'_, AppState>,
  level: Option<LogLevel>,
  since_ts_ms: Option<u64>,
  limit: Option<u32>,
) -> Result<Vec<NodeLog>, CommandError> {
  state.0.node.get_logs(level, since_ts_ms, limit).await
}

#[tauri::command]
pub async fn node_get_config(state: State<'_, AppState>) -> Result<NodeConfig, CommandError> {
  state.0.node.get_config().await
}

#[tauri::command]
pub async fn node_save_config(
  state: State<'_, AppState>,
  config: NodeConfig,
) -> Result<SaveConfigResult, CommandError> {
  state.0.node.save_config(config).await
}

#[tauri::command]
pub async fn node_fnn_cli_status() -> Result<FnnCliStatus, CommandError> {
  Ok(FnnCliStatus {
    installed: crate::fnn_cli::is_installed(),
    install_url: crate::fnn_cli::FNN_CLI_INSTALL_URL.to_string(),
  })
}

#[tauri::command]
pub async fn node_fnn_cli_open(url: String) -> Result<(), CommandError> {
  crate::fnn_cli::open_terminal(&url).map_err(CommandError::io)
}

#[tauri::command]
pub async fn node_open_url(url: String) -> Result<(), CommandError> {
  crate::fnn_cli::open_url(&url).map_err(CommandError::io)
}

#[tauri::command]
pub async fn node_list_targets(state: State<'_, AppState>) -> Result<NodeTargetList, CommandError> {
  state.0.node.list_targets().await
}

#[tauri::command]
pub async fn node_add_external(
  state: State<'_, AppState>,
  alias: String,
  rpc_url: String,
  auth_token: Option<String>,
) -> Result<NodeTargetList, CommandError> {
  state.0.node.add_external(alias, rpc_url, auth_token).await
}

#[tauri::command]
pub async fn node_update_external(
  state: State<'_, AppState>,
  id: String,
  alias: String,
  rpc_url: String,
  auth_token: Option<String>,
) -> Result<NodeTargetList, CommandError> {
  state
    .0
    .node
    .update_external(id, alias, rpc_url, auth_token)
    .await
}

#[tauri::command]
pub async fn node_remove_external(
  state: State<'_, AppState>,
  id: String,
) -> Result<NodeTargetList, CommandError> {
  state.0.node.remove_external(id).await
}

#[tauri::command]
pub async fn node_set_active(
  state: State<'_, AppState>,
  id: String,
) -> Result<NodeRuntime, CommandError> {
  state.0.node.set_active(id).await
}

// ── channels ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn channels_list(state: State<'_, AppState>) -> Result<ChannelList, CommandError> {
  state.0.channels.list().await
}

#[tauri::command]
pub async fn channels_connect_peer(
  state: State<'_, AppState>,
  addr: String,
  pubkey: Option<String>,
  alias: Option<String>,
) -> Result<ConnectPeerResult, CommandError> {
  state.0.channels.connect_peer(addr, pubkey, alias).await
}

#[tauri::command]
pub async fn channels_disconnect_peer(
  state: State<'_, AppState>,
  peer_id: String,
) -> Result<(), CommandError> {
  state.0.channels.disconnect_peer(peer_id).await
}

#[tauri::command]
pub async fn channels_open_channel(
  state: State<'_, AppState>,
  peer_id: String,
  capacity_shannons: u64,
  base_fee_mshannons: Option<u64>,
  fee_rate_ppm: Option<u64>,
) -> Result<OpenChannelResult, CommandError> {
  state
    .0
    .channels
    .open_channel(peer_id, capacity_shannons, base_fee_mshannons, fee_rate_ppm)
    .await
}

#[tauri::command]
pub async fn channels_close_channel(
  state: State<'_, AppState>,
  channel_id: String,
  force: bool,
) -> Result<(), CommandError> {
  state.0.channels.close_channel(channel_id, force).await
}

#[tauri::command]
pub async fn channels_create_invoice(
  state: State<'_, AppState>,
  amount_shannons: u64,
  chain: Chain,
) -> Result<String, CommandError> {
  state
    .0
    .channels
    .create_invoice(amount_shannons, chain)
    .await
}

// ── liquidity ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn liquidity_get_dashboard(
  state: State<'_, AppState>,
) -> Result<DashboardData, CommandError> {
  state.0.liquidity.get_dashboard().await
}

#[tauri::command]
pub async fn liquidity_get_orders(
  state: State<'_, AppState>,
  scope: Option<String>,
) -> Result<Vec<LiquidityOrder>, CommandError> {
  state.0.liquidity.get_orders(scope).await
}

#[tauri::command]
pub async fn liquidity_refresh_orders(
  state: State<'_, AppState>,
) -> Result<Vec<LiquidityOrder>, CommandError> {
  state.0.liquidity.refresh_orders().await
}

#[tauri::command]
pub async fn liquidity_get_matches(
  state: State<'_, AppState>,
  scope: Option<String>,
) -> Result<Vec<LiquidityMatch>, CommandError> {
  state.0.liquidity.get_matches(scope).await
}

#[tauri::command]
pub async fn liquidity_get_matches_near_exhaustion(
  state: State<'_, AppState>,
  blocks_threshold: u64,
) -> Result<Vec<MatchDeadline>, CommandError> {
  state
    .0
    .liquidity
    .get_matches_near_exhaustion(blocks_threshold)
    .await
}

#[tauri::command]
pub async fn liquidity_publish_order(
  state: State<'_, AppState>,
  capacity_shannons: u64,
  shannons_per_block: u64,
  rent_capacity_shannons: u64,
  rental_days: u32,
  fiber_address: Option<String>,
  channel: Channel<TxProgress>,
) -> Result<PublishOrderResult, CommandError> {
  let progress = ChannelReporter { channel };
  state
    .0
    .liquidity
    .publish_order(
      capacity_shannons,
      shannons_per_block,
      rent_capacity_shannons,
      rental_days,
      fiber_address,
      &progress,
    )
    .await
}

#[tauri::command]
pub async fn liquidity_cancel_order(
  state: State<'_, AppState>,
  outpoint: String,
  channel: Channel<TxProgress>,
) -> Result<TxHashResult, CommandError> {
  let progress = ChannelReporter { channel };
  state.0.liquidity.cancel_order(outpoint, &progress).await
}

#[tauri::command]
pub async fn liquidity_inject_deposit(
  state: State<'_, AppState>,
  match_outpoint: String,
  amount_shannons: u64,
  channel: Channel<TxProgress>,
) -> Result<TxHashResult, CommandError> {
  let progress = ChannelReporter { channel };
  state
    .0
    .liquidity
    .inject_deposit(match_outpoint, amount_shannons, &progress)
    .await
}

#[tauri::command]
pub async fn liquidity_withdraw_deposit(
  state: State<'_, AppState>,
  match_outpoint: String,
  amount_shannons: u64,
  channel: Channel<TxProgress>,
) -> Result<TxHashResult, CommandError> {
  let progress = ChannelReporter { channel };
  state
    .0
    .liquidity
    .withdraw_deposit(match_outpoint, amount_shannons, &progress)
    .await
}

#[tauri::command]
pub async fn liquidity_extract_spent_match(
  state: State<'_, AppState>,
  match_outpoint: String,
  channel: Channel<TxProgress>,
) -> Result<ExtractResult, CommandError> {
  let progress = ChannelReporter { channel };
  state
    .0
    .liquidity
    .extract_spent_match(match_outpoint, &progress)
    .await
}
