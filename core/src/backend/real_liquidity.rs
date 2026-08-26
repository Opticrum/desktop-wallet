//! RealLiquidityBackend — real on-chain liquidity reads via `opticrum-sdk`.
//!
//! Scans live Order/Match cells with the SDK, then maps the protocol types to
//! the wire shapes. Local-tracking fields the chain does not carry (`deposit_ckb`,
//! `rental_days`, `created_at_ms` for orders) surface as null/0 in P2 — they land
//! with the publish path (P4). Matches carry the hesitation-window fields derived
//! from `MatchInfo` (`match_creation_block`, `hesitation_ends_at_ms`, `role`) and
//! `withdrawable_ckb` is the full stake only while the wallet is the buyer inside
//! the window.
//! `scope` defaults to `'mine'`: `get_orders`/`get_matches` narrow to cells the
//! wallet owns (buyer lock hash for orders; buyer **or** seller for matches),
//! computed from the wallet's secp256k1 lock; `'all'` returns every on-chain cell.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use ckb_cinnabar_calculator::{
  address::{Address, AddressPayload},
  re_exports::{
    ckb_jsonrpc_types,
    secp256k1::{PublicKey, Secp256k1},
  },
  rpc::{Network, RPC},
};
use opticrum_calculator::{
  calculator::rent_per_block_to_annual_yield,
  config::{BLOCKS_PER_YEAR, CKB_DECIMAL, HESITATION_BLOCKS, ORDER_TO_MATCH_CAPACITY_RESERVE},
  types::{CompressedPubkey, MatchInfo, OrderArgs, OrderData, OrderInfo},
};
use opticrum_protocol::{MATCH_ARGS_LEN, ORDER_ARGS_LEN};
use opticrum_sdk::{
  dashboard::get_match_detail,
  deadline::compute_match_deadline,
  error::SdkError,
  sdk::OpticrumSdk,
  types::{
    MatchDeadline as SdkMatchDeadline, MatchHealth as SdkMatchHealth,
    YieldDistribution as SdkYieldDistribution,
  },
};

use diesel::sqlite::SqliteConnection;

use crate::backend::network::NetworkController;
use crate::backend::{SigningWallet, TxProgressReporter};
use crate::chain::chain_provider::ChainProvider;
use crate::db::orders_cache;
use crate::state::SidecarEntry;
use crate::wallet::{address, signer};
use crate::wire::*;

use super::traits::LiquidityBackend;

/// Hot-swap helper — production `RpcClient` copies the active endpoint; fakes no-op.
pub trait HotSwapRpc: RPC + Clone {
  fn assign_rpc(
    slot: &Mutex<Self>,
    from: &ckb_cinnabar_calculator::rpc::RpcClient,
  ) -> Result<(), CommandError>;
}

impl HotSwapRpc for ckb_cinnabar_calculator::rpc::RpcClient {
  fn assign_rpc(
    slot: &Mutex<Self>,
    from: &ckb_cinnabar_calculator::rpc::RpcClient,
  ) -> Result<(), CommandError> {
    *slot.lock().unwrap() = from.clone();
    Ok(())
  }
}

#[cfg(test)]
impl HotSwapRpc for ckb_cinnabar_calculator::simulation::FakeRpcClient {
  fn assign_rpc(
    _slot: &Mutex<Self>,
    _from: &ckb_cinnabar_calculator::rpc::RpcClient,
  ) -> Result<(), CommandError> {
    Ok(())
  }
}

// ---------------------------------------------------------------------------
// Wire mapping helpers (pure, unit-testable)
// ---------------------------------------------------------------------------

/// Outpoint → `0x{tx_hash}:{index}` (wire convention; SDK omits the `0x`).
fn outpoint_0x(tx_hash: &[u8], index: u32) -> String {
  format!("0x{}:{}", hex::encode(tx_hash), index)
}

/// CKB blocks per day at the ~12s default block interval — `BLOCKS_PER_YEAR ×
/// 4 / 1461 = 7,200` (mirrors the frontend's `BLOCKS_PER_DAY`).
const BLOCKS_PER_DAY: u64 = (BLOCKS_PER_YEAR * 4) / 1461;

/// Estimate an order's rental term (days) from the rent fund and the rate:
/// `blocks = rent_fund / rate; days = blocks / blocks_per_day`. The rent fund
/// is the on-chain cell capacity minus the pre-funded Order→Match reserve.
/// `None` when the rate is zero or the fund lasts less than a day.
fn estimate_order_rental_days(o: &OrderInfo) -> Option<u32> {
  let rate = o.order_data.shannons_per_block;
  if rate == 0 {
    return None;
  }
  let rent = o
    .ckb_capacity
    .saturating_sub(ORDER_TO_MATCH_CAPACITY_RESERVE);
  let days = (rent / rate) / BLOCKS_PER_DAY;
  if days == 0 {
    return None;
  }
  Some(days as u32)
}

fn map_sdk_err(e: SdkError) -> CommandError {
  match e {
    SdkError::Chain(m) => CommandError::chain(m),
    SdkError::Scan(m) => CommandError::scan(m),
    SdkError::Build(m) => CommandError::build(m),
    SdkError::InvalidInput(m) => CommandError::invalid_input(m),
    SdkError::AlreadyExhausted(v) => {
      CommandError::AlreadyExhausted(format!("match already exhausted (remaining {v} CKB)"))
    }
    SdkError::NotExhausted(v) => {
      CommandError::NotExhausted(format!("match not exhausted (remaining {v} CKB)"))
    }
    SdkError::NotAuthorized(m) => CommandError::NotAuthorized(m),
    SdkError::WithdrawWindowExpired => CommandError::WithdrawWindowExpired(
      "buyer withdrawal window has expired (12h after match creation)".into(),
    ),
    SdkError::HesitationNotElapsed => CommandError::HesitationNotElapsed(
      "seller cannot extract before the 12h hesitation window elapses".into(),
    ),
    SdkError::PartialWithdrawNotAllowed => CommandError::PartialWithdrawNotAllowed(
      "buyer may only withdraw ALL rent (a full dump), not a partial amount".into(),
    ),
    SdkError::InjectDuringHesitation => CommandError::InjectDuringHesitation(
      "fund injection is prohibited inside the 12h hesitation window".into(),
    ),
  }
}

fn wire_health(h: SdkMatchHealth) -> MatchHealth {
  match h {
    SdkMatchHealth::Healthy => MatchHealth::Healthy,
    SdkMatchHealth::Warning => MatchHealth::Warning,
    SdkMatchHealth::Critical => MatchHealth::Critical,
    SdkMatchHealth::Exhausted => MatchHealth::Exhausted,
  }
}

fn xudt_str(xudt: &Option<opticrum_calculator::types::Xudt>) -> String {
  xudt
    .as_ref()
    .map(|x| x.amount.to_string())
    .unwrap_or_else(|| "0".to_string())
}

/// `OrderInfo` → wire `LiquidityOrder`.
fn order_to_wire(o: &OrderInfo) -> LiquidityOrder {
  let capacity_shannons = o.order_data.channel_capacity;
  let capacity_ckb = capacity_shannons as f64 / CKB_DECIMAL as f64;
  LiquidityOrder {
    outpoint: outpoint_0x(&o.order_outpoint.tx_hash, o.order_outpoint.index),
    fiber_pubkey: hex::encode(o.order_args.fiber_pubkey.as_bytes()),
    channel_capacity_ckb: capacity_ckb,
    channel_capacity_shannons: capacity_shannons,
    shannons_per_block: o.order_data.shannons_per_block,
    annual_yield_bps: rent_per_block_to_annual_yield(
      o.order_data.shannons_per_block,
      capacity_shannons,
    ) * 10_000.0,
    // The stake (质押 = rent fund + occupation) is the order cell's total
    // on-chain capacity — always available, unlike the local sidecar.
    deposit_ckb: o.ckb_capacity as f64 / CKB_DECIMAL as f64,
    rental_days: None,
    fiber_address: o.fiber_address.clone(),
    xudt_amount: xudt_str(&o.xudt),
    created_at_ms: None,
    status: OrderStatus::Open,
  }
}

/// `MatchInfo` → wire `LiquidityMatch`. Block→ms timestamps come from the
/// provider (real mode: on-chain header time; tests: `MockChainProvider` → 0).
/// The channel capacity a match funds — the capacity of the funding cell the
/// match references via `channel_outpoint`. The match cell's own capacity is the
/// seller's stake (≈ the order's rent deposit), NOT the channel capacity; using
/// it for the wire `channel_capacity_ckb` / APY inflates the yield. Falls back
/// to the match cell capacity when the funding tx isn't reachable.
async fn match_channel_capacity(m: &MatchInfo, provider: &dyn ChainProvider) -> u64 {
  let tx_hash = hex::encode(m.match_args.channel_outpoint.tx_hash);
  let index = m.match_args.channel_outpoint.index as usize;
  match tokio::time::timeout(
    std::time::Duration::from_secs(5),
    provider.get_transaction(&tx_hash),
  )
  .await
  {
    Ok(Ok(tx)) => tx
      .outputs
      .get(index)
      .map(|o| o.capacity)
      .unwrap_or(m.ckb_capacity),
    _ => m.ckb_capacity,
  }
}

