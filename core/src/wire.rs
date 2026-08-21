//! IPC wire types — the frontend ⇄ Rust contract.
//!
//! Defined by `docs/ipc/ipc-api.md` §5. Two families:
//! - **Application wire types**: `#[serde(rename_all = "camelCase")]` JSON fields.
//! - **SDK-native aggregates** (`DashboardData` / `MatchDeadline` / `OrderSummary`
//!   / `MatchSummary` / `YieldDistribution`): keep SDK snake_case field names and
//!   are returned bare by `liquidity.get_dashboard` / `liquidity.get_matches_near_exhaustion`.
//! - **`NodeConfig`** is the exception: field names match config.yml keys (snake_case).

use serde::{Deserialize, Serialize};

/// CKB network — drives address hrp and the liquidity market network badge.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Chain {
  Mainnet,
  Testnet,
}

impl std::fmt::Display for Chain {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      Chain::Mainnet => write!(f, "mainnet"),
      Chain::Testnet => write!(f, "testnet"),
    }
  }
}

/// Phase of a broadcast CKB transaction, reported by the backend to the
/// frontend's transaction-confirmation modal (构造 → 发送上链 → 打包确认).
/// Only the two observable phase boundaries are reported — the modal opens on
/// the "constructing" step itself and completes the last step from the command
/// resolving.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TxPhase {
  /// About to submit the signed transaction to the CKB node's mempool.
  Broadcasting,
  /// The tx is broadcast; waiting for it to be packaged and confirmed on-chain.
  Confirming,
}

/// Progress payload pushed over the per-invocation Tauri channel.
#[derive(Debug, Clone, Serialize)]
pub struct TxProgress {
  pub phase: TxPhase,
  /// Tx hash once the broadcast RPC has returned it (`None` for `Broadcasting`).
  pub tx_hash: Option<String>,
}

/// Wire watchtower mode — migrated from the old mock `'local' | 'remote'`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WatchtowerMode {
  Builtin,
  Standalone,
  Disabled,
}

/// `MatchHealth` SDK enum — lowercase wire values.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MatchHealth {
  Healthy,
  Warning,
  Critical,
  Exhausted,
}

/// The wallet's party on a match — gates which actions the UI may offer
/// (inject/withdraw are buyer-side; extraction is seller-side). `Other` when
/// the wallet is neither party (non-`'mine'` scans).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MatchRole {
  Buyer,
  Seller,
  Other,
}

/// Log level — normalized to INFO / WARN / ERROR.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
  Info,
  Warn,
  Error,
}

/// Order status — always `'open'` in the wire; matched/cancelled orders are
/// consumed on-chain and never returned by `scan_orders`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OrderStatus {
  Open,
}

// ── wallet ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletSummary {
  pub has_wallet: bool,
  pub unlocked: bool,
  pub address: String,
  pub available_ckb: f64,
  pub total_ckb: f64,
  pub locked_ckb: f64,
  pub fiat_usd: Option<f64>,
  pub chain: Chain,
}

