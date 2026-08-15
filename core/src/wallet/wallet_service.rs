//! Wallet service — key management, derivation, and balance aggregation.
//!
//! Ported from `rust-server/src/services/wallet/wallet_service.rs` with the
//! `&DbPool` → `&mut SqliteConnection` adaptation (desktop single-writer) and
//! an explicit `testnet` flag instead of a hardcoded `true`.

use bip39::Mnemonic;
use diesel::sqlite::SqliteConnection;
use secp256k1::{PublicKey, SecretKey};
use std::path::Path;

use crate::chain::chain_provider::ChainProvider;
use crate::db::wallets::{self, WalletRecord};
use crate::wallet::address::{
  blake160, ckb_address_from_pubkey, lock_arg_from_pubkey, script_lock_hash,
};
use crate::wallet::crypto;
use crate::wallet::hd_wallet;
use crate::wallet::keystore::{self, Keystore};
use crate::wire::CommandError;

/// Derive the secp256k1 public key from a private key (33 bytes compressed).
fn derive_pubkey(secret_key: &SecretKey) -> [u8; 33] {
  let secp = secp256k1::Secp256k1::new();
  let pubkey = PublicKey::from_secret_key(&secp, secret_key);
  pubkey.serialize()
}

/// Derive the CKB lock hash from a secp256k1 public key (used for imported wallets).
fn derive_lock_hash(pubkey: &[u8; 33]) -> [u8; 32] {
  let lock_arg = blake160(pubkey);
  script_lock_hash(&lock_arg)
}

