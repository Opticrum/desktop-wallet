//! RealWalletBackend — the real wallet domain backend.
//!
//! Wraps the ported rust-server wallet modules + a `ChainProvider` (balances,
//! broadcast) + cinnabar `RPC` (skeleton assembly) behind the `WalletBackend`
//! trait. Key material lives in RAM only while unlocked: the decrypted child
//! keys (`keyring`), the derivation seed, and the password-derived AES key.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use ckb_cinnabar_calculator::re_exports::ckb_types::{
  core::ScriptHashType,
  packed::Script,
  prelude::{Builder, Entity, Pack},
};
use ckb_cinnabar_calculator::re_exports::secp256k1::{PublicKey, SecretKey};
use ckb_cinnabar_calculator::rpc::{Network, RPC};
use ckb_cinnabar_calculator::skeleton::TYPE_ID_CODE_HASH;
use diesel::sqlite::SqliteConnection;
use opticrum_calculator::config::opticrum_contract_type_id;
use opticrum_calculator::types::{MatchArgs, OrderArgs};

use crate::backend::network::NetworkController;
use crate::chain::chain_provider::{ChainProvider, TransactionInfo};
use crate::db::txs_cache;
use crate::db::wallets::{self, WalletRecord};
use crate::wallet::{address, crypto, hd_wallet, keystore, signer, wallet_service};
use crate::wire::*;

use super::traits::WalletBackend;
use super::{SigningWallet, TxProgressReporter};

/// Minimal CKB capacity of a secp256k1_blake160 cell with empty data (61 CKB).
const MIN_TRANSFER_SHANNONS: u64 = 6_100_000_000;

/// A confirmed tx resolved by the trace-back — either served from the DB cache
/// or freshly fetched from the chain.
struct LoadedTx {
  info: TransactionInfo,
  timestamp_ms: u64,
}

/// Reorg depth guard: only trust/cache txs confirmed at least this many blocks
/// below the tip. Near-tip txs (possible reorg victims) are re-traced every
/// refresh; once stable they're served from the cache.
const STABLE_CONFIRMATIONS: u64 = 10;

/// The real wallet backend, generic over the cinnabar RPC backend so tests
/// can drive it with `FakeRpcClient` (offline).
pub struct RealWalletBackend<T: RPC> {
  rpc: Mutex<T>,
  provider: Mutex<Arc<dyn ChainProvider>>,
  db: Mutex<SqliteConnection>,
  keystore_path: PathBuf,
  testnet: AtomicBool,
  fee_rate: u64,
  /// Live node config, shared with the node backend — the `scripts[]` list is
  /// the fiber contract set used to classify txs as channel open/close.
  node_config: Arc<Mutex<NodeConfig>>,
  /// Decrypted HD-child keys — RAM only while unlocked.
  keyring: Mutex<Vec<(WalletRecord, SecretKey)>>,
  /// BIP39 seed (64 bytes) — RAM only while unlocked, for `derive_addresses`.
  seed: Mutex<Option<[u8; 64]>>,
  /// SHA-256(password) AES key — RAM only, re-encrypts newly derived children.
  enc_key: Mutex<Option<[u8; 32]>>,
  /// Production network controller — enables hot-swap. `None` in unit tests.
  network: Option<Arc<NetworkController>>,
}

impl<T: RPC> RealWalletBackend<T> {
  pub fn new(
    rpc: T,
    provider: Arc<dyn ChainProvider>,
    db: SqliteConnection,
    keystore_path: PathBuf,
    testnet: bool,
    fee_rate: u64,
    node_config: Arc<Mutex<NodeConfig>>,
  ) -> Self {
    Self::new_with_network(
      rpc,
      provider,
      db,
      keystore_path,
      testnet,
      fee_rate,
      node_config,
      None,
    )
  }

  #[allow(clippy::too_many_arguments)]
  pub fn new_with_network(
    rpc: T,
    provider: Arc<dyn ChainProvider>,
    db: SqliteConnection,
    keystore_path: PathBuf,
    testnet: bool,
    fee_rate: u64,
    node_config: Arc<Mutex<NodeConfig>>,
    network: Option<Arc<NetworkController>>,
  ) -> Self {
    Self {
      rpc: Mutex::new(rpc),
      provider: Mutex::new(provider),
      db: Mutex::new(db),
      keystore_path,
      testnet: AtomicBool::new(testnet),
      fee_rate,
      node_config,
      keyring: Mutex::new(Vec::new()),
      seed: Mutex::new(None),
      enc_key: Mutex::new(None),
      network,
    }
  }

  fn unlocked(&self) -> bool {
    !self.keyring.lock().unwrap().is_empty()
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

  /// Decrypt every child's key into the in-memory keyring.
  fn load_keyring(&self, children: Vec<WalletRecord>, password: &str) -> Result<(), CommandError> {
    let mut keys = Vec::with_capacity(children.len());
    for child in &children {
      let sk = wallet_service::decrypt_private_key(child, Some(password))?;
      keys.push((child.clone(), sk));
    }
    *self.keyring.lock().unwrap() = keys;
    Ok(())
  }

  /// Compute the on-chain balance across every managed wallet address (shannons).
  ///
  /// Each address query fails fast (3s timeout) so `get_summary` never blocks
  /// on a slow/unreachable RPC. Timeout / RPC failure is an error — not a
  /// successful 0 — so the UI keeps its last balance (or the loading
  /// placeholder) instead of flashing a fake empty wallet.
  async fn total_balance_shannons(&self) -> Result<u64, CommandError> {
    let children = {
      let mut conn = self.db.lock().unwrap();
      wallets::list_wallets(&mut conn).unwrap_or_default()
    };
    if children.is_empty() {
      return Ok(0);
    }
    let mut total = 0u64;
    let mut any_ok = false;
    for child in &children {
      match tokio::time::timeout(
        std::time::Duration::from_secs(3),
        self.provider().get_balance_by_address(&child.ckb_address),
      )
      .await
      {
        Ok(Ok(balance)) => {
          total += balance;
          any_ok = true;
        }
        Ok(Err(e)) => {
          log::warn!("balance query failed for {}: {e}", child.ckb_address);
        }
        Err(_) => {
          log::warn!("balance query timed out for {}", child.ckb_address);
        }
      }
    }
    if !any_ok {
      return Err(CommandError::chain(
        "wallet balance query timed out or failed",
      ));
    }
    Ok(total)
  }

  fn require_unlocked(&self) -> Result<(), CommandError> {
    if !self.unlocked() {
      return Err(CommandError::wallet_locked("wallet is locked"));
    }
    Ok(())
  }

  /// Resolve a tx's raw info through the persisted cache (confirmed + stable
  /// only), fetching from the chain on a miss and writing back. Used for both
  /// the per-tx fetch and each input's previous-tx resolution, so a refresh
  /// never re-RPCs a tx it already resolved — the trace-back stops at cached
  /// rows. The DB lock is held only for short synchronous SQL batches; the RPC
  /// awaits happen outside it.
  async fn load_tx(&self, tx_hash: &str, stable_bound: u64) -> Result<LoadedTx, CommandError> {
    let chain = self.chain();
    // (a) cache read — brief lock, no await
    let cached = {
      let mut conn = self.db.lock().unwrap();
      txs_cache::get_cached(&mut conn, chain, tx_hash)?
    };
    if let Some(row) = cached {
      let bn = row.block_number as u64;
      if bn > 0 && bn <= stable_bound {
        return Ok(LoadedTx {
          info: row.into_info()?,
          timestamp_ms: row.block_timestamp as u64,
        });
      }
    }
    // (b) miss / near-tip → chain, no db lock held across the await
    let provider = self.provider();
    let info = provider
      .get_transaction(tx_hash)
      .await
      .map_err(|e| CommandError::chain(format!("get_transaction {tx_hash}: {e}")))?;
    let bn = info.block_number;
    let ts = if bn > 0 {
      provider.get_block_timestamp(bn).await.unwrap_or(0)
    } else {
      0
    };
    // (c) cache write — confirmed AND stable only, brief lock, best-effort
    if bn > 0 && bn <= stable_bound {
      let mut conn = self.db.lock().unwrap();
      let _ = txs_cache::upsert_cached(&mut conn, chain, &info, ts);
    }
    Ok(LoadedTx {
      info,
      timestamp_ms: ts,
    })
  }
}

impl<T: RPC> SigningWallet for RealWalletBackend<T> {
  fn is_unlocked(&self) -> bool {
    self.unlocked()
  }