async fn match_to_wire(
  m: &MatchInfo,
  tip_block: u64,
  my_lock_hash: Option<[u8; 32]>,
  original_stake_ckb: Option<f64>,
  provider: &dyn ChainProvider,
) -> LiquidityMatch {
  let detail = get_match_detail(m, tip_block);
  let creation_ms = provider
    .get_block_timestamp(detail.match_creation_block)
    .await
    .unwrap_or(0);
  let expires_ms = if detail.shannons_per_block == 0 {
    u64::MAX
  } else {
    // Anchor on the real creation time, extend by blocks × 12s (robust for
    // far-future projection blocks that don't exist on-chain yet).
    let blocks = detail
      .projected_exhaustion_block
      .saturating_sub(detail.match_creation_block);
    creation_ms.saturating_add(blocks.saturating_mul(12_000))
  };
  // The wire capacity + APY are the channel capacity the order rents — same
  // basis as orders — so a match reads 8% like its order, not rent/stake.
  let channel_capacity = match_channel_capacity(m, provider).await;
  let annual_yield_bps = rent_per_block_to_annual_yield(
    detail.shannons_per_block,
    std::cmp::max(channel_capacity, 1),
  ) * 10_000.0;
  let deposit_ckb = m.ckb_capacity as f64 / CKB_DECIMAL as f64;
  // Hesitation window: the buyer may withdraw ALL rent (abandon the order)
  // only before the window elapses AND before the seller's first extraction —
  // mirrors the SDK `build_update_match` gate
  // (`last_extraction_block == 0 && tip − match_creation_block ≤ HESITATION_BLOCKS`).
  let in_window = m.match_data.last_extraction_block == 0
    && tip_block.saturating_sub(detail.match_creation_block) <= HESITATION_BLOCKS;
  let is_buyer = my_lock_hash == Some(m.match_args.order_args.buyer_lock_hash);
  let is_seller = my_lock_hash == Some(m.match_args.seller_lock_hash);
  let role = if is_buyer {
    MatchRole::Buyer
  } else if is_seller {
    MatchRole::Seller
  } else {
    MatchRole::Other
  };
  LiquidityMatch {
    outpoint: outpoint_0x(&m.match_outpoint.tx_hash, m.match_outpoint.index),
    channel_outpoint: outpoint_0x(
      &m.match_args.channel_outpoint.tx_hash,
      m.match_args.channel_outpoint.index,
    ),
    fiber_pubkey: hex::encode(m.match_args.order_args.fiber_pubkey.as_bytes()),
    channel_capacity_ckb: channel_capacity as f64 / CKB_DECIMAL as f64,
    shannons_per_block: detail.shannons_per_block,
    annual_yield_bps,
    // Same as orders: the stake is the match cell's total on-chain capacity.
    deposit_ckb,
    // Original rent pool from the lineage trace — falls back to the current
    // stake (extraction progress reads 0%) when the trace fails.
    original_stake_ckb: original_stake_ckb.unwrap_or(deposit_ckb),
    withdrawable_ckb: if is_buyer && in_window {
      deposit_ckb
    } else {
      0.0
    },
    xudt_amount: detail.xudt_amount.to_string(),
    created_at_ms: creation_ms,
    expires_at_ms: expires_ms,
    is_exhausted: detail.is_exhausted,
    health: wire_health(detail.health),
    last_extraction_block: detail.last_extraction_block,
    projected_exhaustion_block: detail.projected_exhaustion_block,
    seller_lock_hash: format!("0x{}", detail.seller_lock_hash),
    match_creation_block: detail.match_creation_block,
    hesitation_ends_at_ms: creation_ms.saturating_add(HESITATION_BLOCKS.saturating_mul(12_000)),
    role,
  }
}

fn order_summary_to_wire(o: &OrderInfo) -> OrderSummary {
  OrderSummary {
    outpoint: outpoint_0x(&o.order_outpoint.tx_hash, o.order_outpoint.index),
    channel_capacity_ckb: o.order_data.channel_capacity as f64 / CKB_DECIMAL as f64,
    shannons_per_block: o.order_data.shannons_per_block,
    annual_yield_bps: rent_per_block_to_annual_yield(
      o.order_data.shannons_per_block,
      o.order_data.channel_capacity,
    ) * 10_000.0,
    xudt_amount: xudt_str(&o.xudt),
    has_fiber_address: o.fiber_address.is_some(),
  }
}

fn match_summary_to_wire(m: &MatchInfo, tip: u64) -> MatchSummary {
  let capacity = std::cmp::max(m.ckb_capacity, 1);
  MatchSummary {
    match_outpoint: outpoint_0x(&m.match_outpoint.tx_hash, m.match_outpoint.index),
    channel_outpoint: outpoint_0x(
      &m.match_args.channel_outpoint.tx_hash,
      m.match_args.channel_outpoint.index,
    ),
    remaining_capacity_ckb: m.ckb_capacity as f64 / CKB_DECIMAL as f64,
    shannons_per_block: m.match_data.shannons_per_block,
    annual_yield_bps: rent_per_block_to_annual_yield(m.match_data.shannons_per_block, capacity)
      * 10_000.0,
    is_exhausted: m.is_exhausted(tip),
    last_extraction_block: m.match_data.last_extraction_block,
    projected_exhaustion_block: compute_match_deadline(m, tip).projected_exhaustion_block,
    xudt_amount: xudt_str(&m.xudt),
  }
}

/// SDK `MatchDeadline` → wire `MatchDeadline` (`0x` outpoints, rounded hours).
fn sdk_deadline_to_wire(d: SdkMatchDeadline) -> MatchDeadline {
  MatchDeadline {
    match_outpoint: format!("0x{}", d.match_outpoint),
    channel_outpoint: format!("0x{}", d.channel_outpoint),
    shannons_per_block: d.shannons_per_block,
    remaining_capacity_ckb: d.remaining_capacity_ckb,
    last_extraction_block: d.last_extraction_block,
    match_creation_block: d.match_creation_block,
    projected_exhaustion_block: d.projected_exhaustion_block,
    blocks_remaining: d.blocks_remaining,
    estimated_hours_remaining: d.estimated_hours_remaining.round() as u64,
    health: wire_health(d.health),
    extractable_now_ckb: d.extractable_now_ckb,
  }
}

fn wire_yield_distribution(yd: &SdkYieldDistribution) -> YieldDistribution {
  YieldDistribution {
    buckets: yd
      .buckets
      .iter()
      .map(|b| YieldBucket {
        low_bps: b.min_bps,
        high_bps: b.max_bps.unwrap_or(u64::MAX),
        count: b.count as u64,
        capacity_shannons: b.total_capacity_shannons,
      })
      .collect(),
  }
}

/// Aggregate orders + matches into the wire `DashboardData`.
fn build_dashboard(orders: &[OrderInfo], matches: &[MatchInfo], tip_block: u64) -> DashboardData {
  let total_orders = orders.len() as u64;
  let total_matches = matches.len() as u64;
  let active = matches
    .iter()
    .filter(|m| !m.is_exhausted(tip_block))
    .count() as u64;
  let exhausted = total_matches - active;

  // Demand / rate / yield are ORDER-side: only the Order cell carries
  // `channel_capacity` (Match cells discard it at match time), so a match-side
  // APY is not derivable on-chain. "Locked capacity" = total escrow held
  // across order + match cells (the CKB the protocol currently holds).
  let total_orders_capacity_shannons: u64 =
    orders.iter().map(|o| o.order_data.channel_capacity).sum();
  let total_capacity_locked_shannons: u64 = orders.iter().map(|o| o.ckb_capacity).sum::<u64>()
    + matches.iter().map(|m| m.ckb_capacity).sum::<u64>();

  let avg_shannons: u64 = if orders.is_empty() {
    0
  } else {
    let sum: u64 = orders.iter().map(|o| o.order_data.shannons_per_block).sum();
    (sum as f64 / orders.len() as f64).round() as u64
  };

  let mut yd = SdkYieldDistribution::standard();
  let mut total_yield_bps: f64 = 0.0;
  let yield_count = orders.len() as u64;
  for o in orders {
    let annual = rent_per_block_to_annual_yield(
      o.order_data.shannons_per_block,
      o.order_data.channel_capacity,
    );
    let bps = (annual * 10_000.0) as u64;
    yd.add(bps, o.order_data.channel_capacity);
    total_yield_bps += annual * 10_000.0;
  }
  let avg_annual_yield_bps = if yield_count > 0 {
    (total_yield_bps / yield_count as f64).round() as u64
  } else {
    0
  };

  let mut deadlines: Vec<MatchDeadline> = matches
    .iter()
    .filter(|m| !m.is_exhausted(tip_block))
    .map(|m| compute_match_deadline(m, tip_block))
    .map(sdk_deadline_to_wire)
    .collect();
  deadlines.sort_by_key(|d| d.blocks_remaining);

  DashboardData {
    tip_block,
    total_orders,
    total_matches,
    active_matches: active,
    exhausted_matches: exhausted,
    total_capacity_locked_shannons,
    total_orders_capacity_shannons,
    avg_shannons_per_block: avg_shannons,
    avg_annual_yield_bps,
    matches_near_exhaustion: deadlines,
    recent_orders: orders
      .iter()
      .rev()
      .take(10)
      .map(order_summary_to_wire)
      .collect(),
    recent_matches: matches
      .iter()
      .rev()
      .take(10)
      .map(|m| match_summary_to_wire(m, tip_block))
      .collect(),
    yield_distribution: wire_yield_distribution(&yd),
  }
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

/// Real liquidity backend, generic over the cinnabar RPC backend so tests can
/// drive it with `FakeRpcClient` (offline).
pub struct RealLiquidityBackend<T: RPC> {
  rpc: Mutex<T>,
  provider: Mutex<Arc<dyn ChainProvider>>,
  wallet: Arc<dyn SigningWallet>,
  testnet: AtomicBool,
  /// The current fiber node's identity pubkey (hex), shared with the node
  /// backend — new orders are attributed to it in `OrderArgs.fiber_pubkey`.
  node_pubkey: Arc<Mutex<Option<String>>>,
  /// Local metadata for orders this wallet published (`rental_days`/`created`
  /// aren't on-chain). In-memory in P4; DB persistence is a later refinement.
  sidecar: Mutex<HashMap<String, SidecarEntry>>,
  /// Original match stake per match lineage (key = match args hex, value =
  /// original rent pool in shannons). Immutable once a match exists, so a
  /// successful lineage walk is cached for the backend's lifetime.
  original_stake: Mutex<HashMap<String, u64>>,
  /// Personal-order cache (`cached_orders`). `Some` in production so `get_orders`
  /// reads cached cells instead of re-scanning the chain; `None` in tests (always
  /// scan, no persistence).
  db: Option<Mutex<SqliteConnection>>,
  /// Production network controller — enables hot-swap. `None` in unit tests.
  network: Option<Arc<NetworkController>>,
}

/// Run a blocking closure that internally awaits non-`Send` futures (the SDK
/// `build_*` methods box `dyn Operation` as non-`Send`) on a dedicated
/// current-thread runtime inside a blocking thread. The closure only captures
/// `Send` data; the non-`Send` future is created inside `block_on`.
async fn run_blocking<T: Send + 'static>(
  f: impl FnOnce() -> Result<T, CommandError> + Send + 'static,
) -> Result<T, CommandError> {
  tokio::task::spawn_blocking(f)
    .await
    .map_err(|e| CommandError::internal(format!("assembly thread panicked: {e}")))?
}

