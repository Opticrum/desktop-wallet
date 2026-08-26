//! Real-backend acceptance — exercises the key flows against the real CKB
//! testnet (and the configured fiber node, which is absent here → honest
//! not-running/offline states).
//!
//! Run manually: `cargo test -p opticrum-wallet-core --test acceptance -- --ignored --nocapture`

use opticrum_wallet_core::backend::{BackendBundle, BackendConfig};
use opticrum_wallet_core::wire::Chain;

fn testnet_config(dir: &std::path::Path) -> BackendConfig {
  BackendConfig {
    data_dir: dir.display().to_string(),
    database_url: dir.join("opticrum.db").display().to_string(),
    keystore_path: dir.join("keystore.json").display().to_string(),
    node_config_path: dir.join("node-config.json").display().to_string(),
    testnet_rpc_url: "https://testnet.ckbapp.dev".to_string(),
    testnet_indexer_url: "https://testnet.ckb.dev/indexer".to_string(),
    mainnet_rpc_url: "https://mainnet.ckbapp.dev".to_string(),
    mainnet_indexer_url: "https://mainnet.ckb.dev/indexer".to_string(),
    fee_rate: 1000,
    network: Chain::Testnet,
  }
}

#[tokio::test]
#[ignore = "real testnet acceptance — run manually"]
async fn real_backend_acceptance() {
  let dir = tempfile::tempdir().expect("temp dir");
  let bundle = BackendBundle::real(testnet_config(dir.path()))
    .await
    .expect("backend init");

  // ── wallet: initial state (no wallet) ────────────────────────────────
  println!("== wallet: initial (no wallet) ==");
  let s = bundle.wallet.get_summary().await.unwrap();
  println!("  has_wallet={} unlocked={}", s.has_wallet, s.unlocked);
  assert!(!s.has_wallet, "fresh data dir must have no wallet");

  // ── wallet: create HD wallet ─────────────────────────────────────────
  println!("== wallet: create HD (3 addresses) ==");
  let created = bundle
    .wallet
    .create_hd_wallet("acceptance".into(), "pw".into(), 3)
    .await
    .expect("create hd wallet");
  println!("  mnemonic: {}…", &created.mnemonic[..24]);
  println!("  addresses: {}", created.addresses.join(", "));
  assert_eq!(created.addresses.len(), 3);

  let s = bundle.wallet.get_summary().await.unwrap();
  println!(
    "  after create: has_wallet={} unlocked={} address={} available_ckb={}",
    s.has_wallet, s.unlocked, s.address, s.available_ckb
  );
  assert!(s.has_wallet && s.unlocked);
  assert_eq!(s.chain, Chain::Testnet);

  // ── wallet: fresh wallet must have no on-chain history ────────────────
  println!("== wallet: get_transactions (fresh) ==");
  let txs = bundle
    .wallet
    .get_transactions(None, None)
    .await
    .expect("transactions");
  println!("  fresh wallet txs={}", txs.len());
  assert!(txs.is_empty(), "a just-created wallet has no transactions");

  // ── wallet: lock → unlock roundtrip ──────────────────────────────────
  println!("== wallet: lock → unlock ==");
  bundle.wallet.lock().unwrap();
  assert!(
    !bundle.wallet.get_summary().await.unwrap().unlocked,
    "locked"
  );
  let s = bundle
    .wallet
    .unlock("pw".into(), None)
    .await
    .expect("unlock");
  assert!(s.unlocked, "unlocked");
  println!("  unlocked={}", s.unlocked);

  // ── wallet: derive more addresses (needs the RAM seed) ───────────────
  println!("== wallet: derive 2 more ==");
  let addrs = bundle.wallet.derive_addresses(2).await.expect("derive");
  println!("  derived: {}", addrs.join(", "));
  assert_eq!(addrs.len(), 2);

  // ── liquidity: real on-chain scan ────────────────────────────────────
  println!("== liquidity: dashboard (real testnet scan) ==");
  let d = bundle.liquidity.get_dashboard().await.expect("dashboard");
  println!(
    "  tip={} total_orders={} total_matches={} active={} exhausted={}",
    d.tip_block, d.total_orders, d.total_matches, d.active_matches, d.exhausted_matches
  );
  assert!(d.tip_block > 12_000_000, "testnet tip is far ahead");

  let orders = bundle.liquidity.get_orders(None).await.expect("orders");
  let matches = bundle.liquidity.get_matches(None).await.expect("matches");
  println!(
    "  on-chain orders={} matches={}",
    orders.len(),
    matches.len()
  );

  let deadlines = bundle
    .liquidity
    .get_matches_near_exhaustion(50400)
    .await
    .expect("deadlines");
  println!("  near-exhaustion (≤7d): {}", deadlines.len());

  // ── node: attached mode, no fiber node → honest not-running ──────────
  println!("== node: runtime (no fiber node attached) ==");
  let r = bundle.node.get_runtime().await.expect("node runtime");
  println!("  running={}", r.running);
  assert!(!r.running, "no fiber node → not running (state-as-data)");

  // ── channels: no fiber node → error/empty ────────────────────────────
  println!("== channels: list (no fiber node) ==");
  match bundle.channels.list().await {
    Ok(c) => println!("  nodes={}", c.nodes.len()),
    Err(e) => println!("  expected error (no fiber node): {e}"),
  }

  println!("\n✅ ACCEPTANCE PASSED — all key flows exercised without panic");
}
