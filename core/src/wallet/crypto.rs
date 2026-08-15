//! Cryptographic utilities — AES-256-GCM encryption for private key storage.
//!
//! Private keys are encrypted at rest using AES-256-GCM. The encryption key
//! is derived from the server's encryption password via SHA-256.

use aes_gcm::{
  aead::{Aead, KeyInit, OsRng},
  Aes256Gcm, Nonce,
};
use rand::RngCore;
use secp256k1::SecretKey;
use sha2::{Digest, Sha256};

use crate::wire::CommandError;

/// Derive a 32-byte AES key from a password string using SHA-256.
///
/// The desktop keeps this derived key (not the raw password) in RAM while the
/// wallet is unlocked, so newly derived addresses can be re-encrypted without
/// re-entering the password.
pub fn derive_key(password: &str) -> [u8; 32] {
  let mut hasher = Sha256::new();
  hasher.update(password.as_bytes());
  let result = hasher.finalize();
  let mut key = [0u8; 32];
  key.copy_from_slice(&result);
  key
}

/// Encrypt plaintext bytes with AES-256-GCM using the given password.
///
/// Returns the ciphertext with a 12-byte nonce prepended: `nonce[12] || ciphertext`.
pub fn encrypt(plaintext: &[u8], password: &str) -> Result<Vec<u8>, CommandError> {
  encrypt_with_key(plaintext, &derive_key(password))
}

/// Encrypt plaintext bytes with a pre-derived 32-byte AES key.
pub fn encrypt_with_key(plaintext: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, CommandError> {
  let cipher =
    Aes256Gcm::new_from_slice(key).map_err(|e| CommandError::internal(format!("AES init: {e}")))?;

  let mut nonce_bytes = [0u8; 12];
  OsRng.fill_bytes(&mut nonce_bytes);
  let nonce = Nonce::from_slice(&nonce_bytes);

  let ciphertext = cipher
    .encrypt(nonce, plaintext)
    .map_err(|e| CommandError::internal(format!("Encryption failed: {e}")))?;

  // Prepend nonce to ciphertext
  let mut result = nonce_bytes.to_vec();
  result.extend_from_slice(&ciphertext);
  Ok(result)
}

/// Decrypt ciphertext (format: `nonce[12] || ciphertext`) with the given password.
pub fn decrypt(ciphertext_with_nonce: &[u8], password: &str) -> Result<Vec<u8>, CommandError> {
  decrypt_with_key(ciphertext_with_nonce, &derive_key(password))
}

/// Decrypt ciphertext with a pre-derived 32-byte AES key.
pub fn decrypt_with_key(
  ciphertext_with_nonce: &[u8],
  key: &[u8; 32],
) -> Result<Vec<u8>, CommandError> {
  if ciphertext_with_nonce.len() < 12 {
    return Err(CommandError::invalid_input(
      "Ciphertext too short".to_string(),
    ));
  }

  let (nonce_bytes, ciphertext) = ciphertext_with_nonce.split_at(12);
  let nonce = Nonce::from_slice(nonce_bytes);

  let cipher =
    Aes256Gcm::new_from_slice(key).map_err(|e| CommandError::internal(format!("AES init: {e}")))?;

  cipher
    .decrypt(nonce, ciphertext)
    .map_err(|_| CommandError::invalid_input("Decryption failed — wrong password?".to_string()))
}

/// Decrypt a stored private key blob and parse it as a secp256k1 SecretKey.
///
/// Convenience wrapper around `decrypt()` for wallet key material.
pub fn decrypt_secret_key(encrypted_key: &[u8], password: &str) -> Result<SecretKey, CommandError> {
  let key_bytes = decrypt(encrypted_key, password)?;
  SecretKey::from_slice(&key_bytes)
    .map_err(|e| CommandError::invalid_input(format!("Invalid private key: {e}")))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn encrypt_decrypt_roundtrip() {
    let plaintext = b"this is a private key secret";
    let password = "test-password";

    let encrypted = encrypt(plaintext, password).expect("encrypt should succeed");
    assert!(encrypted.len() > 12, "ciphertext includes nonce");

    let decrypted = decrypt(&encrypted, password).expect("decrypt should succeed");
    assert_eq!(decrypted, plaintext);
  }

  #[test]
  fn decrypt_wrong_password_fails() {
    let plaintext = b"secret data";
    let encrypted = encrypt(plaintext, "correct-password").unwrap();
    let result = decrypt(&encrypted, "wrong-password");
    assert!(result.is_err(), "decrypt with wrong password should fail");
  }

  #[test]
  fn ciphertext_too_short() {
    let result = decrypt(b"short", "password");
    assert!(result.is_err(), "too-short ciphertext should fail");
  }

  #[test]
  fn different_nonces_produce_different_ciphertexts() {
    let plaintext = b"same data";
    let password = "pw";
    let enc1 = encrypt(plaintext, password).unwrap();
    let enc2 = encrypt(plaintext, password).unwrap();
    // Nonces differ, so ciphertexts differ
    assert_ne!(enc1, enc2);
  }
}
