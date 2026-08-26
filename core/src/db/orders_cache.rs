//! Cache of the wallet's personal liquidity order cells, keyed by the
//! immutable outpoint **and** CKB chain. `cached_orders` stores the
//! JSON-serialized `LiquidityOrder` so loading renders without a chain scan;
//! `orders_cache_meta` is a per-chain "primed" marker.

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;

use crate::db::schema::{cached_orders, orders_cache_meta};
use crate::wire::{Chain, CommandError, LiquidityOrder};

fn chain_key(chain: Chain) -> &'static str {
  match chain {
    Chain::Mainnet => "mainnet",
    Chain::Testnet => "testnet",
  }
}

/// Read every cached order for `chain` (cache hit path — no chain access).
pub fn list_orders(
  conn: &mut SqliteConnection,
  chain: Chain,
) -> Result<Vec<LiquidityOrder>, CommandError> {
  let c = chain_key(chain);
  let rows = cached_orders::table
    .filter(cached_orders::chain.eq(c))
    .select(cached_orders::data)
    .load::<String>(conn)
    .map_err(|e| CommandError::internal(format!("cached_orders load: {e}")))?;
  rows
    .into_iter()
    .map(|data| {
      serde_json::from_str(&data)
        .map_err(|e| CommandError::internal(format!("cached_orders deserialize: {e}")))
    })
    .collect()
}

/// Insert or update a single order on `chain`.
pub fn upsert_order(
  conn: &mut SqliteConnection,
  chain: Chain,
  order: &LiquidityOrder,
) -> Result<(), CommandError> {
  let c = chain_key(chain);
  let data = serde_json::to_string(order)
    .map_err(|e| CommandError::internal(format!("cached_orders serialize: {e}")))?;
  let now = diesel::dsl::sql::<diesel::sql_types::Text>("datetime('now')");
  diesel::insert_into(cached_orders::table)
    .values((
      cached_orders::outpoint.eq(&order.outpoint),
      cached_orders::chain.eq(c),
      cached_orders::data.eq(&data),
    ))
    .on_conflict((cached_orders::outpoint, cached_orders::chain))
    .do_update()
    .set((
      cached_orders::data.eq(&data),
      cached_orders::synced_at.eq(now),
    ))
    .execute(conn)
    .map_err(|e| CommandError::internal(format!("cached_orders upsert: {e}")))?;
  Ok(())
}

/// Replace the whole cache for `chain` with a freshly scanned set.
pub fn replace_all(
  conn: &mut SqliteConnection,
  chain: Chain,
  orders: &[LiquidityOrder],
) -> Result<(), CommandError> {
  let c = chain_key(chain);
  conn.transaction::<(), CommandError, _>(|conn| {
    diesel::delete(cached_orders::table.filter(cached_orders::chain.eq(c)))
      .execute(conn)
      .map_err(|e| CommandError::internal(format!("cached_orders clear: {e}")))?;
    for order in orders {
      upsert_order(conn, chain, order)?;
    }
    Ok(())
  })
}

/// Whether a scan has ever completed for `chain`.
pub fn is_primed(conn: &mut SqliteConnection, chain: Chain) -> Result<bool, CommandError> {
  let c = chain_key(chain);
  orders_cache_meta::table
    .filter(orders_cache_meta::chain.eq(c))
    .count()
    .get_result::<i64>(conn)
    .map(|n| n > 0)
    .map_err(|e| CommandError::internal(format!("orders_cache_meta count: {e}")))
}

/// Mark the cache as primed for `chain`.
pub fn mark_primed(conn: &mut SqliteConnection, chain: Chain) -> Result<(), CommandError> {
  let c = chain_key(chain);
  diesel::insert_into(orders_cache_meta::table)
    .values(orders_cache_meta::chain.eq(c))
    .on_conflict_do_nothing()
    .execute(conn)
    .map_err(|e| CommandError::internal(format!("orders_cache_meta prime: {e}")))?;
  Ok(())
}