/// Derive a CKB address from a pubkey (CKB2021 bech32m full address).
fn derive_address(pubkey: &[u8; 33], testnet: bool) -> String {
  let lock_arg = blake160(pubkey);
  if testnet {
    crate::wallet::address::ckb_address_testnet(&lock_arg)
  } else {
    crate::wallet::address::ckb_address_mainnet(&lock_arg)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Import a private key, derive its lock_hash and address, and store it.
///
/// The key is AES-256-GCM encrypted at rest with `encryption_password`.
pub fn import_wallet(
  conn: &mut SqliteConnection,
  testnet: bool,
  label: &str,
  private_key_hex: &str,
  encryption_password: Option<&str>,
) -> Result<WalletRecord, CommandError> {
  let private_key_bytes = hex::decode(private_key_hex)
    .map_err(|e| CommandError::invalid_input(format!("Invalid hex: {e}")))?;

  if private_key_bytes.len() != 32 {
    return Err(CommandError::invalid_input(
      "Private key must be 32 bytes (64 hex chars)",
    ));
  }

  let secret_key = SecretKey::from_slice(&private_key_bytes)
    .map_err(|e| CommandError::invalid_input(format!("Invalid private key: {e}")))?;

  let pubkey = derive_pubkey(&secret_key);
  let lock_hash = derive_lock_hash(&pubkey);
  let address = derive_address(&pubkey, testnet);

  let encrypted_key = match encryption_password {
    Some(pw) => crypto::encrypt(&private_key_bytes, pw)?,
    None => private_key_bytes.to_vec(),
  };

  let id = wallets::insert_wallet(
    conn,
    label,
    &encrypted_key,
    &lock_hash,
    &address,
    None,
    None,
    None,
    "imported",
  )?;

  wallets::get_wallet_by_id(conn, id)
}

/// Get a wallet by its database ID.
pub fn get_wallet(conn: &mut SqliteConnection, id: i64) -> Result<WalletRecord, CommandError> {
  wallets::get_wallet_by_id(conn, id)
}

/// List all managed wallets.
pub fn list_wallets(conn: &mut SqliteConnection) -> Result<Vec<WalletRecord>, CommandError> {
  wallets::list_wallets(conn)
}

/// Delete a wallet by ID.
pub fn delete_wallet(conn: &mut SqliteConnection, id: i64) -> Result<bool, CommandError> {
  wallets::delete_wallet(conn, id)
}

/// Extract a wallet's private key for signing operations.
pub fn decrypt_private_key(
  wallet: &WalletRecord,
  password: Option<&str>,
) -> Result<SecretKey, CommandError> {
  let private_key_bytes = if wallet.encrypted_key.len() > 32 {
    // Likely encrypted (len > 32 due to nonce + auth tag overhead)
    match password {
      Some(pw) => crypto::decrypt(&wallet.encrypted_key, pw)?,
      None => {
        return Err(CommandError::invalid_input(
          "Wallet key is encrypted — password required",
        ))
      }
    }
  } else {
    wallet.encrypted_key.clone()
  };
  SecretKey::from_slice(&private_key_bytes)
    .map_err(|e| CommandError::invalid_input(format!("Failed to parse decrypted key: {e}")))
}

// ---------------------------------------------------------------------------
// HD Wallet API
// ---------------------------------------------------------------------------

/// Derive the proper CKB lock hash for an HD wallet key (Molecule script hash).
fn derive_lock_hash_hd(pubkey: &PublicKey) -> [u8; 32] {
  script_lock_hash(&lock_arg_from_pubkey(pubkey))
}

/// Create a new HD wallet: generate a 12-word mnemonic, write an encrypted
/// keystore file, derive `address_count` children, persist each in the DB.
///
/// Returns the keystore, the mnemonic phrase (SHOW ONCE!), and the records.
pub fn create_hd_wallet(
  conn: &mut SqliteConnection,
  testnet: bool,
  keystore_path: &Path,
  label: &str,
  password: &str,
  address_count: u32,
) -> Result<(Keystore, String, Vec<WalletRecord>), CommandError> {
  let count = if address_count == 0 { 5 } else { address_count };

  let mnemonic = hd_wallet::generate_mnemonic()?;
  let phrase = mnemonic.to_string();

  let mut keystore = keystore::create_keystore(&mnemonic, password, label, "m/44'/309'/0'/0")?;
  let seed = hd_wallet::mnemonic_to_seed(&mnemonic, "");
  let mut children = Vec::new();

  for i in 0..count {
    let path = format!("m/44'/309'/0'/0/{i}");
    let (child_key, _chain_code) = hd_wallet::derive_path(&seed, &path)
      .map_err(|e| CommandError::internal(format!("Derive path {path}: {e}")))?;

    let secp = secp256k1::Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &child_key);
    let lock_hash = derive_lock_hash_hd(&pk);
    let address = ckb_address_from_pubkey(&pk, testnet);

    let encrypted_key = crypto::encrypt(&child_key.secret_bytes(), password)?;

    let wallet_id = wallets::insert_wallet(
      conn,
      &format!("{label} #{i}"),
      &encrypted_key,
      &lock_hash,
      &address,
      None,
      Some(&path),
      Some(i as i32),
      "hd_child",
    )?;

    let record = wallets::get_wallet_by_id(conn, wallet_id)?;
    children.push(record);
  }

  keystore.address_count = count;
  keystore::save_keystore(&keystore, keystore_path)?;

  Ok((keystore, phrase, children))
}

/// Unlock an existing keystore: decrypt the mnemonic, ensure all previously
/// derived children are in the DB, and return them.
pub fn unlock_keystore(
  conn: &mut SqliteConnection,
  testnet: bool,
  keystore_path: &Path,
  password: &str,
) -> Result<(Keystore, Vec<WalletRecord>), CommandError> {
  let keystore = keystore::load_keystore(keystore_path)?;
  let mnemonic = keystore::decrypt_mnemonic(&keystore, password)?;
  let seed = hd_wallet::mnemonic_to_seed(&mnemonic, "");
  let mut children = Vec::new();

  for i in 0..keystore.address_count {
    let path = format!("m/44'/309'/0'/0/{i}");
    let (child_key, _) = hd_wallet::derive_path(&seed, &path)
      .map_err(|e| CommandError::internal(format!("Derive path {path}: {e}")))?;

    let secp = secp256k1::Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &child_key);
    let lock_hash = derive_lock_hash_hd(&pk);
    let address = ckb_address_from_pubkey(&pk, testnet);

    let existing = wallets::get_wallet_by_derivation_path(conn, &path)?;

    match existing {
      Some(record) => {
        if record.lock_hash != lock_hash || record.ckb_address != address {
          wallets::update_wallet_derived_info(conn, record.id, &lock_hash, &address)?;
          let updated = wallets::get_wallet_by_id(conn, record.id)?;
          children.push(updated);
        } else {
          children.push(record);
        }
      }
      None => {
        let encrypted_key = crypto::encrypt(&child_key.secret_bytes(), password)?;
        wallets::insert_wallet(
          conn,
          &format!("{} #{i}", keystore.label),
          &encrypted_key,
          &lock_hash,
          &address,
          None,
          Some(&path),
          Some(i as i32),
          "hd_child",
        )?;
        let record = wallets::get_wallet_by_lock_hash(conn, &lock_hash)?;
        children.push(record);
      }
    }
  }

  Ok((keystore, children))
}

