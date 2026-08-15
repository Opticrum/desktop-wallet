//! Transaction trace-back cache — persistence for confirmed on-chain txs.
//!
//! `txs_cache` stores the raw, immutable `TransactionInfo` (inputs/outputs as
//! JSON) for every confirmed tx the wallet has resolved, keyed by bare 64-hex
//! tx_hash. `RealWalletBackend::get_transactions` reads through this cache so a
//! refresh never re-RPCs a tx it already resolved; the trace-back "stops" the
//! moment it reaches a cached row.
//!
//! `wallet_tx_tops` records the per-address "top" (newest tx) seen by the last
//! refresh — the frontier kept up-to-date every refresh.

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use diesel::OptionalExtension;

use crate::chain::chain_provider::{TransactionInfo, TxInputInfo, TxOutputInfo};
use crate::db::schema::{txs_cache, wallet_tx_tops};
use crate::wire::CommandError;

/// A cached confirmed transaction as stored in the database.
#[derive(Clone, Debug, Queryable, Selectable, Identifiable)]
#[diesel(table_name = txs_cache, primary_key(tx_hash))]
pub struct TxCacheRecord {
  pub tx_hash: String,
  pub block_number: i64,
  pub block_timestamp: i64,
  pub inputs: String,
  pub outputs: String,
  pub cached_at: String,
}

impl TxCacheRecord {
  /// Reconstruct the raw `TransactionInfo` (deserializes the JSON I/O lists).
  pub fn into_info(&self) -> Result<TransactionInfo, CommandError> {
    let inputs: Vec<TxInputInfo> = serde_json::from_str(&self.inputs)
      .map_err(|e| CommandError::internal(format!("txs_cache inputs parse: {e}")))?;
    let outputs: Vec<TxOutputInfo> = serde_json::from_str(&self.outputs)
      .map_err(|e| CommandError::internal(format!("txs_cache outputs parse: {e}")))?;
    Ok(TransactionInfo {
      tx_hash: self.tx_hash.clone(),
      block_number: self.block_number as u64,
      inputs,
      outputs,
    })
  }
}

/// The "top" (newest) transaction per managed wallet address.
#[derive(Clone, Debug, Queryable, Selectable, Identifiable)]
#[diesel(table_name = wallet_tx_tops, primary_key(wallet_id))]
pub struct WalletTxTop {
  pub wallet_id: i64,
  pub top_tx_hash: String,
  pub top_block_number: i64,
  pub updated_at: String,
}

/// Look up a cached tx by its bare 64-hex hash.
pub fn get_cached(
  conn: &mut SqliteConnection,
  tx_hash: &str,
) -> Result<Option<TxCacheRecord>, CommandError> {
  txs_cache::table
    .filter(txs_cache::tx_hash.eq(tx_hash))
    .first(conn)
    .optional()
    .map_err(|e| CommandError::internal(e.to_string()))
}

/// Cache (or overwrite) a confirmed tx. A reorg-overwritten row is replaced by
/// the latest re-trace.
pub fn upsert_cached(
  conn: &mut SqliteConnection,
  info: &TransactionInfo,
  block_timestamp: u64,
) -> Result<(), CommandError> {
  let inputs = serde_json::to_string(&info.inputs)
    .map_err(|e| CommandError::internal(format!("txs_cache inputs serialize: {e}")))?;
  let outputs = serde_json::to_string(&info.outputs)
    .map_err(|e| CommandError::internal(format!("txs_cache outputs serialize: {e}")))?;

  let now = diesel::dsl::sql::<diesel::sql_types::Text>("datetime('now')");
  diesel::insert_into(txs_cache::table)
    .values((
      txs_cache::tx_hash.eq(&info.tx_hash),
      txs_cache::block_number.eq(info.block_number as i64),
      txs_cache::block_timestamp.eq(block_timestamp as i64),
      txs_cache::inputs.eq(&inputs),
      txs_cache::outputs.eq(&outputs),
    ))
    .on_conflict(txs_cache::tx_hash)
    .do_update()
    .set((
      txs_cache::block_number.eq(info.block_number as i64),
      txs_cache::block_timestamp.eq(block_timestamp as i64),
      txs_cache::inputs.eq(&inputs),
      txs_cache::outputs.eq(&outputs),
      txs_cache::cached_at.eq(now),
    ))
    .execute(conn)
    .map_err(|e| CommandError::internal(e.to_string()))?;
  Ok(())
}

/// Delete a cached tx. Returns true if a row was deleted.
pub fn delete_cached(conn: &mut SqliteConnection, tx_hash: &str) -> Result<bool, CommandError> {
  let affected = diesel::delete(txs_cache::table.filter(txs_cache::tx_hash.eq(tx_hash)))
    .execute(conn)
    .map_err(|e| CommandError::internal(e.to_string()))?;
  Ok(affected > 0)
}

/// Look up a wallet's cached top by wallet id.
pub fn get_tx_top(
  conn: &mut SqliteConnection,
  wallet_id: i64,
) -> Result<Option<WalletTxTop>, CommandError> {
  wallet_tx_tops::table
    .filter(wallet_tx_tops::wallet_id.eq(wallet_id))
    .first(conn)
    .optional()
    .map_err(|e| CommandError::internal(e.to_string()))
}