  fn signing_identity(&self) -> Option<(String, SecretKey)> {
    self
      .keyring
      .lock()
      .unwrap()
      .first()
      .map(|(r, sk)| (r.ckb_address.clone(), *sk))
  }
}

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

#[async_trait]
impl<T: HotSwapRpc + Send + Sync> WalletBackend for RealWalletBackend<T> {
  /// Fast local wallet state — no chain query, so the unlock form renders
  /// immediately without waiting for the balance.
  async fn get_status(&self) -> Result<WalletStatus, CommandError> {
    let has_wallet = wallet_service::hd_wallet_exists(&self.keystore_path);
    let unlocked = self.unlocked();
    let address = self
      .keyring
      .lock()
      .unwrap()
      .first()
      .map(|(r, _)| r.ckb_address.clone())
      .unwrap_or_default();
    Ok(WalletStatus {
      has_wallet,
      unlocked,
      address,
      chain: self.chain(),
    })
  }

  async fn get_summary(&self) -> Result<WalletSummary, CommandError> {
    let has_wallet = wallet_service::hd_wallet_exists(&self.keystore_path);
    let unlocked = self.unlocked();
    let address = self
      .keyring
      .lock()
      .unwrap()
      .first()
      .map(|(r, _)| r.ckb_address.clone())
      .unwrap_or_default();
    let available_ckb = self.total_balance_shannons().await? as f64 / 1e8;
    Ok(WalletSummary {
      has_wallet,
      unlocked,
      address,
      available_ckb,
      total_ckb: available_ckb,
      locked_ckb: 0.0,
      fiat_usd: None,
      chain: self.chain(),
    })
  }

  async fn get_addresses(&self) -> Result<Vec<WalletAddress>, CommandError> {
    let mut conn = self.db.lock().unwrap();
    let children = wallets::list_wallets(&mut conn)?;
    Ok(
      children
        .iter()
        .map(|c| WalletAddress {
          address: c.ckb_address.clone(),
          lock_hash: format!("0x{}", hex::encode(&c.lock_hash)),
        })
        .collect(),
    )
  }

