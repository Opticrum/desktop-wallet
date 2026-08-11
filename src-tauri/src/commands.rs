//! Thin IPC command implementations.
//!
//! Each command validates args, delegates to the shared `Store`, and maps the
//! result — no business logic lives here. The command surface matches
//! `docs/ipc/ipc-api.md` §4 exactly.

use serde::Serialize;
use tauri::State;

use crate::state::{AppState, SidecarEntry, chain_str};
use crate::wire::*;

// ── helpers ──────────────────────────────────────────────────────────────────

fn lock<'a>(state: &'a State<'_, AppState>) -> Result<std::sync::MutexGuard<'a, crate::state::Store>, CommandError> {
  state
    .0
    .lock()
    .map_err(|_| CommandError::internal("state poisoned"))
}

fn require_unlocked(store: &crate::state::Store) -> Result<(), CommandError> {
  if !store.unlocked {
    return Err(CommandError::WalletLocked("wallet is locked".into()));
  }
  Ok(())
}

/// Deterministic mock tx hash (64 hex chars) — placeholder until real signing.
fn fake_tx_hash(seed: &str) -> String {
  let mut h: u64 = 0xcbf2_9ce4_8422_2325;
  for b in seed.bytes() {
    h ^= b as u64;
    h = h.wrapping_mul(0x1_0000_01b3);
  }
  format!("0x{:016x}{:048x}", h, seed.len() as u64)
}

/// Derive the watchtower mode from the persisted NodeConfig.
fn watchtower_from_config(config: &NodeConfig) -> WatchtowerConfig {
  let url = config.fiber.standalone_watchtower_rpc_url.trim();
  if !url.is_empty() {
    WatchtowerConfig {
      mode: WatchtowerMode::Standalone,
      endpoint: Some(url.to_string()),
    }
  } else if config.fiber.disable_built_in_watchtower {
    WatchtowerConfig { mode: WatchtowerMode::Disabled, endpoint: None }
  } else {
    WatchtowerConfig { mode: WatchtowerMode::Builtin, endpoint: None }
  }
}

fn parse_chain(s: &str) -> Chain {
  if s.eq_ignore_ascii_case("mainnet") {
    Chain::Mainnet
  } else {
    Chain::Testnet
  }
}