impl<T: RPC> RealLiquidityBackend<T> {
  pub fn new(
    rpc: T,
    provider: Arc<dyn ChainProvider>,
    wallet: Arc<dyn SigningWallet>,
    testnet: bool,
    node_pubkey: Arc<Mutex<Option<String>>>,
    db: Option<SqliteConnection>,
  ) -> Self {
    Self::new_with_network(rpc, provider, wallet, testnet, node_pubkey, db, None)
  }

  #[allow(clippy::too_many_arguments)]
  pub fn new_with_network(
    rpc: T,
    provider: Arc<dyn ChainProvider>,
    wallet: Arc<dyn SigningWallet>,
    testnet: bool,
    node_pubkey: Arc<Mutex<Option<String>>>,
    db: Option<SqliteConnection>,
    network: Option<Arc<NetworkController>>,
  ) -> Self {
    Self {
      rpc: Mutex::new(rpc),
      provider: Mutex::new(provider),
      wallet,
      testnet: AtomicBool::new(testnet),
      node_pubkey,
      sidecar: Mutex::new(HashMap::new()),
      original_stake: Mutex::new(HashMap::new()),
      db: db.map(Mutex::new),
      network,
    }
  }

  fn is_testnet(&self) -> bool {
    self.testnet.load(Ordering::SeqCst)
  }

  fn chain(&self) -> Chain {
    if self.is_testnet() {
      Chain::Testnet
    } else {
      Chain::Mainnet
    }
  }

  fn provider(&self) -> Arc<dyn ChainProvider> {
    self.provider.lock().unwrap().clone()
  }

  fn rpc_clone(&self) -> T
  where
    T: Clone,
  {
    self.rpc.lock().unwrap().clone()
  }

  /// Reject Opticrum market writes on mainnet (contracts not deployed yet).
  fn require_opticrum_network(&self) -> Result<(), CommandError> {
    if !self.is_testnet() {
      return Err(CommandError::unsupported_network(
        "Opticrum market is not available on mainnet yet",
      ));
    }
    Ok(())
  }

  /// Original rent pool (shannons) of a match — the first match cell's real
  /// capacity at `order_match` time. Cached per match args (immutable once a
  /// match exists); a failed trace returns `None` and is retried on a later scan.
  async fn original_stake_shannons(&self, m: &MatchInfo) -> Option<u64> {
    let key = hex::encode(m.match_args.to_bytes());
    if let Some(stake) = self.original_stake.lock().unwrap().get(&key) {
      return Some(*stake);
    }
    let stake = self.walk_original_stake(m).await?;
    self.original_stake.lock().unwrap().insert(key, stake);
    Some(stake)
  }

  /// Walk the match cell's producing-tx lineage back to the `order_match` tx
  /// and read the original match cell's raw capacity. Each extract/inject tx
  /// re-creates the match cell with the prior match cell (133-byte args) as an
  /// input; the origin tx consumes the order cell (65-byte args). The match
  /// cell's occupied capacity is constant across incarnations (same lock args +
  /// data), so `original = first_raw − (last_raw − current_ckb_capacity)`.
  async fn walk_original_stake(&self, m: &MatchInfo) -> Option<u64> {
    const MAX_HOPS: usize = 200;
    let match_args_hex = hex::encode(m.match_args.to_bytes());
    let mut outpoint = (
      hex::encode(m.match_outpoint.tx_hash),
      m.match_outpoint.index as usize,
    );
    let (mut last_raw, mut first_raw): (Option<u64>, Option<u64>) = (None, None);
    for _hop in 0..MAX_HOPS {
      let provider = self.provider();
      let tx = provider.get_transaction(&outpoint.0).await.ok()?;
      let raw = tx.outputs.get(outpoint.1)?.capacity;
      last_raw.get_or_insert(raw);
      let mut stepped = None;
      // Only the Opticrum-locked input matters — skip any input whose previous
      // cell can't be fetched or isn't an Opticrum cell (funding/change inputs).
      for inp in &tx.inputs {
        let Ok(prev_tx) = provider.get_transaction(&inp.previous_tx_hash).await else {
          continue;
        };
        let Some(prev) = prev_tx.outputs.get(inp.previous_index as usize) else {
          continue;
        };
        if prev.lock_args_len == MATCH_ARGS_LEN && prev.lock_args_hex == match_args_hex {
          stepped = Some((inp.previous_tx_hash.clone(), inp.previous_index as usize));
          break;
        }
        if prev.lock_args_len == ORDER_ARGS_LEN {
          // Order-cell input → this tx created the match; the output here is
          // the first (original) match cell.
          first_raw = Some(raw);
          break;
        }
      }
      match stepped {
        Some((hash, index)) => {
          outpoint = (hash, index);
        }
        None => break,
      }
    }
    let first = first_raw?;
    let last = last_raw?;
    let occupied = last.saturating_sub(m.ckb_capacity);
    Some(first.saturating_sub(occupied))
  }

  async fn tip_block(&self) -> Result<u64, CommandError>
  where
    T: Clone,
  {
    OpticrumSdk::new(self.rpc_clone())
      .get_tip_block()
      .await
      .map_err(map_sdk_err)
  }

  async fn scan_orders(&self) -> Result<Vec<OrderInfo>, CommandError>
  where
    T: Clone,
  {
    OpticrumSdk::new(self.rpc_clone())
      .scan_orders(None)
      .await
      .map_err(map_sdk_err)
  }

  async fn scan_matches(&self) -> Result<Vec<MatchInfo>, CommandError>
  where
    T: Clone,
  {
    OpticrumSdk::new(self.rpc_clone())
      .scan_matches(None)
      .await
      .map_err(map_sdk_err)
  }

  /// Read helpers that degrade to honest empty state when the chain is
  /// unreachable — the desktop stays usable offline instead of erroring.
  async fn tip_or_zero(&self) -> u64
  where
    T: Clone,
  {
    self.tip_block().await.unwrap_or(0)
  }

  async fn scan_orders_or_empty(&self) -> Vec<OrderInfo>
  where
    T: Clone,
  {
    match self.scan_orders().await {
      Ok(o) => o,
      Err(e) => {
        log::warn!("liquidity orders unavailable (node offline?): {e}");
        vec![]
      }
    }
  }

  async fn scan_matches_or_empty(&self) -> Vec<MatchInfo>
  where
    T: Clone,
  {
    match self.scan_matches().await {
      Ok(m) => m,
      Err(e) => {
        log::warn!("liquidity matches unavailable (node offline?): {e}");
        vec![]
      }
    }
  }

  /// Map scanned orders to their wire shape, merging the local sidecar and
  /// deriving on-chain creation time where the sidecar has no entry.
  async fn orders_to_wire(&self, orders: Vec<OrderInfo>) -> Vec<LiquidityOrder> {
    // Snapshot the sidecar so the async creation-time lookups don't hold the lock.
    let sidecar = self.sidecar.lock().unwrap().clone();
    let mut out = Vec::with_capacity(orders.len());
    for o in &orders {
      let mut w = order_to_wire(o);
      if let Some(e) = sidecar.get(&w.outpoint) {
        w.rental_days = Some(e.rental_days);
        w.created_at_ms = Some(e.created_at_ms);
      }
      // Orders that predate local tracking have no sidecar entry — the deposit
      // is on-chain (see `order_to_wire`), the creation time is derived from the
      // order's own tx on-chain, and the rental term is estimated from the rent
      // fund + rate (the buyer-chosen sidecar term wins when present).
      if w.created_at_ms.is_none() {
        w.created_at_ms = self.order_creation_ms(&o.order_outpoint.tx_hash).await;
      }
      if w.rental_days.is_none() {
        w.rental_days = estimate_order_rental_days(o);
      }
      out.push(w);
    }
    out
  }

  /// Replace the personal-order cache with `orders` and mark it primed.
  fn write_orders_cache(&self, orders: &[LiquidityOrder]) -> Result<(), CommandError> {
    if let Some(db) = &self.db {
      let mut conn = db.lock().unwrap();
      let chain = self.chain();
      orders_cache::replace_all(&mut conn, chain, orders)?;
      orders_cache::mark_primed(&mut conn, chain)?;
    }
    Ok(())
  }