/// Fast wallet state — only local fields (no chain balance query), so the
/// unlock form can render immediately without waiting for `get_summary`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletStatus {
  pub has_wallet: bool,
  pub unlocked: bool,
  pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletAddress {
  pub address: String,
  /// `script_lock_hash(lock_arg)` hex — also the `channels.list` owner_lock_hash input.
  pub lock_hash: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WalletTxKind {
  Receive,
  Send,
  ChannelOpen,
  ChannelClose,
  RentPledge,
  RentExtract,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletTx {
  pub id: String,
  pub kind: WalletTxKind,
  /// Signed: +receive / −send (CKB).
  pub amount_ckb: f64,
  pub timestamp_ms: u64,
  pub tx_hash: String,
}

// ── node ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeRuntime {
  pub running: bool,
  /// True while the embedded node is booting (a `start` is in flight). The
  /// UI shows "preparing" instead of treating it as stopped.
  pub starting: bool,
  pub alias: Option<String>,
  /// Wall-clock ms the embedded node was (last) started — the uptime anchor for
  /// the frontend's live timer. `None` while the node is stopped.
  pub started_at_ms: Option<u64>,
  /// Derived: `(now − started_at_ms) / 3_600_000`, truncated to whole hours;
  /// `0` while the node is stopped.
  pub uptime_hours: u32,
  pub fiber_pubkey: String,
  pub fiber_addr: Option<String>,
  pub addresses: Vec<String>,
  pub chain: Chain,
  pub version: Option<String>,
  pub commit_hash: Option<String>,
  pub peers_count: u32,
  pub channel_count: u32,
  pub pending_channel_count: u32,
  pub watchtower: WatchtowerConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchtowerConfig {
  pub mode: WatchtowerMode,
  pub endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeLog {
  pub ts_ms: u64,
  pub level: LogLevel,
  pub msg: String,
}

/// 1:1 config.yml shape — field names match config.yml keys, NOT camelCase.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
  pub services: Vec<String>,
  pub fiber: FiberConfig,
  pub rpc: RpcConfig,
  pub ckb: CkbConfig,
  pub scripts: Vec<FiberScript>,
  pub udt_whitelist: Vec<UdtWhitelistEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiberConfig {
  pub listening_addr: String,
  #[serde(default)]
  pub announced_node_name: String,
  #[serde(default)]
  pub bootnode_addrs: Vec<String>,
  #[serde(default = "default_true")]
  pub announce_listening_addr: bool,
  #[serde(default)]
  pub announced_addrs: Vec<String>,
  #[serde(default = "default_chain")]
  pub chain: String,
  #[serde(default)]
  pub standalone_watchtower_rpc_url: String,
  #[serde(default)]
  pub disable_built_in_watchtower: bool,
  #[serde(default)]
  pub watchtower_check_interval_seconds: u64,
  #[serde(default)]
  pub open_channel_auto_accept_min_ckb_funding_amount: u64,
  #[serde(default)]
  pub auto_accept_channel_ckb_funding_amount: u64,
  #[serde(default)]
  pub tlc_expiry_delta: u64,
  #[serde(default)]
  pub tlc_fee_proportional_millionths: u64,
  #[serde(default)]
  pub funding_timeout_seconds: u64,
  #[serde(default)]
  pub max_inbound_peers: u64,
  #[serde(default)]
  pub min_outbound_peers: u64,
  #[serde(default = "default_true")]
  pub sync_network_graph: bool,
  #[serde(default = "default_true")]
  pub auto_announce_node: bool,
  #[serde(default)]
  pub proxy_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcConfig {
  pub listening_addr: String,
  #[serde(default)]
  pub enabled_modules: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CkbConfig {
  pub rpc_url: String,
  #[serde(default)]
  pub tx_tracing_polling_interval_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiberScript {
  pub name: String,
  pub code_hash: String,
  pub hash_type: String,
  pub args: String,
  #[serde(default)]
  pub cell_deps: Vec<ScriptCellDep>,
}

/// `cell_deps` entry — either a Type ID script or a direct CellDep.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ScriptCellDep {
  TypeId {
    code_hash: String,
    hash_type: String,
    args: String,
  },
  CellDep {
    tx_hash: String,
    /// hex string like `'0x0'` (matches fiber `out_point.index`).
    index: String,
    dep_type: String,
  },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdtWhitelistEntry {
  pub name: String,
  pub code_hash: String,
  pub hash_type: String,
  pub args: String,
  #[serde(default)]
  pub auto_accept_amount: u64,
  #[serde(default)]
  pub cell_deps: Option<Vec<ScriptCellDep>>,
}

// ── channels ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelList {
  pub nodes: Vec<ChannelNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelNode {
  pub peer: PeerInfo,
  pub channels: Vec<Channel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerInfo {
  pub id: String,
  pub alias: Option<String>,
  pub addr: Option<String>,
  /// Peer fiber software version (from the network graph), when known.
  pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Channel {
  pub channel_id: String,
  pub tx_hash: String,
  pub output_index: u32,
  pub capacity_ckb: f64,
  pub capacity_shannons: u64,
  pub local_balance_ckb: f64,
  pub local_balance_shannons: u64,
  pub remote_balance_ckb: f64,
  pub remote_balance_shannons: u64,
  /// Fiber raw `state_name` — the frontend maps it to active|pending|closing.
  pub state: String,
  pub is_public: bool,
  pub enabled: bool,
  pub created_at_ms: u64,
  pub close_flags: Option<u32>,
  pub base_fee_mshannons: Option<u64>,
  pub fee_rate_ppm: Option<u64>,
}

// ── liquidity ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiquidityOrder {
  pub outpoint: String,
  /// The 33-byte fiber pubkey embedded in the order cell's lock args — the
  /// node identity the order was created under. Mismatches the current node's
  /// `fiber_pubkey` when the order predates a node key change (frontend flags it).
  /// `#[serde(default)]` so cache rows written before this field existed load
  /// with an empty pubkey instead of failing to deserialize.
  #[serde(default)]
  pub fiber_pubkey: String,
  pub channel_capacity_ckb: f64,
  pub channel_capacity_shannons: u64,
  pub shannons_per_block: u64,
  pub annual_yield_bps: f64,
  pub deposit_ckb: f64,
  pub rental_days: Option<u32>,
  pub fiber_address: Option<String>,
  /// u128 serialized as string.
  pub xudt_amount: String,
  /// null when the order predates local tracking → frontend hides dwell/rental badges.
  pub created_at_ms: Option<u64>,
  pub status: OrderStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiquidityMatch {
  pub outpoint: String,
  pub channel_outpoint: String,
  /// The fiber pubkey of the underlying order cell this match derives from.
  #[serde(default)]
  pub fiber_pubkey: String,
  /// The capacity of the funded Fiber channel (constant across the match's
  /// life — the yield basis). NOT the remaining stake.
  pub channel_capacity_ckb: f64,
  pub shannons_per_block: u64,
  pub annual_yield_bps: f64,
  /// Current remaining rent pool (`MatchInfo.ckb_capacity / 1e8`) — shrinks on
  /// each seller extraction.
  pub deposit_ckb: f64,
  /// Original rent pool at match creation (`walk_original_stake`, CKB).
  /// Recovered by tracing the producing-tx lineage back to the `order_match`
  /// tx; falls back to the current stake when the trace fails.
  pub original_stake_ckb: f64,
  /// Buyer-withdrawable CKB. Non-zero only while the wallet is the buyer AND
  /// inside the hesitation window — there it equals the full stake (a withdraw
  /// is always a full dump); otherwise `0.0`.
  pub withdrawable_ckb: f64,
  pub xudt_amount: String,
  pub created_at_ms: u64,
  /// `u64::MAX` when never exhausted (`shannons_per_block == 0`).
  pub expires_at_ms: u64,
  pub is_exhausted: bool,
  pub health: MatchHealth,
  pub last_extraction_block: u64,
  pub projected_exhaustion_block: u64,
  pub seller_lock_hash: String,
  /// The match cell's producing block — the hesitation-window anchor
  /// (`MatchInfo.match_current_block`).
  pub match_creation_block: u64,
  /// Buyer full-withdrawal deadline: `created_at_ms + HESITATION_BLOCKS × 12s`
  /// (same 12s/block convention as `expires_at_ms`). Only meaningful while
  /// `last_extraction_block == 0`.
  pub hesitation_ends_at_ms: u64,
  /// Which party this wallet is on the match — gates inject/withdraw UX.
  pub role: MatchRole,
}

// ── SDK-native aggregates (snake_case, no rename_all) ────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct DashboardData {
  pub tip_block: u64,
  pub total_orders: u64,
  pub total_matches: u64,
  pub active_matches: u64,
  pub exhausted_matches: u64,
  pub total_capacity_locked_shannons: u64,
  pub total_orders_capacity_shannons: u64,
  pub avg_shannons_per_block: u64,
  pub avg_annual_yield_bps: u64,
  pub matches_near_exhaustion: Vec<MatchDeadline>,
  pub recent_orders: Vec<OrderSummary>,
  pub recent_matches: Vec<MatchSummary>,
  pub yield_distribution: YieldDistribution,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrderSummary {
  pub outpoint: String,
  pub channel_capacity_ckb: f64,
  pub shannons_per_block: u64,
  pub annual_yield_bps: f64,
  pub xudt_amount: String,
  pub has_fiber_address: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct MatchSummary {
  pub match_outpoint: String,
  pub channel_outpoint: String,
  pub remaining_capacity_ckb: f64,
  pub shannons_per_block: u64,
  pub annual_yield_bps: f64,
  pub is_exhausted: bool,
  pub last_extraction_block: u64,
  pub projected_exhaustion_block: u64,
  pub xudt_amount: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MatchDeadline {
  pub match_outpoint: String,
  pub channel_outpoint: String,
  pub shannons_per_block: u64,
  pub remaining_capacity_ckb: f64,
  pub last_extraction_block: u64,
  pub match_creation_block: u64,
  pub projected_exhaustion_block: u64,
  pub blocks_remaining: u64,
  pub estimated_hours_remaining: u64,
  pub health: MatchHealth,
  pub extractable_now_ckb: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct YieldDistribution {
  pub buckets: Vec<YieldBucket>,
}

#[derive(Debug, Clone, Serialize)]
pub struct YieldBucket {
  pub low_bps: u64,
  pub high_bps: u64,
  pub count: u64,
  pub capacity_shannons: u64,
}

// ── command result shapes (serialize-only) ────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWalletResult {
  pub mnemonic: String,
  pub address: String,
  pub addresses: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TxHashResult {
  pub tx_hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishOrderResult {
  pub order_outpoint: String,
  pub tx_hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectPeerResult {
  pub peer_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenChannelResult {
  pub temp_id: String,
  pub channel_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveConfigResult {
  pub chain: Chain,
  pub watchtower: WatchtowerConfig,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractResult {
  pub tx_hash: String,
  pub returned_ckb: f64,
}

// ── errors ───────────────────────────────────────────────────────────────────

/// serde-tagged `{ code, message }` — the frontend switches on `code`.
///
/// All variants mirror `docs/ipc/ipc-api.md` §3.3; the mock backend does not
/// emit every variant yet (chain/scan/build come with the real core crate), so
/// dead_code is allowed for the contract-complete set.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case", tag = "code", content = "message")]
#[allow(dead_code)]
pub enum CommandError {
  Chain(String),
  Scan(String),
  Build(String),
  InvalidInput(String),
  AlreadyExhausted(String),
  NotExhausted(String),
  NotAuthorized(String),
  /// Buyer tried to withdraw after the hesitation window (or first extraction).
  WithdrawWindowExpired(String),
  /// Seller tried to extract before the hesitation window elapses.
  HesitationNotElapsed(String),
  /// Buyer tried a partial withdrawal — the protocol only allows a full dump.
  PartialWithdrawNotAllowed(String),
  /// Buyer tried to inject funds inside the hesitation window.
  InjectDuringHesitation(String),
  WalletLocked(String),
  NodeNotRunning(String),
  Node(String),
  InsufficientFunds(String),
  AlreadyExists(String),
  Config(String),
  Io(String),
  Internal(String),
}

impl CommandError {
  pub fn invalid_input(msg: impl Into<String>) -> Self {
    CommandError::InvalidInput(msg.into())
  }
  pub fn internal(msg: impl Into<String>) -> Self {
    CommandError::Internal(msg.into())
  }
  pub fn wallet_locked(msg: impl Into<String>) -> Self {
    CommandError::WalletLocked(msg.into())
  }
  pub fn chain(msg: impl Into<String>) -> Self {
    CommandError::Chain(msg.into())
  }
  pub fn io(msg: impl Into<String>) -> Self {
    CommandError::Io(msg.into())
  }
  pub fn already_exists(msg: impl Into<String>) -> Self {
    CommandError::AlreadyExists(msg.into())
  }
  pub fn build(msg: impl Into<String>) -> Self {
    CommandError::Build(msg.into())
  }
  pub fn scan(msg: impl Into<String>) -> Self {
    CommandError::Scan(msg.into())
  }
}

impl std::fmt::Display for CommandError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    let (code, msg) = match self {
      CommandError::Chain(m) => ("chain", m),
      CommandError::Scan(m) => ("scan", m),
      CommandError::Build(m) => ("build", m),
      CommandError::InvalidInput(m) => ("invalid_input", m),
      CommandError::AlreadyExhausted(m) => ("already_exhausted", m),
      CommandError::NotExhausted(m) => ("not_exhausted", m),
      CommandError::NotAuthorized(m) => ("not_authorized", m),
      CommandError::WithdrawWindowExpired(m) => ("withdraw_window_expired", m),
      CommandError::HesitationNotElapsed(m) => ("hesitation_not_elapsed", m),
      CommandError::PartialWithdrawNotAllowed(m) => ("partial_withdraw_not_allowed", m),
      CommandError::InjectDuringHesitation(m) => ("inject_during_hesitation", m),
      CommandError::WalletLocked(m) => ("wallet_locked", m),
      CommandError::NodeNotRunning(m) => ("node_not_running", m),
      CommandError::Node(m) => ("node", m),
      CommandError::InsufficientFunds(m) => ("insufficient_funds", m),
      CommandError::AlreadyExists(m) => ("already_exists", m),
      CommandError::Config(m) => ("config", m),
      CommandError::Io(m) => ("io", m),
      CommandError::Internal(m) => ("internal", m),
    };
    write!(f, "{code}: {msg}")
  }
}

impl std::error::Error for CommandError {}

fn default_true() -> bool {
  true
}
fn default_chain() -> String {
  "testnet".to_string()
}
