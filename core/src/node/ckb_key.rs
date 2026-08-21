//! Node CKB key — provisioned from the wallet's first HD child key.
//!
//! The embedded fiber node requires an encrypted CKB key at `$CKB_BASE_DIR/key`
//! (decrypted with `FIBER_SECRET_KEY_PASSWORD`). We derive it from the wallet's
//! first HD child (`m/44'/309'/0'/0/0`) so channel funds share the user's
//! on-chain identity. The password is a random per-install value persisted at
//! `$CKB_BASE_DIR/key.password` (mode 0600).

use std::path::Path;

use rand::RngCore;

use crate::backend::SigningWallet;
use crate::wire::CommandError;

/// Ensure an encrypted CKB key file exists for the node, derived from the
/// wallet's first HD child key. Idempotent: does nothing if the key exists.
pub fn ensure_ckb_key(ckb_base_dir: &Path, wallet: &dyn SigningWallet) -> Result<(), CommandError> {
  if !wallet.is_unlocked() {
    return Err(CommandError::wallet_locked(
      "wallet must be unlocked to start the node",
    ));
  }
  std::fs::create_dir_all(ckb_base_dir).map_err(|e| CommandError::io(e.to_string()))?;
  let key_path = ckb_base_dir.join("key");
  if key_path.exists() {
    return Ok(());
  }

  let (_, sk) = wallet
    .signing_identity()
    .ok_or_else(|| CommandError::wallet_locked("wallet must be unlocked"))?;

  // Random per-install password, persisted beside the key.
  let mut password = [0u8; 32];
  rand::thread_rng().fill_bytes(&mut password);
  let password_hex = hex::encode(password);

  fnn::utils::encrypt_decrypt_file::encrypt_to_file(
    &key_path,
    &sk.secret_bytes(),
    password_hex.as_bytes(),
  )
  .map_err(|e| CommandError::internal(format!("encrypt node key: {e}")))?;
  let pw_path = ckb_base_dir.join("key.password");
  std::fs::write(&pw_path, password_hex.as_bytes()).map_err(|e| CommandError::io(e.to_string()))?;
  // Restrict the password file to the current user.
  let _ = std::fs::set_permissions(
    &pw_path,
    std::os::unix::fs::PermissionsExt::from_mode(0o600),
  );
  Ok(())
}

/// Set `FIBER_SECRET_KEY_PASSWORD` from the persisted password file.
pub fn set_secret_key_password(ckb_base_dir: &Path) -> Result<(), CommandError> {
  let pw = std::fs::read_to_string(ckb_base_dir.join("key.password"))
    .map_err(|e| CommandError::io(format!("missing node key password: {e}")))?;
  // edition 2021: env mutation is unsafe; the wallet process is the sole consumer.
  unsafe { std::env::set_var("FIBER_SECRET_KEY_PASSWORD", pw.trim()) };
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::backend::SigningWallet;
  use ckb_cinnabar_calculator::re_exports::secp256k1::{PublicKey, Secp256k1, SecretKey};

  struct TestWallet(SecretKey);
  impl SigningWallet for TestWallet {
    fn is_unlocked(&self) -> bool {
      true
    }
    fn signing_identity(&self) -> Option<(String, SecretKey)> {
      let secp = Secp256k1::new();
      let pk = PublicKey::from_secret_key(&secp, &self.0);
      Some((
        crate::wallet::address::ckb_address_from_pubkey(&pk, true),
        self.0,
      ))
    }
  }

  fn test_key() -> SecretKey {
    SecretKey::from_slice(&[7u8; 32]).unwrap()
  }

  #[test]
  fn ensure_ckb_key_writes_encrypted_key_idempotently() {
    let dir = tempfile::tempdir().unwrap();
    let wallet = TestWallet(test_key());

    ensure_ckb_key(dir.path(), &wallet).unwrap();
    assert!(dir.path().join("key").exists());
    assert!(dir.path().join("key.password").exists());

    // The file decrypts back to the wallet child's 32-byte key.
    let pw = std::fs::read_to_string(dir.path().join("key.password")).unwrap();
    let decrypted = fnn::utils::encrypt_decrypt_file::decrypt_from_file(
      dir.path().join("key"),
      pw.trim().as_bytes(),
    )
    .unwrap();
    assert_eq!(decrypted, test_key().secret_bytes());

    // Idempotent — a second call leaves the key untouched.
    ensure_ckb_key(dir.path(), &wallet).unwrap();
    assert!(dir.path().join("key").exists());
  }

  #[test]
  fn ensure_ckb_key_requires_unlocked() {
    struct LockedWallet;
    impl SigningWallet for LockedWallet {
      fn is_unlocked(&self) -> bool {
        false
      }
      fn signing_identity(&self) -> Option<(String, SecretKey)> {
        None
      }
    }
    let dir = tempfile::tempdir().unwrap();
    let err = ensure_ckb_key(dir.path(), &LockedWallet).unwrap_err();
    assert!(matches!(err, CommandError::WalletLocked(_)));
  }
}
