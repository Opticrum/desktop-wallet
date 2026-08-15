//! Chain provider — abstraction over CKB RPC and indexer.
//!
//! The `ChainProvider` trait allows the service layer to interact with
//! the CKB chain without depending on a specific RPC implementation.
//! `MockChainProvider` is used in tests; `RealChainProvider` in production.

use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Mutex;

use crate::wire::CommandError;

/// Chain provider trait — abstracts CKB RPC calls.
///
/// All methods are async and return `Result<T, CommandError>` so they
/// compose cleanly with the service layer's error handling.
#[async_trait]
pub trait ChainProvider: Send + Sync {
  /// Get current tip block number.
  async fn get_tip_block_number(&self) -> Result<u64, CommandError>;

  /// Submit a signed transaction. Returns the tx_hash (32 bytes as hex).
  async fn send_transaction(&self, tx_hex: &str) -> Result<String, CommandError>;

  /// Wait until the transaction is confirmed on-chain — committed in a block
  /// and `confirm_count` further blocks past it. `confirm_count == 0` returns
  /// immediately after broadcast. Returns the tx hash once confirmed, or an
  /// error on timeout / rejection. Default: consider the tx confirmed
  /// immediately (mock/instant providers).
  async fn wait_for_confirmation(
    &self,
    tx_hash: &str,
    _confirm_count: u8,
    _timeout: Option<std::time::Duration>,
  ) -> Result<String, CommandError> {
    Ok(tx_hash.to_string())
  }

  /// Get the CKB network this provider is connected to ("testnet" or "mainnet").
  /// Defaults to "testnet" — production implementations should override this.
  fn network(&self) -> crate::wire::Chain {
    crate::wire::Chain::Testnet
  }

  /// Get the timestamp (Unix milliseconds) of a block by its number.
  /// Returns 0 if the block is not found.
  async fn get_block_timestamp(&self, _block_number: u64) -> Result<u64, CommandError> {
    Ok(0)
  }

  /// Get full transaction data from CKB RPC.
  ///
  /// Returns the transaction hex, block number, and metadata.
  /// Used for extraction backtracking — walking the transaction graph
  /// to reconstruct extraction history from on-chain data.
  async fn get_transaction(&self, _tx_hash: &str) -> Result<TransactionInfo, CommandError> {
    Err(CommandError::chain("get_transaction not implemented"))
  }

  /// Query live cells locked by a given lock hash.
  /// Returns the cell outputs with their capacities.
  /// Default: no-op (MockChainProvider overrides with in-memory filter,
  /// RealChainProvider queries the CKB indexer).
  async fn get_cells_by_lock(
    &self,
    _lock_hash: &[u8; 32],
  ) -> Result<Vec<CellOutput>, CommandError> {
    Ok(Vec::new())
  }

  /// Query live cells for a secp256k1_blake160 lock script (by lock args).
  async fn get_cells_by_lock_arg(
    &self,
    _lock_arg: &[u8; 20],
  ) -> Result<Vec<CellOutput>, CommandError> {
    Ok(Vec::new())
  }

  /// Get total CKB balance for a CKB address (preferred — queries indexer by lock args).
  async fn get_balance_by_address(&self, address: &str) -> Result<u64, CommandError> {
    use crate::wallet::address::{lock_arg_from_address, script_lock_hash};
    let lock_arg = lock_arg_from_address(address)?;
    let lock_hash = script_lock_hash(&lock_arg);
    let cells = self.get_cells_by_lock_arg(&lock_arg).await?;
    if cells.is_empty() {
      // Fallback for providers that only implement lock_hash lookup.
      let fallback = self.get_cells_by_lock(&lock_hash).await?;
      Ok(fallback.iter().map(|c| c.capacity).sum())
    } else {
      Ok(cells.iter().map(|c| c.capacity).sum())
    }
  }
}

// ---------------------------------------------------------------------------
// Lightweight chain types (avoid heavy CKB type deps in trait)
// ---------------------------------------------------------------------------

/// Lightweight cell output info returned by the chain provider.
#[derive(Clone, Debug, PartialEq)]
pub struct CellOutput {
  pub capacity: u64,
  pub lock_hash: [u8; 32],
  pub type_hash: Option<[u8; 32]>,
  pub data: Vec<u8>,
}

/// An input reference in a CKB transaction — points to a previous output.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct TxInputInfo {
  /// Hex-encoded tx_hash of the previous transaction.
  pub previous_tx_hash: String,
  /// Output index in the previous transaction.
  pub previous_index: u32,
}

/// An output in a CKB transaction with its lock script and data.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct TxOutputInfo {
  /// Capacity in shannons.
  pub capacity: u64,
  /// Hex-encoded lock script code_hash (H256).
  pub lock_code_hash: String,
  /// Lock script hash type: "Type", "Data", "Data1", or "Data2".
  pub lock_hash_type: String,
  /// Hex-encoded lock script args bytes.
  pub lock_args_hex: String,
  /// Byte length of lock args (65 = Order cell, 133 = Match cell).
  pub lock_args_len: usize,
  /// Hex-encoded cell data (e.g. MatchData for match cells).
  pub data_hex: String,
}

