//! Real CKB transaction assembly and secp256k1_blake160_sighash_all signing.
//!
//! The SDK/calculator build *unsigned* skeletons; this module signs a plain
//! CKB transfer (no Opticrum operation) and returns a ready-to-broadcast
//! JSON-RPC transaction.
//!
//! Assembly deliberately avoids cinnabar's `Instruction`/`Operation` trait:
//! those box their futures as non-`Send` (`#[async_trait(?Send)]`), which
//! breaks the `Send` bound the async `WalletBackend` requires. Instead each
//! step uses the skeleton's own async methods (concrete `Send` futures) plus a
//! synchronous ckb-sdk signing pass.

use ckb_cinnabar_calculator::{
  re_exports::{
    ckb_jsonrpc_types,
    ckb_sdk::{
      transaction::signer::{SignContexts, TransactionSigner},
      types::transaction_with_groups::TransactionWithScriptGroupsBuilder,
      NetworkInfo,
    },
    ckb_types::{
      core::{Capacity, DepType, ScriptHashType},
      packed::{CellDep, CellOutput, OutPoint},
      prelude::*,
      H256,
    },
    secp256k1::SecretKey,
  },
  rpc::{Network, RPC},
  skeleton::{CellDepEx, CellOutputEx, ChangeReceiver, ScriptEx, TransactionSkeleton},
};

use crate::wallet::address::SIGHASH_TYPE_HASH;
use crate::wire::CommandError;

/// A secp256k1_blake160_sighash_all lock script as a cinnabar `ScriptEx`.
///
/// Built directly from the lock arg so we never route user addresses through
/// cinnabar's `Address::from_str` (which rejects short blake160 addresses).
pub fn secp256k1_lock_ex(lock_arg: &[u8; 20]) -> ScriptEx {
  ScriptEx::Script(
    SIGHASH_TYPE_HASH.into(),
    ScriptHashType::Type,
    lock_arg.to_vec(),
  )
}

/// Genesis outpoints of the secp256k1_blake160_sighash_all cell dep.
const SIGHASH_DEP_TESTNET_TX: &str =
  "0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37";
const SIGHASH_DEP_MAINNET_TX: &str =
  "0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c";

/// Add the secp256k1 sighash-all cell dep (dep group) to the skeleton.
///
/// The outpoint is a known genesis cell; skipped on `Fake`/`Custom` networks
/// (offline tests don't need it).
fn add_sighash_celldep<T: RPC>(
  skeleton: &mut TransactionSkeleton,
  rpc: &T,
) -> Result<(), CommandError> {
  let tx_hex = match rpc.network() {
    Network::Testnet => SIGHASH_DEP_TESTNET_TX,
    Network::Mainnet => SIGHASH_DEP_MAINNET_TX,
    _ => return Ok(()),
  };
  let mut bytes = [0u8; 32];
  hex::decode_to_slice(&tx_hex[2..], &mut bytes)
    .map_err(|e| CommandError::build(format!("transfer: celldep hash: {e}")))?;

  let out_point = OutPoint::new_builder()
    .tx_hash(H256(bytes).pack())
    .index(0u32)
    .build();
  let celldep = CellDep::new_builder()
    .out_point(out_point)
    .dep_type(DepType::DepGroup)
    .build();
  skeleton.celldep(CellDepEx {
    name: "secp256k1_sighash_all".to_string(),
    celldep,
    output: CellOutputEx::new(CellOutput::default(), vec![]),
    with_data: false,
  });
  Ok(())
}

/// Synchronously sign every input grouped under `sender_lock` with `sender_sk`,
/// writing the signed witnesses back into the skeleton.
pub(crate) fn sign_skeleton(
  skeleton: &mut TransactionSkeleton,
  sender_lock: &ScriptEx,
  sender_sk: &SecretKey,
) -> Result<(), CommandError> {
  let tx_view = skeleton.clone().into_transaction_view();
  let mut builder = TransactionWithScriptGroupsBuilder::default().set_tx_view(tx_view);
  let (input_indices, _) = skeleton.lock_script_groups(sender_lock);
  builder =
    builder.add_lock_script_group(&sender_lock.clone().to_script_unchecked(), &input_indices);
  let mut tx_groups = builder.build();

  let signer = TransactionSigner::new(&NetworkInfo::mainnet()); // network info unused here
  signer
    .sign_transaction(&mut tx_groups, &SignContexts::new_sighash(vec![*sender_sk]))
    .map_err(|e| CommandError::build(format!("transfer: sign: {e}")))?;

  let tx = tx_groups.get_tx_view();
  skeleton
    .update_witnesses_from_transaction_view(tx)
    .map_err(|e| CommandError::build(format!("transfer: write witnesses: {e}")))?;
  Ok(())
}

/// Stateless real transaction builder + signer.
pub struct RealSigner;

