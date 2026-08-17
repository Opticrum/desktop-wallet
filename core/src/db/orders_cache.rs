//! Cache of the wallet's personal liquidity order cells, keyed by the
//! immutable outpoint. `cached_orders` stores the JSON-serialized `LiquidityOrder`
//! so loading renders without a chain scan; `orders_cache_meta` is a single-row
//! "primed" marker that tells whether a scan has ever completed (so an empty
//! wallet doesn't re-scan on every load).

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;

use crate::db::schema::{cached_orders, orders_cache_meta};
use crate::wire::{CommandError, LiquidityOrder};

/// Read every cached order (cache hit path — no chain access).
pub fn list_orders(conn: &mut SqliteConnection) -> Result<Vec<LiquidityOrder>, CommandError> {
  let rows = cached_orders::table
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

/// Insert or update a single order (used on publish so the new order shows
/// without waiting for the next scan).
pub fn upsert_order(
  conn: &mut SqliteConnection,
  order: &LiquidityOrder,
) -> Result<(), CommandError> {
  let data = serde_json::to_string(order)
    .map_err(|e| CommandError::internal(format!("cached_orders serialize: {e}")))?;
  let now = diesel::dsl::sql::<diesel::sql_types::Text>("datetime('now')");
  diesel::insert_into(cached_orders::table)
    .values((
      cached_orders::outpoint.eq(&order.outpoint),
      cached_orders::data.eq(&data),
    ))
    .on_conflict(cached_orders::outpoint)
    .do_update()
    .set((
      cached_orders::data.eq(&data),
      cached_orders::synced_at.eq(now),
    ))
    .execute(conn)
    .map_err(|e| CommandError::internal(format!("cached_orders upsert: {e}")))?;
  Ok(())
}

/// Replace the whole cache with a freshly scanned set (refresh path).
pub fn replace_all(
  conn: &mut SqliteConnection,
  orders: &[LiquidityOrder],
) -> Result<(), CommandError> {
  conn.transaction::<(), CommandError, _>(|conn| {
    diesel::delete(cached_orders::table)
      .execute(conn)
      .map_err(|e| CommandError::internal(format!("cached_orders clear: {e}")))?;
    for order in orders {
      upsert_order(conn, order)?;
    }
    Ok(())
  })
}

/// Whether a scan has ever completed (cache is authoritative even if empty).
pub fn is_primed(conn: &mut SqliteConnection) -> Result<bool, CommandError> {
  orders_cache_meta::table
    .count()
    .get_result::<i64>(conn)
    .map(|n| n > 0)
    .map_err(|e| CommandError::internal(format!("orders_cache_meta count: {e}")))
}

/// Mark the cache as primed (call after any successful scan).
pub fn mark_primed(conn: &mut SqliteConnection) -> Result<(), CommandError> {
  diesel::insert_into(orders_cache_meta::table)
    .values(orders_cache_meta::id.eq(1))
    .on_conflict_do_nothing()
    .execute(conn)
    .map_err(|e| CommandError::internal(format!("orders_cache_meta prime: {e}")))?;
  Ok(())
}