/// Full transaction data retrieved from the CKB chain.
///
/// Used for extraction backtracking — walking the transaction graph
/// to trace how a match cell evolved through multiple rent extractions.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct TransactionInfo {
  /// Transaction hash (hex-encoded, 64 chars).
  pub tx_hash: String,
  /// Block number where the transaction was confirmed, or 0 if pending.
  pub block_number: u64,
  /// Consumed cell references (inputs).
  pub inputs: Vec<TxInputInfo>,
  /// Created cells with lock scripts and data (outputs).
  pub outputs: Vec<TxOutputInfo>,
}

impl TransactionInfo {
  /// Construct a minimal TransactionInfo from tx_hex for backward
  /// compatibility with callers that only have raw hex.
  pub fn from_hex(tx_hash: String, block_number: u64, _tx_hex: &str) -> Self {
    Self {
      tx_hash,
      block_number,
      inputs: Vec::new(),
      outputs: Vec::new(),
    }
  }
}

// ---------------------------------------------------------------------------
// Mock chain provider (for tests)
// ---------------------------------------------------------------------------

/// Mock chain provider for unit tests.
///
/// Holds in-memory state: configurable tip block, pre-loaded cells,
/// and a record of submitted transactions.
pub struct MockChainProvider {
  pub tip_block: Mutex<u64>,
  pub submitted_txs: Mutex<Vec<String>>,
  pub cells: Mutex<std::collections::HashMap<(String, u32), CellOutput>>,
  pub transactions: Mutex<HashMap<String, TransactionInfo>>,
  /// RPC-call counters — tests assert the tx cache makes later refreshes
  /// hit zero chain reads.
  pub get_transaction_calls: std::sync::atomic::AtomicU64,
  pub get_block_timestamp_calls: std::sync::atomic::AtomicU64,
}

impl Default for MockChainProvider {
  fn default() -> Self {
    Self::new()
  }
}

impl MockChainProvider {
  pub fn new() -> Self {
    Self {
      tip_block: Mutex::new(1000),
      submitted_txs: Mutex::new(Vec::new()),
      cells: Mutex::new(std::collections::HashMap::new()),
      transactions: Mutex::new(HashMap::new()),
      get_transaction_calls: std::sync::atomic::AtomicU64::new(0),
      get_block_timestamp_calls: std::sync::atomic::AtomicU64::new(0),
    }
  }

  pub fn set_tip_block(&self, block: u64) {
    *self.tip_block.lock().unwrap() = block;
  }

  pub fn add_cell(&self, tx_hash: &str, index: u32, cell: CellOutput) {
    self
      .cells
      .lock()
      .unwrap()
      .insert((tx_hash.to_string(), index), cell);
  }

  pub fn add_transaction(&self, tx_hash: &str, info: TransactionInfo) {
    self
      .transactions
      .lock()
      .unwrap()
      .insert(tx_hash.to_string(), info);
  }
}

#[async_trait]
impl ChainProvider for MockChainProvider {
  async fn get_tip_block_number(&self) -> Result<u64, CommandError> {
    Ok(*self.tip_block.lock().unwrap())
  }

  async fn send_transaction(&self, tx_hex: &str) -> Result<String, CommandError> {
    use std::hash::{Hash, Hasher};
    self.submitted_txs.lock().unwrap().push(tx_hex.to_string());
    // Generate a deterministic 64-char hex tx hash from the input, `0x`-prefixed
    // to match the wire / RealChainProvider convention.
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    tx_hex.hash(&mut hasher);
    let h = hasher.finish();
    Ok(format!("0x{:064x}", h))
  }

  async fn get_cells_by_lock(&self, lock_hash: &[u8; 32]) -> Result<Vec<CellOutput>, CommandError> {
    Ok(
      self
        .cells
        .lock()
        .unwrap()
        .values()
        .filter(|c| &c.lock_hash == lock_hash)
        .cloned()
        .collect(),
    )
  }

  async fn get_cells_by_lock_arg(
    &self,
    lock_arg: &[u8; 20],
  ) -> Result<Vec<CellOutput>, CommandError> {
    use crate::wallet::address::script_lock_hash;
    let lock_hash = script_lock_hash(lock_arg);
    self.get_cells_by_lock(&lock_hash).await
  }

  async fn get_transaction(&self, tx_hash: &str) -> Result<TransactionInfo, CommandError> {
    self
      .get_transaction_calls
      .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    self
      .transactions
      .lock()
      .unwrap()
      .get(tx_hash)
      .cloned()
      .ok_or_else(|| CommandError::invalid_input(format!("Transaction {tx_hash} not found")))
  }

  /// Overridden from the trait default so the cache test can assert that no
  /// block-timestamp RPC happens on a cache hit (the default is a silent no-op).
  async fn get_block_timestamp(&self, _block_number: u64) -> Result<u64, CommandError> {
    self
      .get_block_timestamp_calls
      .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    Ok(0)
  }
}