impl RealSigner {
  /// Build, balance, and sign a plain CKB transfer from the sender to the
  /// recipient. Returns the fully signed JSON-RPC transaction, ready to
  /// broadcast via `ChainProvider::send_transaction`.
  #[allow(clippy::too_many_arguments)]
  pub async fn build_ckb_transfer<T: RPC>(
    rpc: &T,
    sender_lock: ScriptEx,
    sender_sk: &SecretKey,
    recipient_lock: ScriptEx,
    amount_shannons: u64,
    additional_fee_rate: u64,
  ) -> Result<ckb_jsonrpc_types::Transaction, CommandError> {
    let mut skeleton = TransactionSkeleton::default();

    // 1. secp256k1 sighash cell dep (no-op on Fake — test-safe).
    add_sighash_celldep(&mut skeleton, rpc)?;

    // 2. Pick the sender's first pure-CKB cell via the indexer.
    skeleton
      .input_from_script(rpc, sender_lock.clone())
      .await
      .map_err(|e| CommandError::build(format!("transfer: pick input: {e:#}")))?;

    // 3. Add the recipient output; reject amounts below the minimal cell capacity.
    let recipient_script = recipient_lock
      .clone()
      .to_script(&skeleton)
      .map_err(|e| CommandError::build(format!("transfer: recipient script: {e}")))?;
    let minimal = CellOutputEx::new_from_scripts(recipient_script.clone(), None, vec![], None)
      .map_err(|e| CommandError::build(format!("transfer: recipient cell: {e}")))?;
    if amount_shannons < minimal.capacity().as_u64() {
      return Err(CommandError::build(
        "transfer: amount below minimal cell capacity",
      ));
    }
    skeleton.output(
      CellOutputEx::new_from_scripts(
        recipient_script,
        None,
        vec![],
        Some(Capacity::shannons(amount_shannons)),
      )
      .map_err(|e| CommandError::build(format!("transfer: recipient output: {e}")))?,
    );

    // 4. Balance: pull more inputs if needed, size the change output, pad witnesses.
    let fee = skeleton
      .fee(rpc, additional_fee_rate)
      .await
      .map_err(|e| CommandError::build(format!("transfer: fee: {e:#}")))?;
    skeleton
      .balance(
        rpc,
        fee,
        sender_lock.clone(),
        ChangeReceiver::Script(sender_lock.clone()),
      )
      .await
      .map_err(|e| CommandError::build(format!("transfer: balance: {e:#}")))?;
    (skeleton.witnesses.len()..skeleton.inputs.len()).for_each(|_| {
      skeleton.witness(Default::default());
    });

    // 5. Sign every input grouped under the sender lock with the sender key.
    sign_skeleton(&mut skeleton, &sender_lock, sender_sk)?;

    Ok(skeleton.into())
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use ckb_cinnabar_calculator::{
    re_exports::ckb_types::core::Capacity,
    simulation::{fake_header_view, fake_outpoint, FakeRpcClient},
    skeleton::CellOutputEx,
  };
  use secp256k1::PublicKey;

  use crate::wallet::address::{ckb_address_from_pubkey, lock_arg_from_pubkey};
  use crate::wallet::hd_wallet;

  fn test_mnemonic() -> &'static str {
    // canonical valid BIP39 test mnemonic (entropy 0x00…00)
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
  }

  /// Derive child `index` under the test mnemonic; return (secret key, lock_ex).
  fn derive_child(index: u32) -> (SecretKey, ScriptEx) {
    let mnemonic = bip39::Mnemonic::parse(test_mnemonic()).unwrap();
    let seed = hd_wallet::mnemonic_to_seed(&mnemonic, "");
    let path = format!("m/44'/309'/0'/0/{index}");
    let (sk, _chain_code) = hd_wallet::derive_path(&seed, &path).unwrap();
    let secp = secp256k1::Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &sk);
    let lock_arg = lock_arg_from_pubkey(&pk);
    (sk, secp256k1_lock_ex(&lock_arg))
  }

  fn seed_sender_cell(fake: &mut FakeRpcClient, lock_ex: &ScriptEx) {
    let lock = lock_ex.clone().to_script_unchecked();
    let cell = CellOutputEx::new_from_scripts(
      lock,
      None,
      vec![],
      Some(Capacity::shannons(100_000_000_000_000)),
    )
    .expect("build sender cell");
    let header = fake_header_view(1, 1, 1);
    fake.insert_fake_cell(fake_outpoint(), cell, Some(header));
  }

  #[tokio::test]
  async fn sign_ckb_transfer_writes_witness_and_output() {
    let (sender_sk, sender_lock) = derive_child(0);
    let (_recipient_sk, recipient_lock) = derive_child(1);

    let mut fake = FakeRpcClient::default();
    seed_sender_cell(&mut fake, &sender_lock);

    let amount = 61_0000_0000; // 61 CKB (minimal secp256k1 cell)
    let tx = RealSigner::build_ckb_transfer(
      &fake,
      sender_lock,
      &sender_sk,
      recipient_lock.clone(),
      amount,
      0,
    )
    .await
    .expect("build+sign transfer");

    // Every input has a non-empty witness (signed).
    assert!(!tx.witnesses.is_empty());
    assert!(
      tx.witnesses.iter().all(|w| !w.as_bytes().is_empty()),
      "all witnesses must be signed"
    );

    // The recipient output exists with the requested capacity and lock.
    let recipient_script: ckb_jsonrpc_types::Script = recipient_lock.to_script_unchecked().into();
    let found = tx
      .outputs
      .iter()
      .any(|o| o.lock == recipient_script && u64::from(o.capacity) == amount);
    assert!(found, "recipient output missing or wrong capacity");
  }

  #[tokio::test]
  async fn transfer_below_minimal_capacity_fails() {
    let (sender_sk, sender_lock) = derive_child(0);
    let (_r_sk, recipient_lock) = derive_child(1);

    let mut fake = FakeRpcClient::default();
    seed_sender_cell(&mut fake, &sender_lock);

    // 10 shannons << 61 CKB minimal — the builder rejects it.
    let err = RealSigner::build_ckb_transfer(&fake, sender_lock, &sender_sk, recipient_lock, 10, 0)
      .await
      .unwrap_err();
    assert!(matches!(err, CommandError::Build(_)));
  }

  #[test]
  fn sender_address_roundtrips_to_lock() {
    let (sk, _sender_lock) = derive_child(0);
    let secp = secp256k1::Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &sk);
    let addr = ckb_address_from_pubkey(&pk, true);
    let lock_arg = crate::wallet::address::lock_arg_from_address(&addr).unwrap();
    assert_eq!(lock_arg, lock_arg_from_pubkey(&pk));
  }
}
