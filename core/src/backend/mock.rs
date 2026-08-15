//! MockBackend — the in-memory mock store, implementing all four domain traits.
//!
//! This is the ported `src-tauri` mock: `Store` (seeded by `mock_data`) plus
//! the command bodies that used to live in `commands.rs`. It exists so the
//! desktop app runs without a chain/node and is the fallback backend.

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;

use crate::mock_data;
use crate::state::{SidecarEntry, Store};
use crate::wire::*;

use super::traits::*;

/// Current wall-clock in ms — stamps locally-created sidecar entries.
pub fn now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0)
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
pub(crate) fn watchtower_from_config(config: &NodeConfig) -> WatchtowerConfig {
  let url = config.fiber.standalone_watchtower_rpc_url.trim();
  if !url.is_empty() {
    WatchtowerConfig {
      mode: WatchtowerMode::Standalone,
      endpoint: Some(url.to_string()),
    }
  } else if config.fiber.disable_built_in_watchtower {
    WatchtowerConfig {
      mode: WatchtowerMode::Disabled,
      endpoint: None,
    }
  } else {
    WatchtowerConfig {
      mode: WatchtowerMode::Builtin,
      endpoint: None,
    }
  }
}

pub(crate) fn parse_chain(s: &str) -> Chain {
  if s.eq_ignore_ascii_case("mainnet") {
    Chain::Mainnet
  } else {
    Chain::Testnet
  }
}

fn require_unlocked(store: &Store) -> Result<(), CommandError> {
  if !store.unlocked {
    return Err(CommandError::WalletLocked("wallet is locked".into()));
  }
  Ok(())
}

pub struct MockBackend {
  store: Mutex<Store>,
}

impl MockBackend {
  pub fn new() -> Self {
    Self {
      store: Mutex::new(Store::new()),
    }
  }

  fn guard(&self) -> Result<std::sync::MutexGuard<'_, Store>, CommandError> {
    self
      .store
      .lock()
      .map_err(|_| CommandError::internal("state poisoned"))
  }
}

impl Default for MockBackend {
  fn default() -> Self {
    Self::new()
  }
}

// ── wallet ───────────────────────────────────────────────────────────────────

#[async_trait]
impl WalletBackend for MockBackend {
  async fn get_summary(&self) -> Result<WalletSummary, CommandError> {
    Ok(self.guard()?.wallet_summary())
  }

  async fn get_addresses(&self) -> Result<Vec<WalletAddress>, CommandError> {
    Ok(self.guard()?.wallet_addresses.clone())
  }

  async fn get_transactions(
    &self,
    limit: Option<u32>,
    offset: Option<u32>,
  ) -> Result<Vec<WalletTx>, CommandError> {
    let store = self.guard()?;
    let offset = offset.unwrap_or(0) as usize;
    let txs: Vec<WalletTx> = store.txs.iter().skip(offset).cloned().collect();
    Ok(match limit {
      Some(l) => txs.into_iter().take(l as usize).collect(),
      None => txs,
    })
  }

  async fn unlock(
    &self,
    password: String,
    _label: Option<String>,
  ) -> Result<WalletSummary, CommandError> {
    let mut store = self.guard()?;
    if !store.has_wallet {
      return Err(CommandError::InvalidInput(
        "no wallet exists — create or import one first".into(),
      ));
    }
    if password.is_empty() {
      return Err(CommandError::InvalidInput("password is required".into()));
    }
    store.unlocked = true;
    Ok(store.wallet_summary())
  }

  fn lock(&self) -> Result<(), CommandError> {
    self.guard()?.unlocked = false;
    Ok(())
  }

  async fn create_hd_wallet(
    &self,
    label: String,
    password: String,
    address_count: u32,
  ) -> Result<CreateWalletResult, CommandError> {
    let mut store = self.guard()?;
    if store.has_wallet {
      return Err(CommandError::AlreadyExists(
        "a wallet already exists".into(),
      ));
    }
    if password.is_empty() {
      return Err(CommandError::invalid_input("password is required"));
    }
    let mnemonic =
      "gospel upgrade venue act wrong abandon length convince genre dream bundle glue".to_string();
    let addresses: Vec<String> = (0..address_count.max(1))
      .map(|i| {
        format!(
          "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s{:02}p",
          i
        )
      })
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
    Ok(CreateWalletResult {
      mnemonic,
      address,
      addresses,
    })
  }

  async fn import_mnemonic(
    &self,
    mnemonic: String,
    _password: String,
    _label: String,
  ) -> Result<WalletSummary, CommandError> {
    let mut store = self.guard()?;
    if mnemonic.trim().is_empty() {
      return Err(CommandError::invalid_input("mnemonic is required"));
    }
    store.has_wallet = true;
    store.unlocked = true;
    Ok(store.wallet_summary())
  }

  async fn import_private_key(
    &self,
    private_key_hex: String,
    _password: String,
    _label: String,
  ) -> Result<WalletSummary, CommandError> {
    let mut store = self.guard()?;
    if private_key_hex.trim().is_empty() {
      return Err(CommandError::invalid_input("private key is required"));
    }
    store.has_wallet = true;
    store.unlocked = true;
    Ok(store.wallet_summary())
  }

