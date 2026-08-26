//! Transaction trace-back cache — persistence for confirmed on-chain txs.
//!
//! Rows are scoped by CKB `chain` so mainnet and testnet history never mix.

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use diesel::OptionalExtension;

use crate::chain::chain_provider::{TransactionInfo, TxInputInfo, TxOutputInfo};
use crate::db::schema::{txs_cache, wallet_tx_tops};
use crate::wire::{Chain, CommandError};

/// A cached confirmed transaction as stored in the database.
#[derive(Clone, Debug, Queryable, Selectable, Identifiable)]
#[diesel(table_name = txs_cache, primary_key(tx_hash, chain))]
pub struct TxCacheRecord {
  pub tx_hash: String,
  pub chain: String,
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

/// The "top" (newest) transaction per managed wallet address + chain.
#[derive(Clone, Debug, Queryable, Selectable, Identifiable)]
#[diesel(table_name = wallet_tx_tops, primary_key(wallet_id, chain))]
pub struct WalletTxTop {
  pub wallet_id: i64,
  pub chain: String,
  pub top_tx_hash: String,
  pub top_block_number: i64,
  pub updated_at: String,
}

fn chain_key(chain: Chain) -> &'static str {
  match chain {
    Chain::Mainnet => "mainnet",
    Chain::Testnet => "testnet",
  }
}

/// Look up a cached tx by its bare 64-hex hash on the active chain.
pub fn get_cached(
  conn: &mut SqliteConnection,
  chain: Chain,
  tx_hash: &str,
) -> Result<Option<TxCacheRecord>, CommandError> {
  let c = chain_key(chain);
  txs_cache::table
    .filter(txs_cache::tx_hash.eq(tx_hash))
    .filter(txs_cache::chain.eq(c))
    .first(conn)
    .optional()
    .map_err(|e| CommandError::internal(e.to_string()))
}

/// Cache (or overwrite) a confirmed tx on the active chain.
pub fn upsert_cached(
  conn: &mut SqliteConnection,
  chain: Chain,
  info: &TransactionInfo,
  block_timestamp: u64,
) -> Result<(), CommandError> {
  let c = chain_key(chain);
  let inputs = serde_json::to_string(&info.inputs)
    .map_err(|e| CommandError::internal(format!("txs_cache inputs serialize: {e}")))?;
  let outputs = serde_json::to_string(&info.outputs)
    .map_err(|e| CommandError::internal(format!("txs_cache outputs serialize: {e}")))?;

  let now = diesel::dsl::sql::<diesel::sql_types::Text>("datetime('now')");
  diesel::insert_into(txs_cache::table)
    .values((
      txs_cache::tx_hash.eq(&info.tx_hash),
      txs_cache::chain.eq(c),
      txs_cache::block_number.eq(info.block_number as i64),
      txs_cache::block_timestamp.eq(block_timestamp as i64),
      txs_cache::inputs.eq(&inputs),
      txs_cache::outputs.eq(&outputs),
    ))
    .on_conflict((txs_cache::tx_hash, txs_cache::chain))
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
pub fn delete_cached(
  conn: &mut SqliteConnection,
  chain: Chain,
  tx_hash: &str,
) -> Result<bool, CommandError> {
  let c = chain_key(chain);
  let affected = diesel::delete(
    txs_cache::table
      .filter(txs_cache::tx_hash.eq(tx_hash))
      .filter(txs_cache::chain.eq(c)),
  )
  .execute(conn)
  .map_err(|e| CommandError::internal(e.to_string()))?;
  Ok(affected > 0)
}

/// Look up a wallet's cached top by wallet id + chain.
pub fn get_tx_top(
  conn: &mut SqliteConnection,
  chain: Chain,
  wallet_id: i64,
) -> Result<Option<WalletTxTop>, CommandError> {
  let c = chain_key(chain);
  wallet_tx_tops::table
    .filter(wallet_tx_tops::wallet_id.eq(wallet_id))
    .filter(wallet_tx_tops::chain.eq(c))
    .first(conn)
    .optional()
    .map_err(|e| CommandError::internal(e.to_string()))
}

/// Record (or advance) a wallet's top after a refresh.
pub fn upsert_tx_top(
  conn: &mut SqliteConnection,
  chain: Chain,
  wallet_id: i64,
  top_tx_hash: &str,
  top_block_number: i64,
) -> Result<(), CommandError> {
  let c = chain_key(chain);
  let now = diesel::dsl::sql::<diesel::sql_types::Text>("datetime('now')");
  diesel::insert_into(wallet_tx_tops::table)
    .values((
      wallet_tx_tops::wallet_id.eq(wallet_id),
      wallet_tx_tops::chain.eq(c),
      wallet_tx_tops::top_tx_hash.eq(top_tx_hash),
      wallet_tx_tops::top_block_number.eq(top_block_number),
    ))
    .on_conflict((wallet_tx_tops::wallet_id, wallet_tx_tops::chain))
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

/// Delete all tops for a wallet (any chain). Returns true if any row was deleted.
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
  fn txs_cache_scoped_by_chain() {
    let mut conn = init_test_db();
    let hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    upsert_cached(&mut conn, Chain::Testnet, &sample_info(hash), 100).unwrap();
    upsert_cached(&mut conn, Chain::Mainnet, &sample_info(hash), 200).unwrap();
    let tn = get_cached(&mut conn, Chain::Testnet, hash).unwrap().unwrap();
    let mn = get_cached(&mut conn, Chain::Mainnet, hash).unwrap().unwrap();
    assert_eq!(tn.block_timestamp, 100);
    assert_eq!(mn.block_timestamp, 200);
  }

  #[test]
  fn wallet_tx_top_scoped_by_chain() {
    let mut conn = init_test_db();
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
    upsert_tx_top(&mut conn, Chain::Testnet, wallet_id, hash_a, 100).unwrap();
    upsert_tx_top(&mut conn, Chain::Mainnet, wallet_id, hash_b, 200).unwrap();
    assert_eq!(
      get_tx_top(&mut conn, Chain::Testnet, wallet_id)
        .unwrap()
        .unwrap()
        .top_tx_hash,
      hash_a
    );
    assert_eq!(
      get_tx_top(&mut conn, Chain::Mainnet, wallet_id)
        .unwrap()
        .unwrap()
        .top_tx_hash,
      hash_b
    );
  }
}