/// Record (or advance) a wallet's top after a refresh.
pub fn upsert_tx_top(
  conn: &mut SqliteConnection,
  wallet_id: i64,
  top_tx_hash: &str,
  top_block_number: i64,
) -> Result<(), CommandError> {
  let now = diesel::dsl::sql::<diesel::sql_types::Text>("datetime('now')");
  diesel::insert_into(wallet_tx_tops::table)
    .values((
      wallet_tx_tops::wallet_id.eq(wallet_id),
      wallet_tx_tops::top_tx_hash.eq(top_tx_hash),
      wallet_tx_tops::top_block_number.eq(top_block_number),
    ))
    .on_conflict(wallet_tx_tops::wallet_id)
    .do_update()
    .set((
      wallet_tx_tops::top_tx_hash.eq(top_tx_hash),
      wallet_tx_tops::top_block_number.eq(top_block_number),
      wallet_tx_tops::updated_at.eq(now),
    ))
    .execute(conn)
    .map_err(|e| CommandError::internal(e.to_string()))?;
  Ok(())
}

/// Delete a wallet's top row. Returns true if a row was deleted.
pub fn delete_tx_top(conn: &mut SqliteConnection, wallet_id: i64) -> Result<bool, CommandError> {
  let affected =
    diesel::delete(wallet_tx_tops::table.filter(wallet_tx_tops::wallet_id.eq(wallet_id)))
      .execute(conn)
      .map_err(|e| CommandError::internal(e.to_string()))?;
  Ok(affected > 0)
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::db::init_test_db;

  fn sample_info(tx_hash: &str) -> TransactionInfo {
    TransactionInfo {
      tx_hash: tx_hash.to_string(),
      block_number: 123,
      inputs: vec![TxInputInfo {
        previous_tx_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb".into(),
        previous_index: 0,
      }],
      outputs: vec![TxOutputInfo {
        capacity: 1_0000_0000_0000,
        lock_code_hash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc".into(),
        lock_hash_type: "Type".into(),
        lock_args_hex: "d1d2d3d4".into(),
        lock_args_len: 4,
        data_hex: "".into(),
      }],
    }
  }

  #[test]
  fn txs_cache_upsert_and_load_roundtrip() {
    let mut conn = init_test_db();
    let hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    upsert_cached(&mut conn, &sample_info(hash), 1_785_290_000_000).unwrap();
    let row = get_cached(&mut conn, hash).unwrap().expect("cached");
    assert_eq!(row.tx_hash, hash);
    assert_eq!(row.block_number, 123);
    assert_eq!(row.block_timestamp, 1_785_290_000_000);
    let info = row.into_info().unwrap();
    assert_eq!(info.block_number, 123);
    assert_eq!(info.inputs.len(), 1);
    assert_eq!(info.inputs[0].previous_index, 0);
    assert_eq!(info.outputs.len(), 1);
    assert_eq!(info.outputs[0].capacity, 1_0000_0000_0000);
  }

  #[test]
  fn txs_cache_get_missing_returns_none() {
    let mut conn = init_test_db();
    let hash = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    assert!(get_cached(&mut conn, hash).unwrap().is_none());
  }

  #[test]
  fn txs_cache_upsert_overwrites() {
    let mut conn = init_test_db();
    let hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    upsert_cached(&mut conn, &sample_info(hash), 100).unwrap();
    let mut updated = sample_info(hash);
    updated.block_number = 456;
    upsert_cached(&mut conn, &updated, 200).unwrap();
    let row = get_cached(&mut conn, hash).unwrap().unwrap();
    assert_eq!(row.block_number, 456);
    assert_eq!(row.block_timestamp, 200);
  }

  #[test]
  fn wallet_tx_top_upsert_get_delete_roundtrip() {
    let mut conn = init_test_db();
    // Diesel's SqliteConnection enforces FKs — the top must reference a real
    // wallet row.
    let wallet_id = crate::db::wallets::insert_wallet(
      &mut conn,
      "label",
      &[1u8; 32],
      &[2u8; 32],
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s2p",
      None,
      None,
      None,
      "imported",
    )
    .unwrap();
    let hash_a = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let hash_b = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    upsert_tx_top(&mut conn, wallet_id, hash_a, 100).unwrap();
    let top = get_tx_top(&mut conn, wallet_id).unwrap().unwrap();
    assert_eq!(top.top_tx_hash, hash_a);
    assert_eq!(top.top_block_number, 100);
    // Re-upsert advances the top.
    upsert_tx_top(&mut conn, wallet_id, hash_b, 200).unwrap();
    let top = get_tx_top(&mut conn, wallet_id).unwrap().unwrap();
    assert_eq!(top.top_tx_hash, hash_b);
    assert_eq!(top.top_block_number, 200);
    assert!(delete_tx_top(&mut conn, wallet_id).unwrap());
    assert!(get_tx_top(&mut conn, wallet_id).unwrap().is_none());
  }
}