  async fn get_transactions(
    &self,
    limit: Option<u32>,
    offset: Option<u32>,
  ) -> Result<Vec<WalletTx>, CommandError> {
    use ckb_cinnabar_calculator::indexer::{ScriptType, SearchKey, Tx};
    use ckb_cinnabar_calculator::re_exports::ckb_jsonrpc_types::JsonBytes;
    use std::collections::HashSet;

    let children = {
      let mut conn = self.db.lock().unwrap();
      wallets::list_wallets(&mut conn)?
    };

    // Reorg guard: only trust/cache txs confirmed at least STABLE_CONFIRMATIONS
    // blocks below the tip. Near-tip txs are re-traced each refresh and
    // re-verified; once stable they're served from the DB cache.
    let stable_bound = match self.provider().get_tip_block_number().await {
      Ok(tip) => tip.saturating_sub(STABLE_CONFIRMATIONS),
      Err(e) => {
        log::warn!("get_tip_block_number failed ({e}); trusting cached history");
        u64::MAX
      }
    };

    // Real history via the indexer's transaction search: it returns every tx
    // where a wallet address appears as input OR output — including spent
    // cells, which `get_cells` (live-only) would silently drop.
    let mut tx_hashes: HashSet<String> = HashSet::new();
    let mut wallet_lock_args: Vec<String> = Vec::new();
    let sighash_hex = hex::encode(crate::wallet::address::SIGHASH_TYPE_HASH);
    // Per-address frontier (the "top"): the highest confirmed block each child
    // appeared in, derived from the indexer search so it stays current without
    // extra per-tx loads.
    let mut child_tops: Vec<(i64, String, u64)> = Vec::new();

    for child in &children {
      let lock_arg = address::lock_arg_from_address(&child.ckb_address)?;
      wallet_lock_args.push(hex::encode(lock_arg));
      let script: ckb_cinnabar_calculator::re_exports::ckb_jsonrpc_types::Script =
        serde_json::from_value(address::secp256k1_blake160_lock_script(&lock_arg))
          .map_err(|e| CommandError::chain(format!("build lock script: {e}")))?;
      let search_key = SearchKey {
        script,
        script_type: ScriptType::Lock,
        script_search_mode: None,
        filter: None,
        with_data: None,
        group_by_transaction: None,
      };
      let mut cursor: Option<JsonBytes> = None;
      let mut top_hash: Option<String> = None;
      let mut top_block: u64 = 0;
      loop {
        let rpc = self.rpc.lock().unwrap().clone();
        let page = rpc
          .get_transactions(search_key.clone(), 1000, cursor.clone())
          .await
          .map_err(|e| CommandError::chain(format!("indexer get_transactions: {e}")))?;
        if page.objects.is_empty() {
          break;
        }
        for tx in page.objects {
          // Plain 64-hex — `H256::from_str` rejects the "0x" prefix.
          let hash = hex::encode(tx.tx_hash().as_bytes());
          tx_hashes.insert(hash.clone());
          let block = match &tx {
            Tx::Ungrouped(t) => t.block_number.value(),
            Tx::Grouped(t) => t.block_number.value(),
          };
          if block > top_block {
            top_block = block;
            top_hash = Some(hash);
          }
        }
        let next = page.last_cursor;
        if next.as_bytes().is_empty() || Some(next.clone()) == cursor {
          break;
        }
        cursor = Some(next);
      }
      if let Some(h) = top_hash {
        child_tops.push((child.id, h, top_block));
      }
    }

    // A wallet cell is a secp256k1_blake160 lock: known code hash + one of the
    // wallet's lock args, with hash type `Type`.
    let is_wallet_lock = |out: &crate::chain::chain_provider::TxOutputInfo| -> bool {
      out.lock_hash_type == "Type"
        && out.lock_code_hash == sighash_hex
        && wallet_lock_args.iter().any(|a| a == &out.lock_args_hex)
    };

    // Fiber contract set from the live node config: an output locked by the
    // FundingLock contract marks a channel funding (open); an input spending
    // any configured fiber script marks a channel close. `lock_code_hash` on
    // the wire is bare hex while config code_hashes carry a `0x` prefix —
    // normalize both before comparing.
    let (funding_hash, fiber_hashes) = {
      let cfg = self.node_config.lock().unwrap();
      let normalize = |h: &str| h.strip_prefix("0x").unwrap_or(h).to_ascii_lowercase();
      let mut fiber: HashSet<String> = HashSet::new();
      let mut funding = None;
      for s in &cfg.scripts {
        let h = normalize(&s.code_hash);
        fiber.insert(h.clone());
        if s.name == "FundingLock" {
          funding = Some(h);
        }
      }
      (funding, fiber)
    };

    // Opticrum liquidity lock: the code_hash is the script hash of the deployed
    // contract's type script `(TYPE_ID, Type, opticrum_contract_type_id)`. The
    // calculator only implements the testnet type_id — mainnet would panic, so
    // Opticrum classification is testnet-only for now.
    let opticrum_lock_hash: Option<String> = if self.is_testnet() {
      let type_id = opticrum_contract_type_id(Network::Testnet);
      let type_script = Script::new_builder()
        .code_hash(TYPE_ID_CODE_HASH.pack())
        .hash_type(ScriptHashType::Type)
        .args(type_id.as_bytes().pack())
        .build();
      Some(hex::encode(type_script.calc_script_hash().as_bytes()))
    } else {
      None
    };

    // Per tx, the wallet's net flow: outputs to the wallet minus wallet cells
    // consumed as inputs. Positive → Receive, negative → Send — unless fiber or
    // Opticrum contracts in the I/O say it is a channel or liquidity action.
    let mut txs: Vec<WalletTx> = Vec::new();
    for tx_hash in &tx_hashes {
      let loaded = match self.load_tx(tx_hash, stable_bound).await {
        Ok(l) => l,
        Err(_) => continue, // pruned / not found — skip
      };
      let info = &loaded.info;
      let mut received = 0f64;
      let mut spent = 0f64;
      let mut out_is_funding = false;
      let mut in_spends_fiber = false;
      let mut out_is_order = false;
      let mut in_spends_match = false;
      for out in &info.outputs {
        if is_wallet_lock(out) {
          received += out.capacity as f64 / 1e8;
        }
        if funding_hash.as_deref() == Some(out.lock_code_hash.as_str()) {
          out_is_funding = true;
        }
        // An Opticrum cell locked by the order args = a rent pledge (the wallet
        // funded the order). Order vs match is an exact args-length check.
        if opticrum_lock_hash.as_deref() == Some(out.lock_code_hash.as_str()) {
          if let Ok(args) = hex::decode(&out.lock_args_hex) {
            if OrderArgs::from_slice(&args).is_ok() {
              out_is_order = true;
            }
          }
        }
      }
      for input in &info.inputs {
        // Resolve each input's previous output to see if it is a wallet cell —
        // and whether it spends a fiber contract cell (channel close) or an
        // Opticrum match cell (rent extraction). The same walk drives all three;
        // `previous_tx_hash` is plain 64-hex (no "0x"). Read through the same
        // cache — the walk stops at previously-resolved txs.
        if let Ok(prev) = self.load_tx(&input.previous_tx_hash, stable_bound).await {
          if let Some(out) = prev.info.outputs.get(input.previous_index as usize) {
            if is_wallet_lock(out) {
              spent += out.capacity as f64 / 1e8;
            }
            if fiber_hashes.contains(&out.lock_code_hash) {
              in_spends_fiber = true;
            }
            if opticrum_lock_hash.as_deref() == Some(out.lock_code_hash.as_str()) {
              if let Ok(args) = hex::decode(&out.lock_args_hex) {
                if MatchArgs::from_slice(&args).is_ok() {
                  in_spends_match = true;
                }
              }
            }
          }
        }
      }
      let net = received - spent;
      if net.abs() < 1e-6 {
        continue; // no net movement (e.g. self-transfer / dust)
      }
      // Fiber first: a funding tx creates the FundingLock cell → open; a close
      // spends the channel cell to settle → close. Opticrum: an order-cell
      // output → rent pledge; a spent match cell → rent extraction. Everything
      // else is a plain wallet transfer by net sign.
      let kind = if out_is_funding {
        WalletTxKind::ChannelOpen
      } else if in_spends_fiber {
        WalletTxKind::ChannelClose
      } else if out_is_order {
        WalletTxKind::RentPledge
      } else if in_spends_match {
        WalletTxKind::RentExtract
      } else if net > 0.0 {
        WalletTxKind::Receive
      } else {
        WalletTxKind::Send
      };
      txs.push(WalletTx {
        id: format!("tx-{tx_hash}"),
        kind,
        // Signed: +receive/inbound, −send/outbound (wire contract). `net` is
        // nonzero here (the near-zero skip ran above).
        amount_ckb: net,
        timestamp_ms: loaded.timestamp_ms,
        tx_hash: format!("0x{tx_hash}"),
      });
    }

    // Persist the per-address frontier ("top") — one brief lock, no awaits.
    {
      let chain = self.chain();
      let mut conn = self.db.lock().unwrap();
      for (wallet_id, top_hash, top_block) in &child_tops {
        let _ = txs_cache::upsert_tx_top(
          &mut conn,
          chain,
          *wallet_id,
          top_hash.as_str(),
          *top_block as i64,
        );
      }
    }

    txs.sort_by_key(|b| std::cmp::Reverse(b.timestamp_ms));

    let offset = offset.unwrap_or(0) as usize;
    let txs: Vec<WalletTx> = txs.into_iter().skip(offset).collect();
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
    if !wallet_service::hd_wallet_exists(&self.keystore_path) {
      return Err(CommandError::invalid_input(
        "no wallet exists — create or import one first",
      ));
    }
    let (keystore, children) = {
      let mut conn = self.db.lock().unwrap();
      wallet_service::unlock_keystore(&mut conn, self.is_testnet(), &self.keystore_path, &password)?
    };
    let mnemonic = keystore::decrypt_mnemonic(&keystore, &password)?;
    let seed = hd_wallet::mnemonic_to_seed(&mnemonic, "");
    self.load_keyring(children, &password)?;
    *self.seed.lock().unwrap() = Some(seed);
    *self.enc_key.lock().unwrap() = Some(crypto::derive_key(&password));
    Ok(self.get_summary().await?)
  }

  fn lock(&self) -> Result<(), CommandError> {
    self.keyring.lock().unwrap().clear();
    self.seed.lock().unwrap().take();
    self.enc_key.lock().unwrap().take();
    Ok(())
  }

  async fn create_hd_wallet(
    &self,
    label: String,
    password: String,
    address_count: u32,
  ) -> Result<CreateWalletResult, CommandError> {
    if wallet_service::hd_wallet_exists(&self.keystore_path) {
      return Err(CommandError::AlreadyExists(
        "a wallet already exists".into(),
      ));
    }
    let (_keystore, phrase, children) = {
      let mut conn = self.db.lock().unwrap();
      wallet_service::create_hd_wallet(
        &mut conn,
        self.is_testnet(),
        &self.keystore_path,
        &label,
        &password,
        address_count,
      )?
    };
    let mnemonic = bip39::Mnemonic::parse(&phrase)
      .map_err(|e| CommandError::invalid_input(format!("mnemonic: {e}")))?;
    let seed = hd_wallet::mnemonic_to_seed(&mnemonic, "");
    self.load_keyring(children.clone(), &password)?;
    *self.seed.lock().unwrap() = Some(seed);
    *self.enc_key.lock().unwrap() = Some(crypto::derive_key(&password));
    let addresses: Vec<String> = children.iter().map(|c| c.ckb_address.clone()).collect();
    let address = addresses.first().cloned().unwrap_or_default();
    Ok(CreateWalletResult {
      mnemonic: phrase,
      address,
      addresses,
    })
  }