  /// Wallet identity + key, erroring when locked.
  fn signing_identity(
    &self,
  ) -> Result<
    (
      String,
      ckb_cinnabar_calculator::re_exports::secp256k1::SecretKey,
    ),
    CommandError,
  > {
    self
      .wallet
      .signing_identity()
      .ok_or_else(|| CommandError::wallet_locked("wallet is locked"))
  }

  /// The wallet's lock script (`ScriptEx`) for signing inputs.
  fn wallet_lock_ex(&self, pk: &PublicKey) -> ckb_cinnabar_calculator::skeleton::ScriptEx {
    signer::secp256k1_lock_ex(&address::lock_arg_from_pubkey(pk))
  }

  /// The wallet's CKB address → cinnabar `Address` (buyer/seller role).
  fn wallet_address(&self, addr: &str) -> Result<Address, CommandError> {
    let lock_arg = address::lock_arg_from_address(addr)?;
    let script = signer::secp256k1_lock_ex(&lock_arg).to_script_unchecked();
    let network = if self.is_testnet() {
      Network::Testnet
    } else {
      Network::Mainnet
    };
    Ok(Address::new(network, AddressPayload::from(script)))
  }

  /// The wallet's own secp256k1 lock hash — the buyer/seller identity that
  /// tags the wallet's orders and matches. `None` when the wallet is locked
  /// (the key isn't available to derive the lock).
  fn wallet_lock_hash(&self) -> Option<[u8; 32]> {
    let (_, sk) = self.signing_identity().ok()?;
    let secp = Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &sk);
    Some(address::script_lock_hash(&address::lock_arg_from_pubkey(
      &pk,
    )))
  }

  /// Narrow order cells to those the wallet owns — `scope` defaults to `'mine'`
  /// (the buyer lock matches the wallet); `'all'` keeps everything.
  fn own_orders(&self, scope: Option<&str>, orders: Vec<OrderInfo>) -> Vec<OrderInfo> {
    if scope.is_none_or(|s| s == "mine") {
      match self.wallet_lock_hash() {
        Some(mine) => orders
          .into_iter()
          .filter(|o| o.order_args.buyer_lock_hash == mine)
          .collect(),
        // Locked wallet — honest empty set rather than leaking others' cells.
        None => Vec::new(),
      }
    } else {
      orders
    }
  }

  /// Narrow matches to ones the wallet is a party to (buyer OR seller).
  fn own_matches(&self, scope: Option<&str>, matches: Vec<MatchInfo>) -> Vec<MatchInfo> {
    if scope.is_none_or(|s| s == "mine") {
      match self.wallet_lock_hash() {
        Some(mine) => matches
          .into_iter()
          .filter(|m| {
            m.match_args.order_args.buyer_lock_hash == mine || m.match_args.seller_lock_hash == mine
          })
          .collect(),
        None => Vec::new(),
      }
    } else {
      matches
    }
  }

  /// Broadcast a signed transaction and wait for on-chain confirmation,
  /// returning the `0x`-hex tx hash. All liquidity writes go through here, so
  /// the command only resolves once the tx is confirmed. Reports the two
  /// observable phase boundaries (broadcasting → confirming) to the progress
  /// reporter so the frontend modal can walk its 3-step stepper.
  async fn broadcast(
    &self,
    tx: ckb_jsonrpc_types::Transaction,
    progress: &dyn TxProgressReporter,
  ) -> Result<String, CommandError> {
    let json = serde_json::to_string(&tx).map_err(|e| CommandError::internal(e.to_string()))?;
    progress.report(TxProgress {
      phase: TxPhase::Broadcasting,
      tx_hash: None,
    });
    let hash = self.provider().send_transaction(&hex::encode(json)).await?;
    progress.report(TxProgress {
      phase: TxPhase::Confirming,
      tx_hash: Some(hash.clone()),
    });
    self
      .provider()
      .wait_for_confirmation(&hash, 1, Some(std::time::Duration::from_secs(300)))
      .await?;
    Ok(hash)
  }

  /// Find the output index of an Opticrum cell whose lock args match `args`.
  fn find_output_index(tx: &ckb_jsonrpc_types::Transaction, args: &[u8]) -> Option<usize> {
    tx.outputs
      .iter()
      .position(|o| o.lock.args.as_bytes().to_vec() == args)
  }

  /// Creation time (ms) of an order's creation tx, derived on-chain from the
  /// tx's block. `None` when the tx isn't confirmed yet (or the provider can't
  /// see it).
  async fn order_creation_ms(&self, tx_hash: &[u8; 32]) -> Option<u64> {
    // Plain 64-hex, no "0x" prefix — `H256::from_str` in ckb-fixed-hash expects
    // exactly 64 chars and rejects the prefix (the extraction path relies on this).
    let tx_hash_hex = hex::encode(tx_hash);
    let provider = self.provider();
    let info = provider.get_transaction(&tx_hash_hex).await.ok()?;
    if info.block_number == 0 {
      return None;
    }
    Some(
      provider
        .get_block_timestamp(info.block_number)
        .await
        .unwrap_or(0),
    )
  }
}

