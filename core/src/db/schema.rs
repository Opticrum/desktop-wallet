//! Database schema — Diesel table definitions and migration runner.
//!
//! The actual migration SQL lives in `migrations/`. At compile time,
//! `embed_migrations!()` bundles it. At startup, `run_migrations`
//! runs any pending migrations via Diesel's versioned migration system.

use diesel::sqlite::SqliteConnection;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

use crate::wire::CommandError;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

/// Run pending schema migrations. Uses Diesel's versioned migration
/// tracking table (`__diesel_schema_migrations`) to know which have
/// already been applied.
pub fn run_migrations(conn: &mut SqliteConnection) -> Result<(), CommandError> {
  log::info!("Running pending database migrations");
  conn
    .run_pending_migrations(MIGRATIONS)
    .map_err(|e| CommandError::internal(format!("Migration failed: {e}")))?;
  log::info!("Database migrations complete");
  Ok(())
}

// ---------------------------------------------------------------------------
// Diesel table! definitions
// ---------------------------------------------------------------------------

diesel::table! {
    wallets (id) {
        id -> BigInt,
        label -> Text,
        encrypted_key -> Binary,
        lock_hash -> Binary,
        ckb_address -> Text,
        created_at -> Text,
        parent_wallet_id -> Nullable<BigInt>,
        derivation_path -> Nullable<Text>,
        derivation_index -> Nullable<Integer>,
        wallet_type -> Text,
    }
}

diesel::table! {
    txs_cache (tx_hash) {
        tx_hash -> Text,
        block_number -> BigInt,
        block_timestamp -> BigInt,
        inputs -> Text,
        outputs -> Text,
        cached_at -> Text,
    }
}

diesel::table! {
    wallet_tx_tops (wallet_id) {
        wallet_id -> BigInt,
        top_tx_hash -> Text,
        top_block_number -> BigInt,
        updated_at -> Text,
    }
}

diesel::table! {
    cached_orders (outpoint) {
        outpoint -> Text,
        data -> Text,
        synced_at -> Text,
    }
}

diesel::table! {
    orders_cache_meta (id) {
        id -> Integer,
        primed_at -> Text,
    }
}