  async fn import_mnemonic(
    &self,
    mnemonic: String,
    password: String,
    label: String,
  ) -> Result<WalletSummary, CommandError> {
    if wallet_service::hd_wallet_exists(&self.keystore_path) {
      return Err(CommandError::AlreadyExists(
        "a wallet already exists".into(),
      ));
    }
    let (_keystore, children) = {
      let mut conn = self.db.lock().unwrap();
      wallet_service::import_hd_from_mnemonic(
        &mut conn,
        self.is_testnet(),
        &self.keystore_path,
        &mnemonic,
        &label,
        &password,
        5,
      )?
    };
    let m = bip39::Mnemonic::parse(&mnemonic)
      .map_err(|e| CommandError::invalid_input(format!("mnemonic: {e}")))?;
    let seed = hd_wallet::mnemonic_to_seed(&m, "");
    self.load_keyring(children, &password)?;
    *self.seed.lock().unwrap() = Some(seed);
    *self.enc_key.lock().unwrap() = Some(crypto::derive_key(&password));
    Ok(self.get_summary().await?)
  }

  async fn import_private_key(
    &self,
    private_key_hex: String,
    password: String,
    label: String,
  ) -> Result<WalletSummary, CommandError> {
    if wallet_service::hd_wallet_exists(&self.keystore_path) {
      return Err(CommandError::AlreadyExists(
        "a wallet already exists".into(),
      ));
    }
    let record = {
      let mut conn = self.db.lock().unwrap();
      wallet_service::import_wallet(
        &mut conn,
        self.is_testnet(),
        &label,
        &private_key_hex,
        Some(&password),
      )?
    };
    let sk = wallet_service::decrypt_private_key(&record, Some(&password))?;
    *self.keyring.lock().unwrap() = vec![(record, sk)];
    *self.enc_key.lock().unwrap() = Some(crypto::derive_key(&password));
    Ok(self.get_summary().await?)
  }

  async fn derive_addresses(&self, count: u32) -> Result<Vec<String>, CommandError> {
    self.require_unlocked()?;
    let seed = self
      .seed
      .lock()
      .unwrap()
      .ok_or_else(|| CommandError::wallet_locked("wallet is locked"))?;
    let enc_key = self
      .enc_key
      .lock()
      .unwrap()
      .ok_or_else(|| CommandError::wallet_locked("wallet is locked"))?;
    let start_index = keystore::load_keystore(&self.keystore_path)?.address_count;
    let count = count.max(1);
    let label = {
      let mut conn = self.db.lock().unwrap();
      wallets::list_wallets_by_type(&mut conn, "hd_child")?
        .first()
        .map(|r| r.label.clone())
        .unwrap_or_else(|| "wallet".to_string())
    };

    let mut conn = self.db.lock().unwrap();
    let mut new_addrs = Vec::with_capacity(count as usize);
    for i in start_index..start_index + count {
      let path = format!("m/44'/309'/0'/0/{i}");
      let (child_key, _) = hd_wallet::derive_path(&seed, &path)
        .map_err(|e| CommandError::internal(format!("derive {path}: {e}")))?;
      let secp = secp256k1::Secp256k1::new();
      let pk = PublicKey::from_secret_key(&secp, &child_key);
      let lock_arg = address::lock_arg_from_pubkey(&pk);
      let lock_hash = address::script_lock_hash(&lock_arg);
      let addr = address::ckb_address_from_pubkey(&pk, self.is_testnet());
      let encrypted = crypto::encrypt_with_key(&child_key.secret_bytes(), &enc_key)?;
      wallets::insert_wallet(
        &mut conn,
        &format!("{label} #{i}"),
        &encrypted,
        &lock_hash,
        &addr,
        None,
        Some(&path),
        Some(i as i32),
        "hd_child",
      )?;
      new_addrs.push(addr);
    }
    drop(conn);
    keystore::update_address_count(&self.keystore_path, start_index + count)?;
    Ok(new_addrs)
  }

  async fn send_ckb(
    &self,
    address: String,
    amount_shannons: u64,
    progress: &dyn TxProgressReporter,
  ) -> Result<TxHashResult, CommandError> {
    self.require_unlocked()?;
    let _op = self
      .network
      .as_ref()
      .map(|n| n.begin_op())
      .transpose()?;
    address::require_address_chain(&address, self.chain())?;
    if amount_shannons == 0 {
      return Err(CommandError::invalid_input("amount must be greater than 0"));
    }
    if amount_shannons < MIN_TRANSFER_SHANNONS {
      return Err(CommandError::invalid_input(
        "amount must be at least 61 CKB",
      ));
    }
    let (_, sk) = self
      .keyring
      .lock()
      .unwrap()
      .first()
      .cloned()
      .ok_or_else(|| CommandError::wallet_locked("wallet is locked"))?;

    let secp = secp256k1::Secp256k1::new();
    let sender_pk = PublicKey::from_secret_key(&secp, &sk);
    let sender_arg = address::lock_arg_from_pubkey(&sender_pk);
    let sender_lock = signer::secp256k1_lock_ex(&sender_arg);
    let recipient_arg = address::lock_arg_from_address(&address)?;
    let recipient_lock = signer::secp256k1_lock_ex(&recipient_arg);

    let rpc = self.rpc.lock().unwrap().clone();
    let tx = signer::RealSigner::build_ckb_transfer(
      &rpc,
      sender_lock,
      &sk,
      recipient_lock,
      amount_shannons,
      self.fee_rate,
    )
    .await?;

    let json = serde_json::to_string(&tx).map_err(|e| CommandError::internal(e.to_string()))?;
    progress.report(TxProgress {
      phase: TxPhase::Broadcasting,
      tx_hash: None,
    });
    let provider = self.provider();
    let tx_hash = provider.send_transaction(&hex::encode(json)).await?;
    progress.report(TxProgress {
      phase: TxPhase::Confirming,
      tx_hash: Some(tx_hash.clone()),
    });
    // Resolve only once the transfer is confirmed on-chain.
    provider
      .wait_for_confirmation(&tx_hash, 1, Some(std::time::Duration::from_secs(300)))
      .await?;
    Ok(TxHashResult { tx_hash })
  }