#[async_trait]
impl<T: HotSwapRpc + Send + Sync + 'static> LiquidityBackend for RealLiquidityBackend<T> {
  async fn get_dashboard(&self) -> Result<DashboardData, CommandError> {
    if !self.is_testnet() {
      return Ok(build_dashboard(&[], &[], 0));
    }
    let tip = self.tip_or_zero().await;
    let orders = self.scan_orders_or_empty().await;
    let matches = self.scan_matches_or_empty().await;
    Ok(build_dashboard(&orders, &matches, tip))
  }

  async fn get_orders(&self, scope: Option<String>) -> Result<Vec<LiquidityOrder>, CommandError> {
    if !self.is_testnet() {
      return Ok(vec![]);
    }
    // Personal orders ('mine', the default) read from the local cache once a
    // scan has primed it — order outpoints are immutable, so loading skips the
    // expensive chain scan until the user explicitly refreshes.
    if scope.is_none_or(|s| s == "mine") {
      // A locked wallet can't derive its lock script, so it can't determine
      // which cells are its own — return nothing (and don't leak the cache).
      if self.wallet_lock_hash().is_none() {
        return Ok(vec![]);
      }
      if let Some(db) = &self.db {
        let mut conn = db.lock().unwrap();
        let chain = self.chain();
        if orders_cache::is_primed(&mut conn, chain)? {
          return orders_cache::list_orders(&mut conn, chain);
        }
      }
      // First run / cache not primed — scan the chain. On failure return empty
      // WITHOUT priming, so the next load retries instead of freezing on a bad
      // cache (an offline first run must not look like "0 orders").
      let orders = match self.scan_orders().await {
        Ok(o) => o,
        Err(e) => {
          log::warn!("liquidity orders unavailable (node offline?): {e}");
          return Ok(vec![]);
        }
      };
      let orders = self.own_orders(Some("mine"), orders);
      let wired = self.orders_to_wire(orders).await;
      self.write_orders_cache(&wired)?;
      return Ok(wired);
    }
    // 'all' — scan, no caching (cache is personal-order scoped).
    let orders = self.scan_orders_or_empty().await;
    let orders = self.own_orders(Some("all"), orders);
    Ok(self.orders_to_wire(orders).await)
  }

  async fn refresh_orders(&self) -> Result<Vec<LiquidityOrder>, CommandError> {
    if !self.is_testnet() {
      return Ok(vec![]);
    }
    // A locked wallet can't derive its lock script, so it can't own cells —
    // and rewriting the cache here would erase the wallet's orders (they only
    // reappear after a manual re-scan once it unlocks). Return nothing without
    // touching the cache, mirroring `get_orders`.
    if self.wallet_lock_hash().is_none() {
      return Ok(vec![]);
    }
    // Re-scan the chain and sync the cache. Failure returns empty without
    // touching the cache (stale data stays readable offline).
    let orders = match self.scan_orders().await {
      Ok(o) => o,
      Err(e) => {
        log::warn!("liquidity refresh unavailable (node offline?): {e}");
        return Ok(vec![]);
      }
    };
    let orders = self.own_orders(Some("mine"), orders);
    let wired = self.orders_to_wire(orders).await;
    self.write_orders_cache(&wired)?;
    Ok(wired)
  }

  async fn get_matches(&self, scope: Option<String>) -> Result<Vec<LiquidityMatch>, CommandError> {
    if !self.is_testnet() {
      return Ok(vec![]);
    }
    let tip = self.tip_or_zero().await;
    let matches = self.scan_matches_or_empty().await;
    let matches = self.own_matches(scope.as_deref(), matches);
    // The wallet's lock hash determines each match's role (buyer/seller) — for
    // non-`'mine'` scans it is `None` and every match maps to `Other`.
    let my_lock = self.wallet_lock_hash();
    let provider = self.provider();
    let mut out = Vec::with_capacity(matches.len());
    for m in &matches {
      // Original stake via lineage trace (cached per match args). `None` → the
      // mapper falls back to the current stake (extraction progress reads 0%).
      let original = self.original_stake_shannons(m).await;
      out.push(
        match_to_wire(
          m,
          tip,
          my_lock,
          original.map(|s| s as f64 / CKB_DECIMAL as f64),
          provider.as_ref(),
        )
        .await,
      );
    }
    Ok(out)
  }

  async fn get_matches_near_exhaustion(
    &self,
    blocks_threshold: u64,
  ) -> Result<Vec<MatchDeadline>, CommandError> {
    if !self.is_testnet() {
      return Ok(vec![]);
    }
    let tip = self.tip_or_zero().await;
    let matches = self.scan_matches_or_empty().await;
    let mut deadlines: Vec<MatchDeadline> = matches
      .iter()
      .map(|m| compute_match_deadline(m, tip))
      .filter(|d| d.blocks_remaining <= blocks_threshold)
      .map(sdk_deadline_to_wire)
      .collect();
    deadlines.sort_by_key(|d| d.blocks_remaining);
    Ok(deadlines)
  }

  async fn publish_order(
    &self,
    capacity_shannons: u64,
    shannons_per_block: u64,
    rent_capacity_shannons: u64,
    rental_days: u32,
    fiber_address: Option<String>,
    progress: &dyn TxProgressReporter,
  ) -> Result<PublishOrderResult, CommandError> {
    self.require_opticrum_network()?;
    let _op = self
      .network
      .as_ref()
      .map(|n| n.begin_op())
      .transpose()?;
    if capacity_shannons == 0 || rent_capacity_shannons == 0 {
      return Err(CommandError::invalid_input(
        "capacity and rent must be greater than 0",
      ));
    }
    // The closure below moves `fiber_address` — keep a copy for the cache entry.
    let fiber_address_cached = fiber_address.clone();
    let (addr, sk) = self.signing_identity()?;
    let buyer = self.wallet_address(&addr)?;
    let secp = Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &sk);
    let lock_arg = address::lock_arg_from_pubkey(&pk);
    // The order cell's embedded fiber pubkey is the CURRENT fiber node's
    // identity — orders created under an older/different node key are flagged
    // as "legacy" in the UI. Authorization stays with the wallet's buyer lock
    // hash (built below), so this only affects attribution, not ownership.
    let node_pubkey_hex = self.node_pubkey.lock().unwrap().clone().ok_or_else(|| {
      CommandError::NodeNotRunning("fiber node is not running — start it before publishing".into())
    })?;
    let node_pk = CompressedPubkey::from_slice(
      &hex::decode(&node_pubkey_hex)
        .map_err(|e| CommandError::internal(format!("node pubkey hex: {e}")))?,
    )
    .map_err(|e| CommandError::internal(format!("node pubkey parse: {e}")))?;
    let order_args = OrderArgs::new(node_pk, address::script_lock_hash(&lock_arg));
    let order_data = OrderData::new(0, capacity_shannons, shannons_per_block);
    let sender_lock = self.wallet_lock_ex(&pk);
    let args_bytes = order_args.to_bytes();

    let rpc = self.rpc_clone();
    let tx = run_blocking(move || {
      let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| CommandError::internal(format!("assembly rt: {e}")))?;
      rt.block_on(async {
        let sdk = OpticrumSdk::new(rpc);
        let mut skel = sdk
          .build_create_order(
            buyer,
            &order_args,
            &order_data,
            rent_capacity_shannons,
            None,
            fiber_address,
          )
          .await
          .map_err(map_sdk_err)?;
        signer::sign_skeleton(&mut skel, &sender_lock, &sk)?;
        Ok(skel.into())
      })
    })
    .await?;

    // Order cell is the output whose lock args match OrderArgs.
    let order_index = Self::find_output_index(&tx, &args_bytes).unwrap_or(0);
    let tx_hash = self.broadcast(tx, progress).await?;
    let outpoint = format!("0x{}:{}", tx_hash.trim_start_matches("0x"), order_index);

    self.sidecar.lock().unwrap().insert(
      outpoint.clone(),
      SidecarEntry {
        rental_days,
        created_at_ms: crate::util::now_ms(),
        deposit_ckb: rent_capacity_shannons as f64 / CKB_DECIMAL as f64,
      },
    );
    // Persist the new order into the personal cache immediately — its outpoint
    // is immutable, so the next load shows it without a re-scan.
    let created_at_ms = crate::util::now_ms();
    let new_order = LiquidityOrder {
      outpoint: outpoint.clone(),
      fiber_pubkey: node_pubkey_hex,
      channel_capacity_ckb: capacity_shannons as f64 / CKB_DECIMAL as f64,
      channel_capacity_shannons: capacity_shannons,
      shannons_per_block,
      annual_yield_bps: rent_per_block_to_annual_yield(shannons_per_block, capacity_shannons)
        * 10_000.0,
      deposit_ckb: rent_capacity_shannons as f64 / CKB_DECIMAL as f64,
      rental_days: Some(rental_days),
      fiber_address: fiber_address_cached,
      xudt_amount: "0".to_string(),
      created_at_ms: Some(created_at_ms),
      status: OrderStatus::Open,
    };
    if let Some(db) = &self.db {
      let mut conn = db.lock().unwrap();
      let chain = self.chain();
      orders_cache::upsert_order(&mut conn, chain, &new_order)?;
      orders_cache::mark_primed(&mut conn, chain)?;
    }
    Ok(PublishOrderResult {
      order_outpoint: outpoint,
      tx_hash,
    })
  }

  async fn cancel_order(
    &self,
    outpoint: String,
    progress: &dyn TxProgressReporter,
  ) -> Result<TxHashResult, CommandError> {
    self.require_opticrum_network()?;
    let _op = self
      .network
      .as_ref()
      .map(|n| n.begin_op())
      .transpose()?;
    let (addr, sk) = self.signing_identity()?;
    let buyer = self.wallet_address(&addr)?;
    let secp = Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &sk);
    let sender_lock = self.wallet_lock_ex(&pk);

    let orders = self.scan_orders().await?;
    let order_info = orders
      .into_iter()
      .find(|o| outpoint_0x(&o.order_outpoint.tx_hash, o.order_outpoint.index) == outpoint)
      .ok_or_else(|| CommandError::invalid_input("order not found on-chain"))?;

    let rpc = self.rpc_clone();
    let tx = run_blocking(move || {
      let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| CommandError::internal(format!("assembly rt: {e}")))?;
      rt.block_on(async {
        let sdk = OpticrumSdk::new(rpc);
        let mut skel = sdk
          .build_cancel_order(buyer, order_info)
          .await
          .map_err(map_sdk_err)?;
        signer::sign_skeleton(&mut skel, &sender_lock, &sk)?;
        Ok(skel.into())
      })
    })
    .await?;

    let tx_hash = self.broadcast(tx, progress).await?;
    Ok(TxHashResult { tx_hash })
  }

  async fn inject_deposit(
    &self,
    match_outpoint: String,
    amount_shannons: u64,
    progress: &dyn TxProgressReporter,
  ) -> Result<TxHashResult, CommandError> {
    self.require_opticrum_network()?;
    let _op = self
      .network
      .as_ref()
      .map(|n| n.begin_op())
      .transpose()?;
    if amount_shannons == 0 {
      return Err(CommandError::invalid_input("amount must be greater than 0"));
    }
    self
      .update_match(match_outpoint, amount_shannons as i64, progress)
      .await
  }

  async fn withdraw_deposit(
    &self,
    match_outpoint: String,
    amount_shannons: u64,
    progress: &dyn TxProgressReporter,
  ) -> Result<TxHashResult, CommandError> {
    self.require_opticrum_network()?;
    let _op = self
      .network
      .as_ref()
      .map(|n| n.begin_op())
      .transpose()?;
    if amount_shannons == 0 {
      return Err(CommandError::invalid_input("amount must be greater than 0"));
    }
    self
      .update_match(match_outpoint, -(amount_shannons as i64), progress)
      .await
  }

  async fn extract_spent_match(
    &self,
    match_outpoint: String,
    progress: &dyn TxProgressReporter,
  ) -> Result<ExtractResult, CommandError> {
    self.require_opticrum_network()?;
    let _op = self
      .network
      .as_ref()
      .map(|n| n.begin_op())
      .transpose()?;
    let (addr, sk) = self.signing_identity()?;
    let seller = self.wallet_address(&addr)?;
    let secp = Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &sk);
    let sender_lock = self.wallet_lock_ex(&pk);

    let tip = self.tip_block().await?;
    let matches = self.scan_matches().await?;
    let match_info = matches
      .into_iter()
      .find(|m| outpoint_0x(&m.match_outpoint.tx_hash, m.match_outpoint.index) == match_outpoint)
      .ok_or_else(|| CommandError::invalid_input("match not found on-chain"))?;
    if !match_info.is_exhausted(tip) {
      return Err(CommandError::NotExhausted(
        "match still has remaining capacity".into(),
      ));
    }
    let returned_ckb = match_info.ckb_capacity as f64 / CKB_DECIMAL as f64;

    let rpc = self.rpc_clone();
    let tx = run_blocking(move || {
      let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| CommandError::internal(format!("assembly rt: {e}")))?;
      rt.block_on(async {
        let sdk = OpticrumSdk::new(rpc);
        let mut skel = sdk
          .build_extract_rent(seller, match_info, tip)
          .await
          .map_err(map_sdk_err)?;
        signer::sign_skeleton(&mut skel, &sender_lock, &sk)?;
        Ok(skel.into())
      })
    })
    .await?;

    let tx_hash = self.broadcast(tx, progress).await?;
    Ok(ExtractResult {
      tx_hash,
      returned_ckb,
    })
  }

  fn apply_network(&self, chain: Chain) -> Result<(), CommandError> {
    if self.chain() == chain {
      return Ok(());
    }
    let Some(ctrl) = &self.network else {
      return Err(CommandError::internal(
        "network switching is unavailable in this backend",
      ));
    };
    let resources = ctrl.resources_for(chain);
    *self.provider.lock().unwrap() = resources.provider.clone();
    self.testnet.store(resources.testnet, Ordering::SeqCst);
    T::assign_rpc(&self.rpc, &resources.rpc)?;
    Ok(())
  }
}