/// Derive additional child addresses for an HD wallet.
pub fn derive_more_addresses(
  conn: &mut SqliteConnection,
  testnet: bool,
  keystore_path: &Path,
  password: &str,
  additional_count: u32,
) -> Result<Vec<WalletRecord>, CommandError> {
  let keystore = keystore::load_keystore(keystore_path)?;
  let mnemonic = keystore::decrypt_mnemonic(&keystore, password)?;
  let seed = hd_wallet::mnemonic_to_seed(&mnemonic, "");
  let mut new_children = Vec::new();
  let start_index = keystore.address_count;

  for i in start_index..start_index + additional_count {
    let path = format!("m/44'/309'/0'/0/{i}");
    let (child_key, _) = hd_wallet::derive_path(&seed, &path)
      .map_err(|e| CommandError::internal(format!("Derive path {path}: {e}")))?;

    let secp = secp256k1::Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &child_key);
    let lock_hash = derive_lock_hash_hd(&pk);
    let address = ckb_address_from_pubkey(&pk, testnet);
    let encrypted_key = crypto::encrypt(&child_key.secret_bytes(), password)?;

    wallets::insert_wallet(
      conn,
      &format!("{} #{i}", keystore.label),
      &encrypted_key,
      &lock_hash,
      &address,
      None,
      Some(&path),
      Some(i as i32),
      "hd_child",
    )?;

    let record = wallets::get_wallet_by_lock_hash(conn, &lock_hash)?;
    new_children.push(record);
  }

  keystore::update_address_count(keystore_path, start_index + additional_count)?;

  Ok(new_children)
}

/// Get total CKB balance for all HD child wallets (shannons).
pub async fn get_hd_wallet_balance(
  conn: &mut SqliteConnection,
  provider: &dyn ChainProvider,
) -> Result<u64, CommandError> {
  let children = wallets::list_wallets_by_type(conn, "hd_child")?;
  let mut total = 0u64;
  for child in &children {
    total += provider
      .get_balance_by_address(&child.ckb_address)
      .await
      .unwrap_or(0);
  }
  Ok(total)
}

/// Get per-address balances for all HD child wallets.
pub async fn get_hd_wallet_address_balances(
  conn: &mut SqliteConnection,
  provider: &dyn ChainProvider,
) -> Result<Vec<(WalletRecord, u64)>, CommandError> {
  let children = wallets::list_wallets_by_type(conn, "hd_child")?;
  let mut results = Vec::new();
  for child in children {
    let balance = provider
      .get_balance_by_address(&child.ckb_address)
      .await
      .unwrap_or(0);
    results.push((child, balance));
  }
  Ok(results)
}

/// Check if a keystore file exists at the configured path.
pub fn hd_wallet_exists(keystore_path: &Path) -> bool {
  keystore::keystore_exists(keystore_path)
}

