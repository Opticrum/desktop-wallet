//! Database initialization and migrations.
//!
//! Provides `init_db()` which opens the SQLite connection (Diesel-backed)
//! and runs migrations, and `init_test_db()` for an in-memory test database.

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::path::Path;

use crate::wire::CommandError;

pub mod schema;
pub mod txs_cache;
pub mod wallets;

/// Open the SQLite database and run migrations.
///
/// If the database file does not exist, it will be created.
/// Creates parent directories automatically. Returns a single
/// `SqliteConnection` (desktop app: no connection pool).
pub fn init_db(database_url: &str) -> Result<SqliteConnection, CommandError> {
  // Ensure parent directory exists
  if let Some(parent) = Path::new(database_url).parent() {
    if !parent.as_os_str().is_empty() {
      std::fs::create_dir_all(parent)
        .map_err(|e| CommandError::internal(format!("Failed to create data dir: {e}")))?;
    }
  }

  let mut conn = SqliteConnection::establish(database_url)
    .map_err(|e| CommandError::internal(format!("Failed to open database: {e}")))?;
  schema::run_migrations(&mut conn)?;
  Ok(conn)
}

/// Initialize an in-memory database for testing.
///
/// Uses a unique shared-cache in-memory database so the single connection
/// sees its own writes. (Plain `:memory:` creates a distinct database per
/// connection, which breaks SQLite's connection model.)
pub fn init_test_db() -> SqliteConnection {
  use std::sync::atomic::{AtomicUsize, Ordering};
  static TEST_DB_COUNTER: AtomicUsize = AtomicUsize::new(0);
  let id = TEST_DB_COUNTER.fetch_add(1, Ordering::Relaxed);
  let url = format!("file:test_db_{id}?mode=memory&cache=shared");

  let mut conn = SqliteConnection::establish(&url).expect("Failed to create test database");
  schema::run_migrations(&mut conn).expect("Failed to run test migrations");
  conn
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::db::wallets;

  #[test]
  fn wallets_crud_roundtrip() {
    let mut conn = init_test_db();
    let id = wallets::insert_wallet(
      &mut conn,
      "label-a",
      &[1u8; 32],
      &[2u8; 32],
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s2p",
      None,
      None,
      None,
      "imported",
    )
    .unwrap();
    let w = wallets::get_wallet_by_id(&mut conn, id).unwrap();
    assert_eq!(w.label, "label-a");
    assert_eq!(w.wallet_type, "imported");
    assert_eq!(w.encrypted_key, vec![1u8; 32]);

    let listed = wallets::list_wallets(&mut conn).unwrap();
    assert_eq!(listed.len(), 1);

    let by_hash = wallets::get_wallet_by_lock_hash(&mut conn, &[2u8; 32]).unwrap();
    assert_eq!(by_hash.id, id);

    assert!(wallets::delete_wallet(&mut conn, id).unwrap());
    assert!(wallets::get_wallet_by_id(&mut conn, id).is_err());
  }

  #[test]
  fn init_db_creates_file_and_migrates() {
    let dir = tempfile::tempdir().unwrap();
    let url = dir.path().join("test.db");
    let mut conn = init_db(url.to_str().unwrap()).unwrap();
    // migrations ran — the wallets table is queryable
    let listed = wallets::list_wallets(&mut conn).unwrap();
    assert!(listed.is_empty());
    assert!(url.exists());
  }
}