  async fn derive_addresses(&self, count: u32) -> Result<Vec<String>, CommandError> {
    let store = self.guard()?;
    require_unlocked(&store)?;
    Ok((0..count.max(1))
      .map(|i| {
        format!(
          "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s{:02}p",
          i + 10
        )
      })
      .collect())
  }

  async fn send_ckb(
    &self,
    address: String,
    amount_shannons: u64,
  ) -> Result<TxHashResult, CommandError> {
    let store = self.guard()?;
    require_unlocked(&store)?;
    if address.trim().is_empty() {
      return Err(CommandError::invalid_input("recipient address is required"));
    }
    if amount_shannons == 0 {
      return Err(CommandError::invalid_input("amount must be greater than 0"));
    }
    if amount_shannons as f64 / 1e8 > store.available_ckb {
      return Err(CommandError::InsufficientFunds(
        "insufficient balance".into(),
      ));
    }
    Ok(TxHashResult {
      tx_hash: fake_tx_hash(&format!("send:{address}")),
    })
  }
}

// ── node ─────────────────────────────────────────────────────────────────────

#[async_trait]
impl NodeBackend for MockBackend {
  async fn get_runtime(&self) -> Result<NodeRuntime, CommandError> {
    Ok(self.guard()?.node_runtime())
  }

  async fn start(&self, config: Option<NodeConfig>) -> Result<NodeRuntime, CommandError> {
    let mut store = self.guard()?;
    if let Some(cfg) = config {
      store.chain = parse_chain(&cfg.fiber.chain);
      store.watchtower = watchtower_from_config(&cfg);
      store.config = cfg;
    }
    store.running = true;
    store.uptime_hours = 0;
    Ok(store.node_runtime())
  }

  async fn stop(&self) -> Result<(), CommandError> {
    self.guard()?.running = false;
    Ok(())
  }

  async fn get_logs(
    &self,
    level: Option<LogLevel>,
    since_ts_ms: Option<u64>,
    limit: Option<u32>,
  ) -> Result<Vec<NodeLog>, CommandError> {
    let store = self.guard()?;
    let mut logs: Vec<NodeLog> = store
      .logs
      .iter()
      .filter(|l| level.is_none_or(|lv| l.level == lv))
      .filter(|l| since_ts_ms.is_none_or(|ts| l.ts_ms >= ts))
      .cloned()
      .collect();
    if let Some(l) = limit {
      logs.truncate(l as usize);
    }
    Ok(logs)
  }

  async fn get_config(&self) -> Result<NodeConfig, CommandError> {
    Ok(self.guard()?.config.clone())
  }

  async fn save_config(&self, config: NodeConfig) -> Result<SaveConfigResult, CommandError> {
    let mut store = self.guard()?;
    let chain = parse_chain(&config.fiber.chain);
    let watchtower = watchtower_from_config(&config);
    store.config = config;
    store.chain = chain;
    store.watchtower = watchtower.clone();
    Ok(SaveConfigResult { chain, watchtower })
  }
}

// ── channels ─────────────────────────────────────────────────────────────────

#[async_trait]
impl ChannelsBackend for MockBackend {
  async fn list(&self) -> Result<ChannelList, CommandError> {
    Ok(self.guard()?.channels.clone())
  }