impl<T: Clone + RPC + 'static> RealLiquidityBackend<T> {
  /// Shared buyer update-match (inject +/withdraw − capacity) path.
  async fn update_match(
    &self,
    match_outpoint: String,
    capacity_delta: i64,
    progress: &dyn TxProgressReporter,
  ) -> Result<TxHashResult, CommandError> {
    let (addr, sk) = self.signing_identity()?;
    let buyer = self.wallet_address(&addr)?;
    let secp = Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &sk);
    let sender_lock = self.wallet_lock_ex(&pk);

    let matches = self.scan_matches().await?;
    let match_info = matches
      .into_iter()
      .find(|m| outpoint_0x(&m.match_outpoint.tx_hash, m.match_outpoint.index) == match_outpoint)
      .ok_or_else(|| CommandError::invalid_input("match not found on-chain"))?;
    let new_xudt = match_info.xudt.as_ref().map(|x| x.amount).unwrap_or(0);
    // Protocol: no partial withdrawals — a withdraw is a FULL dump of all rent
    // (xUDT + unoccupied capacity); an inject passes the caller's delta through.
    let (new_xudt, capacity_delta) = if capacity_delta < 0 {
      (0u128, -(match_info.ckb_capacity as i64))
    } else {
      (new_xudt, capacity_delta)
    };

    // Tip is required for the buyer withdrawal-window check (HeaderDep[0]).
    let tip_block = self.tip_block().await?;
    let rpc = self.rpc_clone();
    let tx = run_blocking(move || {
      let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| CommandError::internal(format!("assembly rt: {e}")))?;
      rt.block_on(async {
        let sdk = OpticrumSdk::new(rpc);
        let mut skel = sdk
          .build_update_match(buyer, match_info, new_xudt, capacity_delta, tip_block)
          .await
          .map_err(map_sdk_err)?;
        signer::sign_skeleton(&mut skel, &sender_lock, &sk)?;
        Ok(skel.into())
      })
    })
    .await?;

    let tx_hash = self.broadcast(tx, progress).await?;
    Ok(TxHashResult { tx_hash })
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::backend::{NoopTxProgressReporter, SigningWallet};
  use crate::chain::chain_provider::{
    MockChainProvider, TransactionInfo, TxInputInfo, TxOutputInfo,
  };
  use ckb_cinnabar_calculator::re_exports::secp256k1::SecretKey;
  use opticrum_calculator::types::{CompressedPubkey, MatchArgs, MatchData, OrderArgs, OrderData};
  use opticrum_protocol::OutPoint;

  /// Stub provider: reports every tx in a fixed block with a fixed block
  /// timestamp, so `order_creation_ms` is testable without a chain.
  struct TimestampStubProvider {
    tx_block: u64,
    block_ts: u64,
  }

  #[async_trait]
  impl ChainProvider for TimestampStubProvider {
    async fn get_tip_block_number(&self) -> Result<u64, CommandError> {
      Ok(self.tx_block)
    }
    async fn send_transaction(&self, _tx_hex: &str) -> Result<String, CommandError> {
      Ok("0x00".into())
    }
    async fn get_transaction(&self, tx_hash: &str) -> Result<TransactionInfo, CommandError> {
      // Mirror the real provider: H256::from_str wants exactly 64 hex chars
      // (no "0x" prefix) — guards against regressions like `0x`-prefixed hashes.
      if tx_hash.len() != 64 {
        return Err(CommandError::chain(format!(
          "invalid tx hash length {} (want 64, no 0x prefix)",
          tx_hash.len()
        )));
      }
      Ok(TransactionInfo {
        tx_hash: tx_hash.to_string(),
        block_number: self.tx_block,
        inputs: Vec::new(),
        outputs: Vec::new(),
      })
    }
    async fn get_block_timestamp(&self, block_number: u64) -> Result<u64, CommandError> {
      Ok(if block_number == self.tx_block {
        self.block_ts
      } else {
        0
      })
    }
  }

  /// Test wallet: unlocked, deterministic key from a fixed seed.
  struct MockSigningWallet(SecretKey);

  impl MockSigningWallet {
    fn test_key() -> SecretKey {
      // m/44'/309'/0'/0/0 under the all-abandon mnemonic.
      let mnemonic = bip39::Mnemonic::parse(
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      )
      .unwrap();
      let seed = crate::wallet::hd_wallet::mnemonic_to_seed(&mnemonic, "");
      let (sk, _) = crate::wallet::hd_wallet::derive_path(&seed, "m/44'/309'/0'/0/0").unwrap();
      sk
    }
  }

  impl SigningWallet for MockSigningWallet {
    fn is_unlocked(&self) -> bool {
      true
    }
    fn signing_identity(&self) -> Option<(String, SecretKey)> {
      let secp = Secp256k1::new();
      let pk = PublicKey::from_secret_key(&secp, &self.0);
      Some((
        crate::wallet::address::ckb_address_from_pubkey(&pk, true),
        self.0,
      ))
    }
  }

  /// Locked wallet — `own_orders`/`own_matches` degrade to an honest empty set.
  struct LockedSigningWallet;

  impl SigningWallet for LockedSigningWallet {
    fn is_unlocked(&self) -> bool {
      false
    }
    fn signing_identity(&self) -> Option<(String, SecretKey)> {
      None
    }
  }

  fn test_backend() -> RealLiquidityBackend<ckb_cinnabar_calculator::simulation::FakeRpcClient> {
    RealLiquidityBackend::new(
      ckb_cinnabar_calculator::simulation::FakeRpcClient::default(),
      Arc::new(MockChainProvider::new()),
      Arc::new(MockSigningWallet(MockSigningWallet::test_key())),
      true,
      Arc::new(Mutex::new(None)), // no node pubkey in tests
      None,                       // tests: no cache — always scan
    )
  }

  fn test_order() -> OrderInfo {
    OrderInfo {
      order_args: OrderArgs::new(CompressedPubkey::new([0x02; 33]), [0xaa; 32]),
      order_data: OrderData::new(0, 50_000_000_000_000, 100_000),
      xudt: None,
      ckb_capacity: 51_000_000_000_000,
      order_outpoint: OutPoint::new([0x11; 32], 0),
      fiber_address: Some("/ip4/1.2.3.4/tcp/8115".to_string()),
    }
  }

  fn test_match(exhausted: bool) -> MatchInfo {
    let order_args = OrderArgs::new(CompressedPubkey::new([0x02; 33]), [0xaa; 32]);
    MatchInfo {
      match_args: MatchArgs::new(order_args, OutPoint::new([0x22; 32], 0), [0xbb; 32]),
      match_data: MatchData::new(0, 100_000),
      xudt: None,
      ckb_capacity: if exhausted { 0 } else { 50_000_000_000_000 },
      match_outpoint: OutPoint::new([0x33; 32], 1),
      match_current_block: 12_000_000,
    }
  }

  #[test]
  fn order_to_wire_maps_fields() {
    let o = test_order();
    let w = order_to_wire(&o);
    assert_eq!(w.outpoint, format!("0x{}:0", hex::encode([0x11; 32])));
    assert_eq!(w.channel_capacity_ckb, 500_000.0);
    assert_eq!(w.channel_capacity_shannons, 50_000_000_000_000);
    assert_eq!(w.shannons_per_block, 100_000);
    assert_eq!(w.rental_days, None);
    assert_eq!(w.fiber_address.as_deref(), Some("/ip4/1.2.3.4/tcp/8115"));
    assert_eq!(w.xudt_amount, "0");
    assert_eq!(w.created_at_ms, None);
    // The stake (质押) is the order cell's on-chain capacity: test_order locks
    // 51_000_000_000_000 shannons = 510,000 CKB.
    assert_eq!(w.deposit_ckb, 510_000.0);
  }

  #[test]
  fn estimate_order_rental_days_from_rate_and_rent() {
    // test_order: rate 100,000 sh/block, ckb_capacity 51e12 shannons → the rent
    // fund lasts 510M blocks ≈ 70,000+ days at 7,200 blocks/day.
    let days = estimate_order_rental_days(&test_order());
    assert!(days.is_some());
    assert!(days.unwrap() > 0);

    // Zero rate → cannot estimate.
    let mut no_rate = test_order();
    no_rate.order_data = OrderData::new(0, 50_000_000_000_000, 0);
    assert!(estimate_order_rental_days(&no_rate).is_none());
  }

  #[tokio::test]
  async fn order_creation_ms_reads_block_timestamp() {
    let backend = RealLiquidityBackend::new(
      ckb_cinnabar_calculator::simulation::FakeRpcClient::default(),
      Arc::new(TimestampStubProvider {
        tx_block: 42,
        block_ts: 1_785_289_217_000,
      }),
      Arc::new(MockSigningWallet(MockSigningWallet::test_key())),
      true,
      Arc::new(Mutex::new(None)),
      None,
    );
    // Creation time = the order tx's block timestamp, derived on-chain.
    assert_eq!(
      backend.order_creation_ms(&[0x11; 32]).await,
      Some(1_785_289_217_000)
    );
  }

  #[test]
  fn own_orders_filters_to_the_wallet() {
    let backend = test_backend();
    let mine = backend.wallet_lock_hash().unwrap();

    let mut mine_order = test_order();
    mine_order.order_args = OrderArgs::new(CompressedPubkey::new([0x02; 33]), mine);
    mine_order.order_outpoint = OutPoint::new([0x10; 32], 0);

    let mut foreign_order = test_order();
    foreign_order.order_args = OrderArgs::new(CompressedPubkey::new([0x02; 33]), [0xaa; 32]);
    foreign_order.order_outpoint = OutPoint::new([0x11; 32], 0);

    let orders = vec![mine_order.clone(), foreign_order.clone()];

    // Default scope is "mine"; explicit "mine" matches it.
    assert_eq!(backend.own_orders(None, orders.clone()).len(), 1);
    assert_eq!(backend.own_orders(Some("mine"), orders.clone()).len(), 1);
    // "all" keeps every cell.
    assert_eq!(backend.own_orders(Some("all"), orders).len(), 2);
  }

  #[test]
  fn own_matches_keeps_buyer_or_seller() {
    let backend = test_backend();
    let mine = backend.wallet_lock_hash().unwrap();

    // Wallet is the buyer.
    let mut buyer = test_match(false);
    buyer.match_args = MatchArgs::new(
      OrderArgs::new(CompressedPubkey::new([0x02; 33]), mine),
      OutPoint::new([0x22; 32], 0),
      [0xbb; 32],
    );
    buyer.match_outpoint = OutPoint::new([0x30; 32], 0);

    // Wallet is the seller (liquidity provider).
    let mut seller = test_match(false);
    seller.match_args = MatchArgs::new(
      OrderArgs::new(CompressedPubkey::new([0x02; 33]), [0xaa; 32]),
      OutPoint::new([0x22; 32], 1),
      mine,
    );
    seller.match_outpoint = OutPoint::new([0x31; 32], 0);

    // Neither party — excluded under "mine".
    let mut foreign = test_match(false);
    foreign.match_outpoint = OutPoint::new([0x32; 32], 0);

    let matches = vec![buyer, seller, foreign];
    assert_eq!(backend.own_matches(Some("mine"), matches.clone()).len(), 2);
    assert_eq!(backend.own_matches(Some("all"), matches).len(), 3);
  }

  #[test]
  fn locked_wallet_yields_empty_mine() {
    let backend = RealLiquidityBackend::new(
      ckb_cinnabar_calculator::simulation::FakeRpcClient::default(),
      Arc::new(MockChainProvider::new()),
      Arc::new(LockedSigningWallet),
      true,
      Arc::new(Mutex::new(None)),
      None,
    );
    assert_eq!(
      backend.own_orders(Some("mine"), vec![test_order()]).len(),
      0
    );
    assert_eq!(
      backend
        .own_matches(Some("mine"), vec![test_match(false)])
        .len(),
      0
    );
  }

  #[tokio::test]
  async fn match_to_wire_maps_fields() {
    let provider = MockChainProvider::new();
    let m = test_match(false);
    // Wallet lock = the match's buyer lock ([0xaa; 32]).
    let w = match_to_wire(&m, 12_000_100, Some([0xaa; 32]), Some(500_000.0), &provider).await;
    assert_eq!(w.outpoint, format!("0x{}:1", hex::encode([0x33; 32])));
    assert_eq!(
      w.channel_outpoint,
      format!("0x{}:0", hex::encode([0x22; 32]))
    );
    assert_eq!(w.shannons_per_block, 100_000);
    assert!(!w.is_exhausted);
    assert_eq!(w.health, MatchHealth::Healthy);
    assert_eq!(w.seller_lock_hash, format!("0x{}", hex::encode([0xbb; 32])));
    // Mock provider → timestamp 0; expires = creation + blocks_elapsed × 12s.
    assert_eq!(w.created_at_ms, 0);
    assert!(w.expires_at_ms > 0);
    assert_eq!(w.original_stake_ckb, 500_000.0);
  }

  #[tokio::test]
  async fn match_to_wire_hesitation_role_and_window() {
    let provider = MockChainProvider::new();
    // Buyer inside the window (tip − creation = 100 blocks < 3600) → Buyer
    // role, the full stake is withdrawable, and the ms deadline is set.
    let w = match_to_wire(
      &test_match(false),
      12_000_100,
      Some([0xaa; 32]),
      Some(500_000.0),
      &provider,
    )
    .await;
    assert_eq!(w.role, MatchRole::Buyer);
    assert_eq!(w.match_creation_block, 12_000_000);
    assert_eq!(w.withdrawable_ckb, 500_000.0);
    assert_eq!(w.hesitation_ends_at_ms, 3_600 * 12_000);
    assert_eq!(w.original_stake_ckb, 500_000.0);

    // Buyer once the window has passed → no longer withdrawable.
    let w = match_to_wire(
      &test_match(false),
      12_000_000 + 9_999,
      Some([0xaa; 32]),
      Some(500_000.0),
      &provider,
    )
    .await;
    assert_eq!(w.role, MatchRole::Buyer);
    assert_eq!(w.withdrawable_ckb, 0.0);

    // Wallet is the seller → Seller role, never withdrawable.
    let w = match_to_wire(
      &test_match(false),
      12_000_100,
      Some([0xbb; 32]),
      Some(500_000.0),
      &provider,
    )
    .await;
    assert_eq!(w.role, MatchRole::Seller);
    assert_eq!(w.withdrawable_ckb, 0.0);

    // Unrelated lock hash → Other.
    let w = match_to_wire(
      &test_match(false),
      12_000_100,
      Some([0xcc; 32]),
      Some(500_000.0),
      &provider,
    )
    .await;
    assert_eq!(w.role, MatchRole::Other);
    assert_eq!(w.withdrawable_ckb, 0.0);
  }

  #[tokio::test]
  async fn walk_original_stake_traces_match_lineage() {
    // Two-hop lineage: order (tx 0x55…) → first match (tx 0x44…) → current
    // match (tx 0x33…, = test_match's outpoint, index 1). The match cell's
    // occupied capacity is constant, so
    //   original = first_raw − (last_raw − ckb_capacity).
    let m = test_match(false);
    let match_args_hex = hex::encode(m.match_args.to_bytes());
    let order_args_hex = hex::encode(m.match_args.order_args.to_bytes());
    let occupied = 100_000_000u64; // 1 CKB of occupied capacity
    let current_raw = m.ckb_capacity + occupied;
    let original_stake = 49_000_000_000_000u64; // 490_000 CKB
    let first_raw = original_stake + occupied;

    fn cell(capacity: u64, args: String, args_len: usize) -> TxOutputInfo {
      TxOutputInfo {
        capacity,
        lock_code_hash: String::new(),
        lock_hash_type: "Type".into(),
        lock_args_hex: args,
        lock_args_len: args_len,
        data_hex: String::new(),
      }
    }

    let tx1 = TransactionInfo {
      tx_hash: "33".repeat(32),
      block_number: 12_000_100,
      inputs: vec![TxInputInfo {
        previous_tx_hash: "44".repeat(32),
        previous_index: 0,
      }],
      outputs: vec![
        cell(1_000, String::new(), 0),
        cell(current_raw, match_args_hex.clone(), 133),
      ],
    };
    let tx0 = TransactionInfo {
      tx_hash: "44".repeat(32),
      block_number: 12_000_000,
      inputs: vec![TxInputInfo {
        previous_tx_hash: "55".repeat(32),
        previous_index: 0,
      }],
      outputs: vec![cell(first_raw, match_args_hex, 133)],
    };
    let order_tx = TransactionInfo {
      tx_hash: "55".repeat(32),
      block_number: 12_000_000,
      inputs: Vec::new(),
      outputs: vec![cell(original_stake, order_args_hex, 65)],
    };

    struct LineageProvider {
      tx1: TransactionInfo,
      tx0: TransactionInfo,
      order_tx: TransactionInfo,
    }
    #[async_trait]
    impl ChainProvider for LineageProvider {
      async fn get_tip_block_number(&self) -> Result<u64, CommandError> {
        Ok(12_000_100)
      }
      async fn send_transaction(&self, _tx_hex: &str) -> Result<String, CommandError> {
        Ok("0x00".into())
      }
      async fn get_transaction(&self, tx_hash: &str) -> Result<TransactionInfo, CommandError> {
        if tx_hash == self.tx1.tx_hash {
          return Ok(self.tx1.clone());
        }
        if tx_hash == self.tx0.tx_hash {
          return Ok(self.tx0.clone());
        }
        if tx_hash == self.order_tx.tx_hash {
          return Ok(self.order_tx.clone());
        }
        Err(CommandError::internal("unknown tx"))
      }
      async fn get_block_timestamp(&self, _block_number: u64) -> Result<u64, CommandError> {
        Ok(0)
      }
    }

    let backend = RealLiquidityBackend::new(
      ckb_cinnabar_calculator::simulation::FakeRpcClient::default(),
      Arc::new(LineageProvider { tx1, tx0, order_tx }),
      Arc::new(MockSigningWallet(MockSigningWallet::test_key())),
      true,
      Arc::new(Mutex::new(None)),
      None,
    );
    // Trace reaches the original (first) match cell's rent pool.
    assert_eq!(
      backend.original_stake_shannons(&m).await,
      Some(original_stake)
    );
    // Second call hits the per-lineage cache.
    assert_eq!(
      backend.original_stake_shannons(&m).await,
      Some(original_stake)
    );
  }

  #[tokio::test]
  async fn match_to_wire_uses_channel_capacity_not_stake_for_apy() {
    use crate::chain::chain_provider::TxOutputInfo;

    // test_match's channel_outpoint is tx 0x2222… (64 hex), index 0.
    let funding = "2222".repeat(16);
    let channel_capacity_shannons = 1_000_000_000_000; // 10,000 CKB channel

    struct FundingCellProvider {
      funding: String,
      capacity: u64,
    }
    #[async_trait]
    impl ChainProvider for FundingCellProvider {
      async fn get_tip_block_number(&self) -> Result<u64, CommandError> {
        Ok(12_000_100)
      }
      async fn send_transaction(&self, _tx_hex: &str) -> Result<String, CommandError> {
        Ok("0x00".into())
      }
      async fn get_transaction(&self, tx_hash: &str) -> Result<TransactionInfo, CommandError> {
        assert_eq!(
          tx_hash, self.funding,
          "lookup must target the channel funding tx"
        );
        Ok(TransactionInfo {
          tx_hash: tx_hash.to_string(),
          block_number: 1,
          inputs: Vec::new(),
          outputs: vec![TxOutputInfo {
            capacity: self.capacity,
            lock_code_hash: String::new(),
            lock_hash_type: "Type".into(),
            lock_args_hex: String::new(),
            lock_args_len: 0,
            data_hex: String::new(),
          }],
        })
      }
      async fn get_block_timestamp(&self, _block_number: u64) -> Result<u64, CommandError> {
        Ok(0)
      }
    }

    let m = test_match(false);
    let w = match_to_wire(
      &m,
      12_000_100,
      Some([0xaa; 32]),
      Some(500_000.0),
      &FundingCellProvider {
        funding,
        capacity: channel_capacity_shannons,
      },
    )
    .await;

    // The wire capacity is the funded channel capacity (10,000 CKB), not the
    // match cell's stake (500,000 CKB in test_match) — the cell + KPIs must not
    // read the stake as "通道容量".
    assert_eq!(w.channel_capacity_ckb, 10_000.0);
    assert_eq!(w.deposit_ckb, 500_000.0);

    // APY is rent / channel_capacity — the same basis as the order — not
    // rent / stake (which would inflate 8% → 1000%+).
    let expected = rent_per_block_to_annual_yield(100_000, channel_capacity_shannons) * 10_000.0;
    assert!(
      (w.annual_yield_bps - expected).abs() < 1e-6,
      "match apy {} bps, want {expected} bps",
      w.annual_yield_bps
    );
    assert!(
      w.annual_yield_bps < 5_000.0,
      "apy must not be stake-based (was {} bps)",
      w.annual_yield_bps
    );
  }

  #[test]
  fn sdk_deadline_to_wire_adds_0x_and_rounds() {
    let d = SdkMatchDeadline {
      match_outpoint: "aabb:0".to_string(),
      channel_outpoint: "ccdd:1".to_string(),
      shannons_per_block: 100,
      remaining_capacity_ckb: 500.0,
      last_extraction_block: 1,
      match_creation_block: 2,
      projected_exhaustion_block: 3,
      blocks_remaining: 100,
      estimated_hours_remaining: 0.333,
      health: SdkMatchHealth::Critical,
      extractable_now_ckb: 12.5,
    };
    let w = sdk_deadline_to_wire(d);
    assert_eq!(w.match_outpoint, "0xaabb:0");
    assert_eq!(w.estimated_hours_remaining, 0);
    assert_eq!(w.health, MatchHealth::Critical);
  }

  #[test]
  fn build_dashboard_aggregates() {
    let orders = vec![test_order()];
    let matches = vec![test_match(false), test_match(true)];
    let d = build_dashboard(&orders, &matches, 12_000_100);
    assert_eq!(d.total_orders, 1);
    assert_eq!(d.total_matches, 2);
    assert_eq!(d.active_matches, 1);
    assert_eq!(d.exhausted_matches, 1);
    // Orders-capacity is the inbound demand (channel_capacity), not the escrow;
    // locked capacity spans order + match escrow.
    assert_eq!(d.total_orders_capacity_shannons, 50_000_000_000_000);
    assert_eq!(d.total_capacity_locked_shannons, 101_000_000_000_000);
    assert_eq!(d.recent_orders.len(), 1);
    assert_eq!(d.recent_matches.len(), 2);
    assert_eq!(d.matches_near_exhaustion.len(), 1);
  }

  #[tokio::test]
  async fn empty_chain_returns_empty_reads() {
    let backend = test_backend();
    let d = backend.get_dashboard().await.unwrap();
    assert_eq!(d.total_orders, 0);
    assert_eq!(d.total_matches, 0);
    assert!(backend.get_orders(None).await.unwrap().is_empty());
    assert!(backend.get_matches(None).await.unwrap().is_empty());
    assert!(backend
      .get_matches_near_exhaustion(50400)
      .await
      .unwrap()
      .is_empty());
    // write op on an empty chain: order not found (real path, not a stub)
    assert!(backend
      .cancel_order("0x00:0".into(), &NoopTxProgressReporter)
      .await
      .is_err());
  }

  #[tokio::test]
  async fn publish_order_signs_and_broadcasts() {
    use crate::wallet::{address, signer};
    use ckb_cinnabar_calculator::{
      re_exports::ckb_types::{
        core::{Capacity, ScriptHashType},
        packed::{CellOutput, Script},
        prelude::*,
        H256,
      },
      simulation::{fake_header_view, fake_outpoint, FakeRpcClient},
      skeleton::{CellOutputEx, TYPE_ID_CODE_HASH},
    };

    // Seed the Opticrum contract cell (the SDK's create_order builder needs it).
    let mut fake = FakeRpcClient::default();
    let contract_path = std::path::PathBuf::from("../../opticrum/build/release/opticrum");
    let contract_data = std::fs::read(&contract_path)
      .expect("opticrum contract binary — build with `make build CONTRACT=opticrum`");
    let type_script = Script::new_builder()
      .code_hash(H256(TYPE_ID_CODE_HASH.into()).pack())
      .hash_type(ScriptHashType::Type)
      .args(H256::default().as_bytes().pack())
      .build();
    let contract_cell = CellOutputEx::new(
      CellOutput::new_builder()
        .type_(Some(type_script).pack())
        .build(),
      contract_data,
    );
    fake.insert_fake_cell(
      fake_outpoint(),
      contract_cell,
      Some(fake_header_view(0, 1, 1)),
    );

    // User (buyer) funding cell with the wallet's secp256k1 lock.
    let wallet = MockSigningWallet(MockSigningWallet::test_key());
    let (_, sk) = wallet.signing_identity().unwrap();
    let secp = Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &sk);
    let lock = signer::secp256k1_lock_ex(&address::lock_arg_from_pubkey(&pk)).to_script_unchecked();
    let user_cell = CellOutputEx::new_from_scripts(
      lock,
      None,
      vec![],
      Some(Capacity::shannons(2_000_000_000_000_000)),
    )
    .unwrap();
    fake.insert_fake_cell(fake_outpoint(), user_cell, Some(fake_header_view(1, 1, 1)));

    let provider = Arc::new(MockChainProvider::new());
    // The publish path attributes the new order to the current node pubkey —
    // feed a fixed one so the assembled OrderArgs stays deterministic.
    let backend = RealLiquidityBackend::new(
      fake,
      provider.clone(),
      Arc::new(wallet),
      true,
      Arc::new(Mutex::new(Some("02".repeat(33)))),
      None,
    );

    let result = backend
      .publish_order(
        100_000_000_000_000,
        100_000,
        30_000_000_000,
        30,
        Some("/ip4/1.2.3.4/tcp/8115".to_string()),
        &NoopTxProgressReporter,
      )
      .await
      .expect("publish should build+sign+broadcast");
    assert!(result.tx_hash.starts_with("0x"));
    assert!(result.order_outpoint.starts_with("0x"));

    let submitted = provider.submitted_txs.lock().unwrap();
    assert_eq!(submitted.len(), 1, "one broadcast");
    let bytes = hex::decode(submitted.first().unwrap()).unwrap();
    let tx: ckb_jsonrpc_types::Transaction = serde_json::from_slice(&bytes).unwrap();
    assert!(!tx.witnesses.is_empty(), "signed transaction has witnesses");
  }

  #[tokio::test]
  async fn broadcast_reports_broadcasting_then_confirming() {
    use ckb_cinnabar_calculator::simulation::FakeRpcClient;

    // A minimal empty tx is enough — MockChainProvider::send_transaction records
    // the hex and returns a hash without parsing it, and its default
    // wait_for_confirmation resolves immediately.
    let tx: ckb_jsonrpc_types::Transaction = serde_json::from_str(
      r#"{"version":"0x0","cell_deps":[],"header_deps":[],"inputs":[],"outputs":[],"outputs_data":[],"witnesses":[]}"#,
    )
    .unwrap();

    struct CapturingReporter(Mutex<Vec<TxPhase>>);
    impl TxProgressReporter for CapturingReporter {
      fn report(&self, progress: TxProgress) {
        self.0.lock().unwrap().push(progress.phase);
      }
    }

    let backend = RealLiquidityBackend::new(
      FakeRpcClient::default(),
      Arc::new(MockChainProvider::new()),
      Arc::new(MockSigningWallet(MockSigningWallet::test_key())),
      true,
      Arc::new(Mutex::new(Some("02".repeat(33)))),
      None,
    );
    let reporter = CapturingReporter(Mutex::new(Vec::new()));

    let hash = backend.broadcast(tx, &reporter).await.expect("broadcast");
    assert!(hash.starts_with("0x"));
    assert_eq!(
      reporter.0.lock().unwrap().clone(),
      vec![TxPhase::Broadcasting, TxPhase::Confirming],
      "broadcast must report the two observable phases in order"
    );
  }
}

#[cfg(test)]
mod network_tests {
  use ckb_cinnabar_calculator::rpc::{Network, RpcClient, RPC};

  /// Confirm `update_network` resolves the official testnet endpoint to
  /// `Network::Testnet` (the `opticrum_contract_type_id` panic fix).
  #[tokio::test]
  #[ignore = "network-dependent — run manually"]
  async fn real_rpc_resolves_testnet() {
    let mut rpc = RpcClient::new(
      "https://testnet.ckbapp.dev",
      Some("https://testnet.ckb.dev/indexer"),
    );
    rpc.update_network().await.expect("reachable testnet");
    assert_eq!(rpc.network(), Network::Testnet);
  }
}