  async fn set_network(&self, chain: Chain) -> Result<WalletStatus, CommandError> {
    if self.chain() == chain {
      return self.get_status().await;
    }
    let Some(ctrl) = &self.network else {
      return Err(CommandError::internal(
        "network switching is unavailable in this backend",
      ));
    };
    ctrl.try_begin_switch()?;
    let resources = ctrl.resources_for(chain);
    *self.provider.lock().unwrap() = resources.provider.clone();
    self.testnet.store(resources.testnet, Ordering::SeqCst);
    T::assign_rpc(&self.rpc, &resources.rpc)?;
    self.reencode_addresses_for_chain(chain)?;
    ctrl.activate(chain)?;
    self.get_status().await
  }
}

impl<T: HotSwapRpc + Send + Sync> RealWalletBackend<T> {
  /// Re-encode every managed address to the target chain HRP. When unlocked,
  /// also refresh the in-memory keyring address strings from the secret keys.
  fn reencode_addresses_for_chain(&self, chain: Chain) -> Result<(), CommandError> {
    let testnet = chain == Chain::Testnet;
    let mut conn = self.db.lock().unwrap();
    let children = wallets::list_wallets(&mut conn)?;
    for child in &children {
      let new_addr = if let Some((_, sk)) = self
        .keyring
        .lock()
        .unwrap()
        .iter()
        .find(|(r, _)| r.id == child.id)
      {
        let secp = secp256k1::Secp256k1::new();
        let pk = PublicKey::from_secret_key(&secp, sk);
        address::ckb_address_from_pubkey(&pk, testnet)
      } else if let Ok(lock_arg) = address::lock_arg_from_address(&child.ckb_address) {
        if testnet {
          address::ckb_address_testnet(&lock_arg)
        } else {
          address::ckb_address_mainnet(&lock_arg)
        }
      } else {
        continue;
      };
      if new_addr != child.ckb_address {
        wallets::update_wallet_derived_info(&mut conn, child.id, &child.lock_hash, &new_addr)?;
      }
    }
    drop(conn);
    // Refresh keyring address snapshots when unlocked.
    let mut keyring = self.keyring.lock().unwrap();
    for (record, sk) in keyring.iter_mut() {
      let secp = secp256k1::Secp256k1::new();
      let pk = PublicKey::from_secret_key(&secp, sk);
      record.ckb_address = address::ckb_address_from_pubkey(&pk, testnet);
    }
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::backend::NoopTxProgressReporter;
  use crate::chain::chain_provider::{
    MockChainProvider, TransactionInfo, TxInputInfo, TxOutputInfo,
  };
  use crate::db::init_test_db;
  use crate::db::txs_cache;
  use crate::db::wallets;
  use crate::node::default_config::default_config;
  use crate::wallet::signer::secp256k1_lock_ex;
  use ckb_cinnabar_calculator::indexer::{CellType, Tx, TxWithCell};
  use ckb_cinnabar_calculator::simulation::FakeRpcClient;

  /// The default node config — ships the FundingLock / CommitmentLock fiber
  /// scripts the classifier matches against.
  fn test_node_config() -> Arc<Mutex<NodeConfig>> {
    Arc::new(Mutex::new(default_config()))
  }

  fn test_backend() -> (RealWalletBackend<FakeRpcClient>, Arc<MockChainProvider>) {
    let fake = FakeRpcClient::default();
    let provider = Arc::new(MockChainProvider::new());
    let db = init_test_db();
    let dir = tempfile::tempdir().unwrap();
    let keystore_path = dir.path().join("keystore.json");
    let backend = RealWalletBackend::new(
      fake,
      provider.clone(),
      db,
      keystore_path,
      true,
      1000,
      test_node_config(),
    );
    (backend, provider)
  }

  #[tokio::test]
  async fn create_unlock_lock_state_machine() {
    let (backend, _provider) = test_backend();

    // create → unlocked immediately
    let created = backend
      .create_hd_wallet("test".into(), "pw".into(), 3)
      .await
      .unwrap();
    assert_eq!(created.addresses.len(), 3);
    assert!(backend.get_summary().await.unwrap().unlocked);
    assert!(backend.get_summary().await.unwrap().has_wallet);

    // lock → summary reports unlocked=false; send_ckb rejected
    backend.lock().unwrap();
    let s = backend.get_summary().await.unwrap();
    assert!(!s.unlocked);
    let err = backend
      .send_ckb(
        "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s2p".into(),
        61_0000_0000,
        &NoopTxProgressReporter,
      )
      .await
      .unwrap_err();
    assert!(matches!(err, CommandError::WalletLocked(_)));

    // unlock again → re-keyring
    let s = backend.unlock("pw".into(), None).await.unwrap();
    assert!(s.unlocked);
    assert_eq!(s.address, created.address);
  }

  #[tokio::test]
  async fn get_transactions_derives_real_receive_and_send() {
    use crate::wallet::address;

    let tx_a = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let tx_b = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    let mut fake = FakeRpcClient::default();
    fake.insert_fake_tx(Tx::Ungrouped(TxWithCell {
      tx_hash: tx_a.parse().unwrap(),
      block_number: 100u64.into(),
      tx_index: 0u32.into(),
      io_index: 0u32.into(),
      io_type: CellType::Output,
    }));
    fake.insert_fake_tx(Tx::Ungrouped(TxWithCell {
      tx_hash: tx_b.parse().unwrap(),
      block_number: 101u64.into(),
      tx_index: 0u32.into(),
      io_index: 0u32.into(),
      io_type: CellType::Input,
    }));
    let provider = Arc::new(MockChainProvider::new());
    let db = init_test_db();
    let dir = tempfile::tempdir().unwrap();
    let keystore_path = dir.path().join("keystore.json");
    let backend = RealWalletBackend::new(
      fake,
      provider.clone(),
      db,
      keystore_path,
      true,
      1000,
      test_node_config(),
    );

    let created = backend
      .create_hd_wallet("test".into(), "pw".into(), 1)
      .await
      .unwrap();
    let lock_arg = address::lock_arg_from_address(&created.address).unwrap();
    let lock_code = hex::encode(crate::wallet::address::SIGHASH_TYPE_HASH);
    let lock_args = hex::encode(lock_arg);

    let wallet_out = |capacity: u64| TxOutputInfo {
      capacity,
      lock_code_hash: lock_code.clone(),
      lock_hash_type: "Type".to_string(),
      lock_args_hex: lock_args.clone(),
      lock_args_len: 20,
      data_hex: String::new(),
    };
    let other_out = TxOutputInfo {
      capacity: 100_000_000_000, // 1000 CKB to a third party
      lock_code_hash: "00".repeat(32),
      lock_hash_type: "Type".to_string(),
      lock_args_hex: "00".repeat(20),
      lock_args_len: 20,
      data_hex: String::new(),
    };

    // tx_a: wallet receives 10000 CKB.
    provider.add_transaction(
      tx_a,
      TransactionInfo {
        tx_hash: tx_a.to_string(),
        block_number: 100,
        inputs: vec![],
        outputs: vec![wallet_out(1_000_000_000_000)],
      },
    );
    // tx_b: wallet spends that cell — pays 1000, change 9000 back to wallet.
    provider.add_transaction(
      tx_b,
      TransactionInfo {
        tx_hash: tx_b.to_string(),
        block_number: 101,
        inputs: vec![TxInputInfo {
          previous_tx_hash: tx_a.to_string(),
          previous_index: 0,
        }],
        outputs: vec![wallet_out(900_000_000_000), other_out],
      },
    );

    let txs = backend.get_transactions(None, None).await.unwrap();
    let mut recv = 0.0f64;
    let mut send = 0.0f64;
    for tx in &txs {
      match tx.kind {
        WalletTxKind::Receive => recv += tx.amount_ckb,
        WalletTxKind::Send => send += tx.amount_ckb,
        _ => {}
      }
    }
    assert_eq!(recv, 10000.0, "the 10000 receive must survive the spend");
    assert_eq!(
      send, -1000.0,
      "the spend must show as a Send, not a 9000 receive"
    );
  }

  /// A channel funding tx (wallet funds a FundingLock cell) must classify as
  /// `channel_open`; spending the funding cell to settle must be `channel_close`;
  /// a plain wallet receive stays `receive`.
  #[tokio::test]
  async fn get_transactions_classifies_channel_open_and_close() {
    use crate::wallet::address;

    let tx_a = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let tx_fund = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    let tx_close = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
    let mut fake = FakeRpcClient::default();
    // tx_a: wallet output (seed receive). tx_fund: wallet input (funds the
    // channel). tx_close: wallet output (settlement back).
    for (hash, block, io_type) in [
      (tx_a, 100u64, CellType::Output),
      (tx_fund, 101u64, CellType::Input),
      (tx_close, 102u64, CellType::Output),
    ] {
      fake.insert_fake_tx(Tx::Ungrouped(TxWithCell {
        tx_hash: hash.parse().unwrap(),
        block_number: block.into(),
        tx_index: 0u32.into(),
        io_index: 0u32.into(),
        io_type,
      }));
    }
    let provider = Arc::new(MockChainProvider::new());
    let db = init_test_db();
    let dir = tempfile::tempdir().unwrap();
    let keystore_path = dir.path().join("keystore.json");
    let backend = RealWalletBackend::new(
      fake,
      provider.clone(),
      db,
      keystore_path,
      true,
      1000,
      test_node_config(),
    );

    let created = backend
      .create_hd_wallet("test".into(), "pw".into(), 1)
      .await
      .unwrap();
    let lock_arg = address::lock_arg_from_address(&created.address).unwrap();
    let lock_code = hex::encode(crate::wallet::address::SIGHASH_TYPE_HASH);
    let lock_args = hex::encode(lock_arg);

    // The FundingLock contract from the default config. Config code_hashes
    // carry the `0x` prefix while on-chain lock_code_hash is bare hex — this
    // exercises the classifier's normalization on both sides.
    let funding_hash = default_config()
      .scripts
      .iter()
      .find(|s| s.name == "FundingLock")
      .expect("default config has FundingLock")
      .code_hash
      .trim_start_matches("0x")
      .to_string();

    let wallet_out = |capacity: u64| TxOutputInfo {
      capacity,
      lock_code_hash: lock_code.clone(),
      lock_hash_type: "Type".to_string(),
      lock_args_hex: lock_args.clone(),
      lock_args_len: 20,
      data_hex: String::new(),
    };
    let funding_out = TxOutputInfo {
      capacity: 100_000_000_000, // 1000 CKB locked into the channel
      lock_code_hash: funding_hash,
      lock_hash_type: "Type".to_string(),
      lock_args_hex: hex::encode([7u8; 20]),
      lock_args_len: 20,
      data_hex: String::new(),
    };

    // tx_a: wallet receives 10000 CKB (seed).
    provider.add_transaction(
      tx_a,
      TransactionInfo {
        tx_hash: tx_a.to_string(),
        block_number: 100,
        inputs: vec![],
        outputs: vec![wallet_out(1_000_000_000_000)],
      },
    );
    // tx_fund: opens a channel — spends the seed cell, locks 1000 CKB into the
    // FundingLock cell, 9000 change back to the wallet.
    provider.add_transaction(
      tx_fund,
      TransactionInfo {
        tx_hash: tx_fund.to_string(),
        block_number: 101,
        inputs: vec![TxInputInfo {
          previous_tx_hash: tx_a.to_string(),
          previous_index: 0,
        }],
        outputs: vec![wallet_out(900_000_000_000), funding_out],
      },
    );
    // tx_close: closes the channel — spends the FundingLock cell, settles 1000
    // CKB back to the wallet.
    provider.add_transaction(
      tx_close,
      TransactionInfo {
        tx_hash: tx_close.to_string(),
        block_number: 102,
        inputs: vec![TxInputInfo {
          previous_tx_hash: tx_fund.to_string(),
          previous_index: 1,
        }],
        outputs: vec![wallet_out(100_000_000_000)],
      },
    );

    let txs = backend.get_transactions(None, None).await.unwrap();
    let by_hash = |hash: &str| -> &WalletTx {
      txs
        .iter()
        .find(|t| t.tx_hash == format!("0x{hash}"))
        .unwrap_or_else(|| panic!("tx 0x{hash} missing from history: {txs:#?}"))
    };

    assert_eq!(
      by_hash(tx_fund).kind,
      WalletTxKind::ChannelOpen,
      "funding tx must be ChannelOpen"
    );
    assert_eq!(by_hash(tx_fund).amount_ckb, -1000.0, "funding is outbound");
    assert_eq!(
      by_hash(tx_close).kind,
      WalletTxKind::ChannelClose,
      "close tx must be ChannelClose"
    );
    assert_eq!(by_hash(tx_close).amount_ckb, 1000.0, "close is inbound");
    // Plain receive with no fiber contracts must not be reclassified.
    assert_eq!(by_hash(tx_a).kind, WalletTxKind::Receive);
  }

  /// An Opticrum order-cell output (wallet funds the order) → `rent_pledge`; a
  /// spent Opticrum match cell (rent paid back to the wallet) → `rent_extract`.
  #[tokio::test]
  async fn get_transactions_classifies_rent_pledge_and_extract() {
    use crate::wallet::address;

    // The Opticrum lock code_hash — script hash of the deployed contract's type
    // script, derived exactly like production (testnet).
    let opticrum_lock_hash = {
      let type_id = opticrum_contract_type_id(Network::Testnet);
      let ts = Script::new_builder()
        .code_hash(TYPE_ID_CODE_HASH.pack())
        .hash_type(ScriptHashType::Type)
        .args(type_id.as_bytes().pack())
        .build();
      hex::encode(ts.calc_script_hash().as_bytes())
    };

    let tx_seed = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    let tx_pledge = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    let tx_match = "0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a";
    let tx_extract = "0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b";
    let mut fake = FakeRpcClient::default();
    // tx_pledge: wallet input (funds the order). tx_extract: wallet output
    // (receives the rent). tx_seed: wallet output. tx_match is only resolved
    // as the extract tx's previous output — no indexer entry needed.
    for (hash, block, io_type) in [
      (tx_seed, 100u64, CellType::Output),
      (tx_pledge, 101u64, CellType::Input),
      (tx_extract, 103u64, CellType::Output),
    ] {
      fake.insert_fake_tx(Tx::Ungrouped(TxWithCell {
        tx_hash: hash.parse().unwrap(),
        block_number: block.into(),
        tx_index: 0u32.into(),
        io_index: 0u32.into(),
        io_type,
      }));
    }
    let provider = Arc::new(MockChainProvider::new());
    let db = init_test_db();
    let dir = tempfile::tempdir().unwrap();
    let keystore_path = dir.path().join("keystore.json");
    let backend = RealWalletBackend::new(
      fake,
      provider.clone(),
      db,
      keystore_path,
      true,
      1000,
      test_node_config(),
    );

    let created = backend
      .create_hd_wallet("test".into(), "pw".into(), 1)
      .await
      .unwrap();
    let lock_arg = address::lock_arg_from_address(&created.address).unwrap();
    let lock_code = hex::encode(crate::wallet::address::SIGHASH_TYPE_HASH);
    let lock_args = hex::encode(lock_arg);

    let wallet_out = |capacity: u64| TxOutputInfo {
      capacity,
      lock_code_hash: lock_code.clone(),
      lock_hash_type: "Type".to_string(),
      lock_args_hex: lock_args.clone(),
      lock_args_len: 20,
      data_hex: String::new(),
    };
    // OrderArgs = 33-byte fiber pubkey + 32-byte buyer lock hash (65 bytes);
    // MatchArgs = OrderArgs + 36-byte outpoint + 32-byte seller lock hash (133).
    let order_args_hex = hex::encode(
      [0x02u8; 33]
        .into_iter()
        .chain([0xaa; 32])
        .collect::<Vec<u8>>(),
    );
    let match_args_hex = hex::encode(
      [0x02u8; 33]
        .into_iter()
        .chain([0xaa; 32])
        .chain([0x03; 36])
        .chain([0xbb; 32])
        .collect::<Vec<u8>>(),
    );
    let opticrum_out = |capacity: u64, args_hex: &str, args_len: usize| TxOutputInfo {
      capacity,
      lock_code_hash: opticrum_lock_hash.clone(),
      lock_hash_type: "Type".to_string(),
      lock_args_hex: args_hex.to_string(),
      lock_args_len: args_len,
      data_hex: String::new(),
    };

    // tx_seed: wallet receives 10000 CKB.
    provider.add_transaction(
      tx_seed,
      TransactionInfo {
        tx_hash: tx_seed.to_string(),
        block_number: 100,
        inputs: vec![],
        outputs: vec![wallet_out(1_000_000_000_000)],
      },
    );
    // tx_pledge: spends the seed cell, locks 1000 CKB into an Opticrum order
    // cell, 9000 change back to the wallet.
    provider.add_transaction(
      tx_pledge,
      TransactionInfo {
        tx_hash: tx_pledge.to_string(),
        block_number: 101,
        inputs: vec![TxInputInfo {
          previous_tx_hash: tx_seed.to_string(),
          previous_index: 0,
        }],
        outputs: vec![
          wallet_out(900_000_000_000),
          opticrum_out(100_000_000_000, &order_args_hex, 65),
        ],
      },
    );
    // tx_match: creates the match cell (resolved only as the extract input).
    provider.add_transaction(
      tx_match,
      TransactionInfo {
        tx_hash: tx_match.to_string(),
        block_number: 102,
        inputs: vec![],
        outputs: vec![opticrum_out(100_000_000_000, &match_args_hex, 133)],
      },
    );
    // tx_extract: spends the match cell, settles 1000 CKB back to the wallet.
    provider.add_transaction(
      tx_extract,
      TransactionInfo {
        tx_hash: tx_extract.to_string(),
        block_number: 103,
        inputs: vec![TxInputInfo {
          previous_tx_hash: tx_match.to_string(),
          previous_index: 0,
        }],
        outputs: vec![wallet_out(100_000_000_000)],
      },
    );

    let txs = backend.get_transactions(None, None).await.unwrap();
    let by_hash = |hash: &str| -> &WalletTx {
      txs
        .iter()
        .find(|t| t.tx_hash == format!("0x{hash}"))
        .unwrap_or_else(|| panic!("tx 0x{hash} missing from history: {txs:#?}"))
    };

    assert_eq!(
      by_hash(tx_pledge).kind,
      WalletTxKind::RentPledge,
      "order-cell output must be RentPledge"
    );
    assert_eq!(by_hash(tx_pledge).amount_ckb, -1000.0, "pledge is outbound");
    assert_eq!(
      by_hash(tx_extract).kind,
      WalletTxKind::RentExtract,
      "spent match cell must be RentExtract"
    );
    assert_eq!(by_hash(tx_extract).amount_ckb, 1000.0, "extract is inbound");
    // A plain wallet receive stays Receive (no Opticrum contract).
    assert_eq!(by_hash(tx_seed).kind, WalletTxKind::Receive);
  }

  /// Seed a 1-address wallet with tx_a (block 100, wallet receives 10000 CKB)
  /// and tx_b (block 101, spends tx_a, pays 1000 out with 9000 change back).
  async fn seeded_history_backend(
    tip: u64,
  ) -> (
    RealWalletBackend<FakeRpcClient>,
    Arc<MockChainProvider>,
    String,
    String,
  ) {
    use crate::wallet::address;

    let tx_a = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string();
    let tx_b = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb".to_string();
    let mut fake = FakeRpcClient::default();
    fake.insert_fake_tx(Tx::Ungrouped(TxWithCell {
      tx_hash: tx_a.parse().unwrap(),
      block_number: 100u64.into(),
      tx_index: 0u32.into(),
      io_index: 0u32.into(),
      io_type: CellType::Output,
    }));
    fake.insert_fake_tx(Tx::Ungrouped(TxWithCell {
      tx_hash: tx_b.parse().unwrap(),
      block_number: 101u64.into(),
      tx_index: 0u32.into(),
      io_index: 0u32.into(),
      io_type: CellType::Input,
    }));
    let provider = Arc::new(MockChainProvider::new());
    provider.set_tip_block(tip);
    let db = init_test_db();
    let dir = tempfile::tempdir().unwrap();
    let keystore_path = dir.path().join("keystore.json");
    let backend = RealWalletBackend::new(
      fake,
      provider.clone(),
      db,
      keystore_path,
      true,
      1000,
      test_node_config(),
    );

    let created = backend
      .create_hd_wallet("test".into(), "pw".into(), 1)
      .await
      .unwrap();
    let lock_arg = address::lock_arg_from_address(&created.address).unwrap();
    let lock_code = hex::encode(crate::wallet::address::SIGHASH_TYPE_HASH);
    let lock_args = hex::encode(lock_arg);

    let wallet_out = |capacity: u64| TxOutputInfo {
      capacity,
      lock_code_hash: lock_code.clone(),
      lock_hash_type: "Type".to_string(),
      lock_args_hex: lock_args.clone(),
      lock_args_len: 20,
      data_hex: String::new(),
    };
    let other_out = TxOutputInfo {
      capacity: 100_000_000_000, // 1000 CKB to a third party
      lock_code_hash: "00".repeat(32),
      lock_hash_type: "Type".to_string(),
      lock_args_hex: "00".repeat(20),
      lock_args_len: 20,
      data_hex: String::new(),
    };

    provider.add_transaction(
      &tx_a,
      TransactionInfo {
        tx_hash: tx_a.clone(),
        block_number: 100,
        inputs: vec![],
        outputs: vec![wallet_out(1_000_000_000_000)],
      },
    );
    provider.add_transaction(
      &tx_b,
      TransactionInfo {
        tx_hash: tx_b.clone(),
        block_number: 101,
        inputs: vec![TxInputInfo {
          previous_tx_hash: tx_a.clone(),
          previous_index: 0,
        }],
        outputs: vec![wallet_out(900_000_000_000), other_out],
      },
    );

    (backend, provider, tx_a, tx_b)
  }

  /// Seed a 1-address wallet with a single tx at `block` that pays the wallet
  /// 10000 CKB (a pure receive).
  async fn seeded_single_tx_backend(
    tx_hash: &str,
    block: u64,
  ) -> (RealWalletBackend<FakeRpcClient>, Arc<MockChainProvider>) {
    use crate::wallet::address;

    let mut fake = FakeRpcClient::default();
    fake.insert_fake_tx(Tx::Ungrouped(TxWithCell {
      tx_hash: tx_hash.parse().unwrap(),
      block_number: block.into(),
      tx_index: 0u32.into(),
      io_index: 0u32.into(),
      io_type: CellType::Output,
    }));
    let provider = Arc::new(MockChainProvider::new());
    let db = init_test_db();
    let dir = tempfile::tempdir().unwrap();
    let keystore_path = dir.path().join("keystore.json");
    let backend = RealWalletBackend::new(
      fake,
      provider.clone(),
      db,
      keystore_path,
      true,
      1000,
      test_node_config(),
    );

    let created = backend
      .create_hd_wallet("test".into(), "pw".into(), 1)
      .await
      .unwrap();
    let lock_arg = address::lock_arg_from_address(&created.address).unwrap();
    let wallet_out = TxOutputInfo {
      capacity: 1_000_000_000_000,
      lock_code_hash: hex::encode(crate::wallet::address::SIGHASH_TYPE_HASH),
      lock_hash_type: "Type".to_string(),
      lock_args_hex: hex::encode(lock_arg),
      lock_args_len: 20,
      data_hex: String::new(),
    };
    provider.add_transaction(
      tx_hash,
      TransactionInfo {
        tx_hash: tx_hash.to_string(),
        block_number: block,
        inputs: vec![],
        outputs: vec![wallet_out],
      },
    );

    (backend, provider)
  }

  /// Sum received/sent CKB across the returned history.
  fn sum_flows(txs: &[WalletTx]) -> (f64, f64) {
    let mut recv = 0.0f64;
    let mut send = 0.0f64;
    for tx in txs {
      match tx.kind {
        WalletTxKind::Receive => recv += tx.amount_ckb,
        WalletTxKind::Send => send += tx.amount_ckb,
        _ => {}
      }
    }
    (recv, send)
  }

  #[tokio::test]
  async fn get_transactions_second_refresh_hits_cache_with_zero_rpc() {
    let (backend, provider, _tx_a, _tx_b) = seeded_history_backend(500).await;

    let txs = backend.get_transactions(None, None).await.unwrap();
    assert_eq!(sum_flows(&txs), (10000.0, -1000.0));
    assert!(
      provider
        .get_transaction_calls
        .load(std::sync::atomic::Ordering::Relaxed)
        > 0,
      "first refresh must trace from the chain"
    );

    // Reset the RPC counters — the second refresh must be served entirely from
    // the DB cache (both the per-tx fetch and tx_b's input-prev resolution).
    provider
      .get_transaction_calls
      .store(0, std::sync::atomic::Ordering::Relaxed);
    provider
      .get_block_timestamp_calls
      .store(0, std::sync::atomic::Ordering::Relaxed);

    let txs2 = backend.get_transactions(None, None).await.unwrap();
    assert_eq!(sum_flows(&txs2), (10000.0, -1000.0));
    assert_eq!(
      provider
        .get_transaction_calls
        .load(std::sync::atomic::Ordering::Relaxed),
      0,
      "second refresh must not re-fetch any tx"
    );
    assert_eq!(
      provider
        .get_block_timestamp_calls
        .load(std::sync::atomic::Ordering::Relaxed),
      0,
      "block timestamps must come from the cache"
    );
  }

  #[tokio::test]
  async fn get_transactions_near_tip_is_re_traced_not_cached() {
    // tx at block 495, tip 500 → stable_bound 490: too close to the tip to trust.
    let tx_hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let (backend, provider) = seeded_single_tx_backend(tx_hash, 495).await;
    provider.set_tip_block(500);

    let txs = backend.get_transactions(None, None).await.unwrap();
    assert_eq!(txs.len(), 1);
    {
      let mut conn = backend.db.lock().unwrap();
      assert!(
        txs_cache::get_cached(&mut conn, Chain::Testnet, tx_hash)
          .unwrap()
          .is_none(),
        "near-tip tx must not be cached"
      );
    }

    provider
      .get_transaction_calls
      .store(0, std::sync::atomic::Ordering::Relaxed);
    let _ = backend.get_transactions(None, None).await.unwrap();
    assert!(
      provider
        .get_transaction_calls
        .load(std::sync::atomic::Ordering::Relaxed)
        > 0,
      "near-tip tx must be re-traced on the next refresh"
    );
  }

  #[tokio::test]
  async fn get_transactions_unconfirmed_is_not_cached() {
    let tx_hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let (backend, provider) = seeded_single_tx_backend(tx_hash, 0).await; // block 0 = unconfirmed

    let txs = backend.get_transactions(None, None).await.unwrap();
    assert_eq!(txs.len(), 1);
    assert_eq!(txs[0].timestamp_ms, 0);
    {
      let mut conn = backend.db.lock().unwrap();
      assert!(
        txs_cache::get_cached(&mut conn, Chain::Testnet, tx_hash)
          .unwrap()
          .is_none(),
        "unconfirmed tx must never be cached"
      );
    }
    assert_eq!(
      provider
        .get_block_timestamp_calls
        .load(std::sync::atomic::Ordering::Relaxed),
      0,
      "no block-timestamp RPC for an unconfirmed tx"
    );
  }

  #[tokio::test]
  async fn get_transactions_updates_wallet_tx_top() {
    let (backend, _provider, _tx_a, tx_b) = seeded_history_backend(500).await;
    let _ = backend.get_transactions(None, None).await.unwrap();

    // The frontier is per child address; read the child wallet id.
    let child_id = {
      let mut conn = backend.db.lock().unwrap();
      wallets::list_wallets(&mut conn).unwrap()[0].id
    };
    let top = {
      let mut conn = backend.db.lock().unwrap();
      txs_cache::get_tx_top(&mut conn, Chain::Testnet, child_id)
        .unwrap()
        .unwrap()
    };
    assert_eq!(top.top_tx_hash, tx_b);
    assert_eq!(top.top_block_number, 101);
  }

  #[tokio::test]
  async fn create_wrong_password_fails() {
    let (backend, _provider) = test_backend();
    backend
      .create_hd_wallet("t".into(), "right".into(), 2)
      .await
      .unwrap();
    let err = backend.unlock("wrong".into(), None).await.unwrap_err();
    // Wrong password → `NotAuthorized` (distinct code so the frontend can
    // localize it; see wallet/crypto.rs).
    assert!(matches!(err, CommandError::NotAuthorized(_)));
  }

  #[tokio::test]
  async fn derive_addresses_persists_and_increments() {
    let (backend, _provider) = test_backend();
    backend
      .create_hd_wallet("t".into(), "pw".into(), 2)
      .await
      .unwrap();

    let before = backend.get_addresses().await.unwrap();
    assert_eq!(before.len(), 2);

    let new = backend.derive_addresses(3).await.unwrap();
    assert_eq!(new.len(), 3);

    let after = backend.get_addresses().await.unwrap();
    assert_eq!(after.len(), 5);
  }

  #[tokio::test]
  async fn send_ckb_broadcasts_signed_transaction() {
    use ckb_cinnabar_calculator::{
      re_exports::ckb_types::core::Capacity,
      simulation::{fake_header_view, fake_outpoint},
      skeleton::CellOutputEx,
    };

    let fake = FakeRpcClient::default();
    let provider = Arc::new(MockChainProvider::new());
    let db = init_test_db();
    let dir = tempfile::tempdir().unwrap();
    let keystore_path = dir.path().join("keystore.json");
    let backend = RealWalletBackend::new(
      fake,
      provider.clone(),
      db,
      keystore_path,
      true,
      1000,
      test_node_config(),
    );

    backend
      .create_hd_wallet("t".into(), "pw".into(), 1)
      .await
      .unwrap();

    // The sender is keyring[0]; its lock must be a cell in the fake chain.
    let (_, sk) = backend.keyring.lock().unwrap().first().cloned().unwrap();
    let secp = secp256k1::Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &sk);
    let lock_ex = secp256k1_lock_ex(&address::lock_arg_from_pubkey(&pk));
    let lock = lock_ex.to_script_unchecked();
    let cell = CellOutputEx::new_from_scripts(
      lock,
      None,
      vec![],
      Some(Capacity::shannons(100_000_000_000_000)),
    )
    .expect("sender cell");
    backend
      .rpc
      .lock()
      .unwrap()
      .insert_fake_cell(fake_outpoint(), cell, Some(fake_header_view(1, 1, 1)));

    // Recipient is the sender's own (valid) address — a self-transfer.
    let sender_addr = address::ckb_address_from_pubkey(&pk, true);
    let result = backend
      .send_ckb(sender_addr.clone(), 61_0000_0000, &NoopTxProgressReporter)
      .await
      .expect("send should broadcast");

    // MockChainProvider recorded exactly one broadcast.
    let submitted = provider.submitted_txs.lock().unwrap();
    assert_eq!(submitted.len(), 1);
    let recorded = submitted.first().unwrap();
    // decode and confirm it's a signed transaction
    let bytes = hex::decode(recorded).expect("recorded tx is hex");
    let tx: ckb_cinnabar_calculator::re_exports::ckb_jsonrpc_types::Transaction =
      serde_json::from_slice(&bytes).expect("recorded tx is JSON");
    assert!(!tx.witnesses.is_empty());
    assert!(!result.tx_hash.is_empty());
  }
}