/// Import/recover an HD wallet from a mnemonic phrase.
pub fn import_hd_from_mnemonic(
  conn: &mut SqliteConnection,
  testnet: bool,
  keystore_path: &Path,
  mnemonic_phrase: &str,
  label: &str,
  password: &str,
  address_count: u32,
) -> Result<(Keystore, Vec<WalletRecord>), CommandError> {
  let mnemonic = Mnemonic::parse(mnemonic_phrase)
    .map_err(|e| CommandError::invalid_input(format!("Invalid mnemonic: {e}")))?;
  let count = if address_count == 0 { 5 } else { address_count };
  let seed = hd_wallet::mnemonic_to_seed(&mnemonic, "");

  let mut keystore = keystore::create_keystore(&mnemonic, password, label, "m/44'/309'/0'/0")?;
  let mut children = Vec::new();

  for i in 0..count {
    let path = format!("m/44'/309'/0'/0/{i}");
    let (child_key, _) = hd_wallet::derive_path(&seed, &path)
      .map_err(|e| CommandError::internal(format!("Derive path {path}: {e}")))?;
    let secp = secp256k1::Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &child_key);
    let lock_hash = derive_lock_hash_hd(&pk);
    let address = ckb_address_from_pubkey(&pk, testnet);
    let encrypted_key = crypto::encrypt(&child_key.secret_bytes(), password)?;

    wallets::insert_wallet(
      conn,
      &format!("{label} #{i}"),
      &encrypted_key,
      &lock_hash,
      &address,
      None,
      Some(&path),
      Some(i as i32),
      "hd_child",
    )?;

    let record = wallets::get_wallet_by_lock_hash(conn, &lock_hash)?;
    children.push(record);
  }

  keystore.address_count = count;
  keystore::save_keystore(&keystore, keystore_path)?;

  Ok((keystore, children))
}

/// Delete the HD wallet: remove keystore file + all hd_child wallets from DB.
pub fn delete_hd_wallet(
  conn: &mut SqliteConnection,
  keystore_path: &Path,
) -> Result<(), CommandError> {
  if keystore_path.exists() {
    std::fs::remove_file(keystore_path)
      .map_err(|e| CommandError::internal(format!("Failed to delete keystore: {e}")))?;
  }

  let children = wallets::list_wallets_by_type(conn, "hd_child")?;
  for child in children {
    wallets::delete_wallet(conn, child.id)?;
  }

  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn test_private_key_bytes() -> [u8; 32] {
    [
      0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd,
      0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab,
      0xcd, 0xef,
    ]
  }

  #[test]
  fn derive_pubkey_from_test_key() {
    let secret_key = SecretKey::from_slice(&test_private_key_bytes()).expect("valid test key");
    let pubkey = derive_pubkey(&secret_key);
    assert_eq!(pubkey.len(), 33);
    // Compressed pubkey starts with 0x02 or 0x03
    assert!(pubkey[0] == 0x02 || pubkey[0] == 0x03);
  }

  #[test]
  fn derive_lock_hash_is_deterministic() {
    let secret_key = SecretKey::from_slice(&test_private_key_bytes()).unwrap();
    let pubkey = derive_pubkey(&secret_key);
    let hash1 = derive_lock_hash(&pubkey);
    let hash2 = derive_lock_hash(&pubkey);
    assert_eq!(hash1, hash2);
    assert_eq!(hash1.len(), 32);
  }

  #[test]
  fn different_keys_produce_different_hashes() {
    let sk1 = SecretKey::from_slice(&test_private_key_bytes()).unwrap();
    let mut bytes2 = test_private_key_bytes();
    bytes2[0] = bytes2[0].wrapping_add(1);
    let sk2 = SecretKey::from_slice(&bytes2).unwrap();

    let hash1 = derive_lock_hash(&derive_pubkey(&sk1));
    let hash2 = derive_lock_hash(&derive_pubkey(&sk2));
    assert_ne!(hash1, hash2);
  }
}