// ── inline result shapes ─────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWalletResult {
  mnemonic: String,
  address: String,
  addresses: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TxHashResult {
  tx_hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishOrderResult {
  order_outpoint: String,
  tx_hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectPeerResult {
  peer_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenChannelResult {
  temp_id: String,
  channel_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveConfigResult {
  chain: Chain,
  watchtower: WatchtowerConfig,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractResult {
  tx_hash: String,
  returned_ckb: f64,
}

// ── wallet ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn wallet_get_summary(state: State<'_, AppState>) -> Result<WalletSummary, CommandError> {
  Ok(lock(&state)?.wallet_summary())
}

#[tauri::command]
pub fn wallet_get_addresses(state: State<'_, AppState>) -> Result<Vec<WalletAddress>, CommandError> {
  Ok(lock(&state)?.wallet_addresses.clone())
}

#[tauri::command]
pub fn wallet_get_transactions(
  state: State<'_, AppState>,
  limit: Option<u32>,
  offset: Option<u32>,
) -> Result<Vec<WalletTx>, CommandError> {
  let store = lock(&state)?;
  let offset = offset.unwrap_or(0) as usize;
  let txs: Vec<WalletTx> = store.txs.iter().skip(offset).cloned().collect();
  Ok(match limit {
    Some(l) => txs.into_iter().take(l as usize).collect(),
    None => txs,
  })
}

#[tauri::command]
pub fn wallet_unlock(
  state: State<'_, AppState>,
  password: String,
  label: Option<String>,
) -> Result<WalletSummary, CommandError> {
  let mut store = lock(&state)?;
  if !store.has_wallet {
    return Err(CommandError::InvalidInput(
      "no wallet exists — create or import one first".into(),
    ));
  }
  if password.is_empty() {
    return Err(CommandError::InvalidInput("password is required".into()));
  }
  let _ = label;
  store.unlocked = true;
  Ok(store.wallet_summary())
}

#[tauri::command]
pub fn wallet_lock(state: State<'_, AppState>) -> Result<(), CommandError> {
  lock(&state)?.unlocked = false;
  Ok(())
}

#[tauri::command]
pub fn wallet_create_hd_wallet(
  state: State<'_, AppState>,
  label: String,
  password: String,
  address_count: u32,
) -> Result<CreateWalletResult, CommandError> {
  let mut store = lock(&state)?;
  if store.has_wallet {
    return Err(CommandError::AlreadyExists("a wallet already exists".into()));
  }
  if password.is_empty() {
    return Err(CommandError::invalid_input("password is required"));
  }
  let mnemonic = "gospel upgrade venue act wrong abandon length convince genre dream bundle glue".to_string();
  let addresses: Vec<String> = (0..address_count.max(1))
    .map(|i| format!("ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s{:02}p", i))
    .collect();
  let address = addresses.first().cloned().unwrap_or_default();
  store.has_wallet = true;
  store.unlocked = true;
  store.wallet_address = address.clone();
  store.wallet_addresses.push(WalletAddress {
    address: address.clone(),
    lock_hash: "0x8e55773c1c3f5b2f1f2f6e9a8d0c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c".to_string(),
  });
  let _ = label;
  Ok(CreateWalletResult { mnemonic, address, addresses })
}

#[tauri::command]
pub fn wallet_import_mnemonic(
  state: State<'_, AppState>,
  mnemonic: String,
  password: String,
  label: String,
) -> Result<WalletSummary, CommandError> {
  let mut store = lock(&state)?;
  if mnemonic.trim().is_empty() {
    return Err(CommandError::invalid_input("mnemonic is required"));
  }
  let _ = (password, label);
  store.has_wallet = true;
  store.unlocked = true;
  Ok(store.wallet_summary())
}

#[tauri::command]
pub fn wallet_import_private_key(
  state: State<'_, AppState>,
  private_key_hex: String,
  password: String,
  label: String,
) -> Result<WalletSummary, CommandError> {
  let mut store = lock(&state)?;
  if private_key_hex.trim().is_empty() {
    return Err(CommandError::invalid_input("private key is required"));
  }
  let _ = (password, label);
  store.has_wallet = true;
  store.unlocked = true;
  Ok(store.wallet_summary())
}

#[tauri::command]
pub fn wallet_derive_addresses(
  state: State<'_, AppState>,
  count: u32,
) -> Result<Vec<String>, CommandError> {
  let store = lock(&state)?;
  require_unlocked(&store)?;
  Ok((0..count.max(1))
    .map(|i| format!("ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s{:02}p", i + 10))
    .collect())
}

#[tauri::command]
pub fn wallet_send_ckb(
  state: State<'_, AppState>,
  address: String,
  amount_shannons: u64,
) -> Result<TxHashResult, CommandError> {
  let store = lock(&state)?;
  require_unlocked(&store)?;
  if address.trim().is_empty() {
    return Err(CommandError::invalid_input("recipient address is required"));
  }
  if amount_shannons == 0 {
    return Err(CommandError::invalid_input("amount must be greater than 0"));
  }
  if amount_shannons as f64 / 1e8 > store.available_ckb {
    return Err(CommandError::InsufficientFunds("insufficient balance".into()));
  }
  Ok(TxHashResult { tx_hash: fake_tx_hash(&format!("send:{address}")) })
}

// ── node ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn node_get_runtime(state: State<'_, AppState>) -> Result<NodeRuntime, CommandError> {
  Ok(lock(&state)?.node_runtime())
}

#[tauri::command]
pub fn node_start(
  state: State<'_, AppState>,
  config: Option<NodeConfig>,
) -> Result<NodeRuntime, CommandError> {
  let mut store = lock(&state)?;
  if let Some(cfg) = config {
    store.chain = parse_chain(&cfg.fiber.chain);
    store.watchtower = watchtower_from_config(&cfg);
    store.config = cfg;
  }
  store.running = true;
  store.uptime_hours = 0;
  Ok(store.node_runtime())
}

#[tauri::command]
pub fn node_stop(state: State<'_, AppState>) -> Result<(), CommandError> {
  lock(&state)?.running = false;
  Ok(())
}

#[tauri::command]
pub fn node_get_logs(
  state: State<'_, AppState>,
  level: Option<LogLevel>,
  since_ts_ms: Option<u64>,
  limit: Option<u32>,
) -> Result<Vec<NodeLog>, CommandError> {
  let store = lock(&state)?;
  let mut logs: Vec<NodeLog> = store
    .logs
    .iter()
    .filter(|l| level.map_or(true, |lv| l.level == lv))
    .filter(|l| since_ts_ms.map_or(true, |ts| l.ts_ms >= ts))
    .cloned()
    .collect();
  if let Some(l) = limit {
    logs.truncate(l as usize);
  }
  Ok(logs)
}

#[tauri::command]
pub fn node_get_config(state: State<'_, AppState>) -> Result<NodeConfig, CommandError> {
  Ok(lock(&state)?.config.clone())
}

#[tauri::command]
pub fn node_save_config(
  state: State<'_, AppState>,
  config: NodeConfig,
) -> Result<SaveConfigResult, CommandError> {
  let mut store = lock(&state)?;
  let chain = parse_chain(&config.fiber.chain);
  let watchtower = watchtower_from_config(&config);
  store.config = config;
  store.chain = chain;
  store.watchtower = watchtower.clone();
  let _ = chain_str(chain);
  Ok(SaveConfigResult { chain, watchtower })
}

// ── channels ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn channels_list(state: State<'_, AppState>) -> Result<ChannelList, CommandError> {
  Ok(lock(&state)?.channels.clone())
}

#[tauri::command]
pub fn channels_connect_peer(
  state: State<'_, AppState>,
  addr: String,
  pubkey: Option<String>,
  alias: Option<String>,
) -> Result<ConnectPeerResult, CommandError> {
  let mut store = lock(&state)?;
  let peer_id = match pubkey {
    Some(pk) if !pk.is_empty() => pk,
    _ => addr
      .split("/p2p/")
      .nth(1)
      .map(|s| s.to_string())
      .unwrap_or_else(|| format!("peer-{}", store.next_channel)),
  };
  let alias = alias.or_else(|| Some(peer_id.clone()));
  let exists = store.channels.nodes.iter().any(|n| n.peer.id == peer_id);
  if !exists {
    store.channels.nodes.push(ChannelNode {
      peer: PeerInfo {
        id: peer_id.clone(),
        alias,
        addr: Some(addr.clone()),
      },
      channels: vec![],
    });
  }
  Ok(ConnectPeerResult { peer_id })
}

#[tauri::command]
pub fn channels_disconnect_peer(
  state: State<'_, AppState>,
  peer_id: String,
) -> Result<(), CommandError> {
  let mut store = lock(&state)?;
  store.channels.nodes.retain(|n| n.peer.id != peer_id);
  Ok(())
}

#[tauri::command]
pub fn channels_open_channel(
  state: State<'_, AppState>,
  peer_id: String,
  capacity_shannons: u64,
  base_fee_mshannons: Option<u64>,
  fee_rate_ppm: Option<u64>,
) -> Result<OpenChannelResult, CommandError> {
  let mut store = lock(&state)?;
  if capacity_shannons == 0 {
    return Err(CommandError::invalid_input("capacity must be greater than 0"));
  }
  let n = store.next_channel;
  store.next_channel += 1;
  let temp_id = format!("temp-{n}");
  let channel_id = format!("ch-{n:02}");
  let capacity = capacity_shannons as f64 / 1e8;
  let node = store
    .channels
    .nodes
    .iter_mut()
    .find(|n| n.peer.id == peer_id)
    .ok_or_else(|| CommandError::invalid_input("peer not found — connect it first"))?;
  node.channels.push(Channel {
    channel_id: channel_id.clone(),
    tx_hash: fake_tx_hash(&temp_id),
    output_index: 0,
    capacity_ckb: capacity,
    capacity_shannons,
    local_balance_ckb: capacity,
    local_balance_shannons: capacity_shannons,
    remote_balance_ckb: 0.0,
    remote_balance_shannons: 0,
    state: "NegotiatingFunding".to_string(),
    is_public: true,
    enabled: true,
    created_at_ms: 0,
    close_flags: None,
    base_fee_mshannons,
    fee_rate_ppm,
  });
  Ok(OpenChannelResult {
    temp_id,
    channel_id: Some(channel_id),
  })
}

#[tauri::command]
pub fn channels_close_channel(
  state: State<'_, AppState>,
  channel_id: String,
  force: bool,
) -> Result<(), CommandError> {
  let mut store = lock(&state)?;
  let _ = force;
  let found = store
    .channels
    .nodes
    .iter_mut()
    .flat_map(|n| &mut n.channels)
    .find(|c| c.channel_id == channel_id)
    .ok_or_else(|| CommandError::invalid_input("channel not found"))?;
  found.state = "ShuttingDown".to_string();
  Ok(())
}

// ── liquidity ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn liquidity_get_dashboard(state: State<'_, AppState>) -> Result<DashboardData, CommandError> {
  Ok(lock(&state)?.dashboard())
}

#[tauri::command]
pub fn liquidity_get_orders(
  state: State<'_, AppState>,
  scope: Option<String>,
) -> Result<Vec<LiquidityOrder>, CommandError> {
  let _ = scope;
  let store = lock(&state)?;
  // Join the local sidecar: `publish_order` writes rental/created/deposit there,
  // and orders that predate local tracking surface as `null` for those fields.
  Ok(store
    .orders
    .iter()
    .map(|o| {
      let mut o = o.clone();
      if let Some(e) = store.sidecar.get(&o.outpoint) {
        o.rental_days = Some(e.rental_days);
        o.created_at_ms = Some(e.created_at_ms);
        o.deposit_ckb = e.deposit_ckb;
      }
      o
    })
    .collect())
}

#[tauri::command]
pub fn liquidity_get_matches(
  state: State<'_, AppState>,
  scope: Option<String>,
) -> Result<Vec<LiquidityMatch>, CommandError> {
  let _ = scope;
  Ok(lock(&state)?.matches.clone())
}

#[tauri::command]
pub fn liquidity_get_matches_near_exhaustion(
  state: State<'_, AppState>,
  blocks_threshold: u64,
) -> Result<Vec<MatchDeadline>, CommandError> {
  let _ = blocks_threshold;
  let store = lock(&state)?;
  Ok(crate::mock_data::mock_deadlines(&store.matches))
}

#[tauri::command]
pub fn liquidity_publish_order(
  state: State<'_, AppState>,
  capacity_shannons: u64,
  shannons_per_block: u64,
  rent_capacity_shannons: u64,
  rental_days: u32,
  fiber_address: Option<String>,
) -> Result<PublishOrderResult, CommandError> {
  let mut store = lock(&state)?;
  require_unlocked(&store)?;
  if capacity_shannons == 0 || rent_capacity_shannons == 0 {
    return Err(CommandError::invalid_input("capacity and rent must be greater than 0"));
  }
  let capacity_ckb = capacity_shannons as f64 / 1e8;
  let deposit_ckb = rent_capacity_shannons as f64 / 1e8;
  let outpoint = format!("{}:0", fake_tx_hash(&format!("order:{}", store.orders.len())));
  let created_at_ms = crate::now_ms();
  let order = LiquidityOrder {
    outpoint: outpoint.clone(),
    channel_capacity_ckb: capacity_ckb,
    channel_capacity_shannons: capacity_shannons,
    shannons_per_block,
    annual_yield_bps: crate::mock_data::apy_bps(shannons_per_block, capacity_ckb),
    deposit_ckb,
    rental_days: Some(rental_days),
    fiber_address,
    xudt_amount: "0".to_string(),
    created_at_ms: Some(created_at_ms),
    status: OrderStatus::Open,
  };
  store.sidecar.insert(
    outpoint.clone(),
    SidecarEntry {
      rental_days,
      created_at_ms,
      deposit_ckb,
    },
  );
  store.orders.insert(0, order);
  Ok(PublishOrderResult {
    order_outpoint: outpoint.clone(),
    tx_hash: fake_tx_hash(&outpoint),
  })
}

#[tauri::command]
pub fn liquidity_cancel_order(
  state: State<'_, AppState>,
  outpoint: String,
) -> Result<TxHashResult, CommandError> {
  let mut store = lock(&state)?;
  require_unlocked(&store)?;
  let len_before = store.orders.len();
  store.orders.retain(|o| o.outpoint != outpoint);
  store.sidecar.remove(&outpoint);
  if store.orders.len() == len_before {
    return Err(CommandError::invalid_input("order not found"));
  }
  Ok(TxHashResult { tx_hash: fake_tx_hash(&outpoint) })
}

#[tauri::command]
pub fn liquidity_inject_deposit(
  state: State<'_, AppState>,
  match_outpoint: String,
  amount_shannons: u64,
) -> Result<TxHashResult, CommandError> {
  let mut store = lock(&state)?;
  require_unlocked(&store)?;
  let amount_ckb = amount_shannons as f64 / 1e8;
  let m = store
    .matches
    .iter_mut()
    .find(|m| m.outpoint == match_outpoint)
    .ok_or_else(|| CommandError::invalid_input("match not found"))?;
  m.deposit_ckb += amount_ckb;
  m.withdrawable_ckb += amount_ckb;
  Ok(TxHashResult { tx_hash: fake_tx_hash(&match_outpoint) })
}

#[tauri::command]
pub fn liquidity_withdraw_deposit(
  state: State<'_, AppState>,
  match_outpoint: String,
  amount_shannons: u64,
) -> Result<TxHashResult, CommandError> {
  let mut store = lock(&state)?;
  require_unlocked(&store)?;
  let amount_ckb = amount_shannons as f64 / 1e8;
  let m = store
    .matches
    .iter_mut()
    .find(|m| m.outpoint == match_outpoint)
    .ok_or_else(|| CommandError::invalid_input("match not found"))?;
  if amount_ckb > m.withdrawable_ckb {
    return Err(CommandError::invalid_input("amount exceeds withdrawable balance"));
  }
  m.deposit_ckb = (m.deposit_ckb - amount_ckb).max(0.0);
  m.withdrawable_ckb = (m.withdrawable_ckb - amount_ckb).max(0.0);
  Ok(TxHashResult { tx_hash: fake_tx_hash(&match_outpoint) })
}

#[tauri::command]
pub fn liquidity_extract_spent_match(
  state: State<'_, AppState>,
  match_outpoint: String,
) -> Result<ExtractResult, CommandError> {
  let mut store = lock(&state)?;
  require_unlocked(&store)?;
  let m = store
    .matches
    .iter()
    .find(|m| m.outpoint == match_outpoint)
    .ok_or_else(|| CommandError::invalid_input("match not found"))?;
  if !m.is_exhausted {
    return Err(CommandError::NotExhausted(
      "match still has remaining capacity".into(),
    ));
  }
  let returned_ckb = m.deposit_ckb;
  store.matches.retain(|m| m.outpoint != match_outpoint);
  Ok(ExtractResult {
    tx_hash: fake_tx_hash(&match_outpoint),
    returned_ckb,
  })
}