  async fn connect_peer(
    &self,
    addr: String,
    pubkey: Option<String>,
    alias: Option<String>,
  ) -> Result<ConnectPeerResult, CommandError> {
    let mut store = self.guard()?;
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
          version: None,
        },
        channels: vec![],
      });
    }
    Ok(ConnectPeerResult { peer_id })
  }

  async fn disconnect_peer(&self, peer_id: String) -> Result<(), CommandError> {
    self
      .guard()?
      .channels
      .nodes
      .retain(|n| n.peer.id != peer_id);
    Ok(())
  }

  async fn open_channel(
    &self,
    peer_id: String,
    capacity_shannons: u64,
    base_fee_mshannons: Option<u64>,
    fee_rate_ppm: Option<u64>,
  ) -> Result<OpenChannelResult, CommandError> {
    let mut store = self.guard()?;
    if capacity_shannons == 0 {
      return Err(CommandError::invalid_input(
        "capacity must be greater than 0",
      ));
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

  async fn close_channel(&self, channel_id: String, _force: bool) -> Result<(), CommandError> {
    let mut store = self.guard()?;
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
}

// ── liquidity ────────────────────────────────────────────────────────────────

#[async_trait]
impl LiquidityBackend for MockBackend {
  async fn get_dashboard(&self) -> Result<DashboardData, CommandError> {
    Ok(self.guard()?.dashboard())
  }

  async fn get_orders(&self, _scope: Option<String>) -> Result<Vec<LiquidityOrder>, CommandError> {
    let store = self.guard()?;
    // Join the local sidecar: `publish_order` writes rental/created/deposit there,
    // and orders that predate local tracking surface as `null` for those fields.
    Ok(
      store
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
        .collect(),
    )
  }

  async fn get_matches(&self, _scope: Option<String>) -> Result<Vec<LiquidityMatch>, CommandError> {
    Ok(self.guard()?.matches.clone())
  }

  async fn get_matches_near_exhaustion(
    &self,
    _blocks_threshold: u64,
  ) -> Result<Vec<MatchDeadline>, CommandError> {
    let store = self.guard()?;
    Ok(mock_data::mock_deadlines(&store.matches))
  }

  async fn publish_order(
    &self,
    capacity_shannons: u64,
    shannons_per_block: u64,
    rent_capacity_shannons: u64,
    rental_days: u32,
    fiber_address: Option<String>,
  ) -> Result<PublishOrderResult, CommandError> {
    let mut store = self.guard()?;
    require_unlocked(&store)?;
    if capacity_shannons == 0 || rent_capacity_shannons == 0 {
      return Err(CommandError::invalid_input(
        "capacity and rent must be greater than 0",
      ));
    }
    let capacity_ckb = capacity_shannons as f64 / 1e8;
    let deposit_ckb = rent_capacity_shannons as f64 / 1e8;
    let outpoint = format!(
      "{}:0",
      fake_tx_hash(&format!("order:{}", store.orders.len()))
    );
    let created_at_ms = now_ms();
    let order = LiquidityOrder {
      outpoint: outpoint.clone(),
      channel_capacity_ckb: capacity_ckb,
      channel_capacity_shannons: capacity_shannons,
      shannons_per_block,
      annual_yield_bps: mock_data::apy_bps(shannons_per_block, capacity_ckb),
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

  async fn cancel_order(&self, outpoint: String) -> Result<TxHashResult, CommandError> {
    let mut store = self.guard()?;
    require_unlocked(&store)?;
    let len_before = store.orders.len();
    store.orders.retain(|o| o.outpoint != outpoint);
    store.sidecar.remove(&outpoint);
    if store.orders.len() == len_before {
      return Err(CommandError::invalid_input("order not found"));
    }
    Ok(TxHashResult {
      tx_hash: fake_tx_hash(&outpoint),
    })
  }

  async fn inject_deposit(
    &self,
    match_outpoint: String,
    amount_shannons: u64,
  ) -> Result<TxHashResult, CommandError> {
    let mut store = self.guard()?;
    require_unlocked(&store)?;
    let amount_ckb = amount_shannons as f64 / 1e8;
    let m = store
      .matches
      .iter_mut()
      .find(|m| m.outpoint == match_outpoint)
      .ok_or_else(|| CommandError::invalid_input("match not found"))?;
    m.deposit_ckb += amount_ckb;
    m.withdrawable_ckb += amount_ckb;
    Ok(TxHashResult {
      tx_hash: fake_tx_hash(&match_outpoint),
    })
  }

  async fn withdraw_deposit(
    &self,
    match_outpoint: String,
    amount_shannons: u64,
  ) -> Result<TxHashResult, CommandError> {
    let mut store = self.guard()?;
    require_unlocked(&store)?;
    let amount_ckb = amount_shannons as f64 / 1e8;
    let m = store
      .matches
      .iter_mut()
      .find(|m| m.outpoint == match_outpoint)
      .ok_or_else(|| CommandError::invalid_input("match not found"))?;
    if amount_ckb > m.withdrawable_ckb {
      return Err(CommandError::invalid_input(
        "amount exceeds withdrawable balance",
      ));
    }
    m.deposit_ckb = (m.deposit_ckb - amount_ckb).max(0.0);
    m.withdrawable_ckb = (m.withdrawable_ckb - amount_ckb).max(0.0);
    Ok(TxHashResult {
      tx_hash: fake_tx_hash(&match_outpoint),
    })
  }

  async fn extract_spent_match(
    &self,
    match_outpoint: String,
  ) -> Result<ExtractResult, CommandError> {
    let mut store = self.guard()?;
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
}

#[cfg(test)]
mod tests {
  use super::*;

  #[tokio::test]
  async fn bundle_mock_dashboard_non_empty() {
    let b = MockBackend::new();
    let d = b.get_dashboard().await.unwrap();
    assert!(d.total_matches > 0);
    assert!(!d.recent_orders.is_empty());
  }

  #[tokio::test]
  async fn bundle_mock_summary_has_wallet() {
    let b = MockBackend::new();
    let s = b.get_summary().await.unwrap();
    assert!(s.has_wallet);
    assert!(s.unlocked);
  }

  #[tokio::test]
  async fn bundle_mock_lock_toggles() {
    let b = MockBackend::new();
    assert!(b.get_summary().await.unwrap().unlocked);
    b.lock().unwrap();
    let s = b.get_summary().await.unwrap();
    assert!(!s.unlocked);
    // signing ops fail while locked
    let err = b
      .send_ckb(
        "ckt1qq9gsk9qxvhwq4e8qtf5u5rqk9u6c5jvz6y7x8w9a0b1c2d3e4f5a6b7c8d9e".into(),
        61_0000_0000,
      )
      .await
      .unwrap_err();
    assert!(matches!(err, CommandError::WalletLocked(_)));
  }
}
