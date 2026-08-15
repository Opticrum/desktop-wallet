//! Seeded mock datasets (wire shape) — ported from `app/src/mock/*`.
//!
//! The desktop shell serves these over IPC until the `opticrum-wallet-core`
//! crate lands with real chain/key access. Pure display formulas (APY
//! conversion, matchLife, dwell, inbound summaries) stay in the frontend
//! (`app/src/lib/`) per `docs/ipc/ipc-api.md` design decision #2.

use crate::wire::*;

/// ~12s block interval, 2,629,800 blocks per year (calculator config).
pub const BLOCKS_PER_YEAR: f64 = 2_629_800.0;

/// Annual yield in basis points for a per-block rent on a capacity.
/// Mirrors the frontend `shannonsPerBlockToApyBps` — kept in sync.
pub fn apy_bps(shannons_per_block: u64, capacity_ckb: f64) -> f64 {
  if capacity_ckb <= 0.0 {
    return 0.0;
  }
  let annual = (shannons_per_block as f64 * BLOCKS_PER_YEAR) / (capacity_ckb * 1e8);
  (annual * 10_000.0).round()
}

fn ms(s: i64) -> u64 {
  (s * 1000) as u64
}

// ── wallet ───────────────────────────────────────────────────────────────────

/// Mirror of the wallet data the Store needs (not a wire type by itself).
pub struct WalletSnapshotData {
  pub has_wallet: bool,
  pub unlocked: bool,
  pub address: String,
  pub addresses: Vec<WalletAddress>,
  pub available_ckb: f64,
  pub total_ckb: f64,
  pub locked_ckb: f64,
  pub fiat_usd: Option<f64>,
}

fn tx(id: &str, kind: WalletTxKind, amount_ckb: f64, epoch_s: i64, hash: &str) -> WalletTx {
  WalletTx {
    id: id.to_string(),
    kind,
    amount_ckb,
    timestamp_ms: ms(epoch_s),
    tx_hash: hash.to_string(),
  }
}

pub fn mock_wallet() -> (WalletSnapshotData, Vec<WalletTx>) {
  let address =
    "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s2p"
      .to_string();
  let lock_hash = "0x8e55773c1c3f5b2f1f2f6e9a8d0c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c".to_string();

  let txs = vec![
    tx(
      "tx1",
      WalletTxKind::Receive,
      500.0,
      1_785_201_240,
      "0x7a1c9e2b4d8f01a3c5e7b9d0f2a4c6e8b1d3f5a7c9e0b2d4f6a8c0e2b4d6f8a0",
    ),
    tx(
      "tx2",
      WalletTxKind::ChannelOpen,
      -1200.0,
      1_785_139_320,
      "0x91b044aa12cd34ef56ab78cd90ef12ab34cd56ef78ab90cd12ef34ab56cd78ef",
    ),
    tx(
      "tx3",
      WalletTxKind::Send,
      -42.5,
      1_785_037_200,
      "0x33de0c18a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef012345678",
    ),
    tx(
      "tx4",
      WalletTxKind::Receive,
      88.25,
      1_784_981_880,
      "0x55aa11bb22cc33dd44ee55ff66778899aabbccddeeff00112233445566778899",
    ),
    tx(
      "tx5",
      WalletTxKind::ChannelClose,
      640.12,
      1_784_851_500,
      "0xabcdef0123456789fedcba9876543210abcdef0123456789fedcba9876543210",
    ),
    tx(
      "tx6",
      WalletTxKind::Send,
      -250.0,
      1_784_786_700,
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    ),
    tx(
      "tx7",
      WalletTxKind::Receive,
      1200.0,
      1_784_683_980,
      "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    ),
    tx(
      "tx8",
      WalletTxKind::ChannelOpen,
      -800.0,
      1_784_629_320,
      "0x0f1e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3",
    ),
    tx(
      "tx9",
      WalletTxKind::Send,
      -15.75,
      1_784_504_880,
      "0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
    ),
    tx(
      "tx10",
      WalletTxKind::Receive,
      320.5,
      1_784_466_600,
      "0xccddeeff00112233445566778899aabbccddeeff00112233445566778899aabb",
    ),
  ];

  let wallet = WalletSnapshotData {
    has_wallet: true,
    unlocked: true,
    address: address.clone(),
    addresses: vec![WalletAddress {
      address: address.clone(),
      lock_hash,
    }],
    available_ckb: 9820.12,
    total_ckb: 12480.52134,
    locked_ckb: 2660.40134,
    fiat_usd: Some(1842.1),
  };

  (wallet, txs)
}

// ── node ─────────────────────────────────────────────────────────────────────

pub fn mock_runtime() -> NodeRuntime {
  NodeRuntime {
    running: true,
    starting: false,
    alias: Some("ckb-bot-sg".to_string()),
    uptime_hours: 186,
    fiber_pubkey: "02ab91f4c5d27b8e6a1f4d3c9a72e881f0c5b7d4e3a9f8b6c1d2e5f4a3b7c9d1".to_string(),
    fiber_addr: Some(
      "/ip4/18.142.44.12/tcp/8115/p2p/02ab91f4c5d27b8e6a1f4d3c9a72e881f0c5b7d4e3a9f8b6c1d2e5f4a3b7c9d1"
        .to_string(),
    ),
    addresses: vec![
      "/ip4/18.142.44.12/tcp/8115/p2p/02ab91f4c5d27b8e6a1f4d3c9a72e881f0c5b7d4e3a9f8b6c1d2e5f4a3b7c9d1"
        .to_string(),
    ],
    chain: Chain::Testnet,
    version: Some("0.1.0".to_string()),
    commit_hash: Some("3c25bcf1".to_string()),
    peers_count: 48,
    channel_count: 7,
    pending_channel_count: 1,
    watchtower: WatchtowerConfig {
      mode: WatchtowerMode::Standalone,
      endpoint: Some("/ip4/45.77.65.221/tcp/8115".to_string()),
    },
  }
}

fn log_line(epoch_s: i64, level: LogLevel, msg: &str) -> NodeLog {
  NodeLog {
    ts_ms: ms(epoch_s),
    level,
    msg: msg.to_string(),
  }
}

pub fn mock_logs() -> Vec<NodeLog> {
  vec![
    log_line(1_785_291_302, LogLevel::Info, "New outbound payment routed: 1,250 CKB → 9 hops, fee 0.03 CKB"),
    log_line(1_785_291_281, LogLevel::Error, "Payment path failed on node 02c4…9a1f: insufficient inbound liquidity across all 3 candidate routes, retrying with fee bump"),
    log_line(1_785_291_245, LogLevel::Info, "Channel ch-05 updated remote balance -18.9 CKB (relay)"),
    log_line(1_785_291_208, LogLevel::Warn, "HTLC #77812 approaching expiry (95 blocks remaining) on ch-03, forwarding delay 0.8s"),
    log_line(1_785_291_164, LogLevel::Info, "HTLC payment timeout on channel ch-02, retrying"),
    log_line(1_785_291_130, LogLevel::Info, "Invoice settled 2.5 CKB via Fiber Relay East"),
    log_line(1_785_291_093, LogLevel::Warn, "Watchtower check delayed 1.4s across 12 pending HTLCs"),
    log_line(1_785_291_062, LogLevel::Info, "Peer fiber-seed-1 connected"),
    log_line(1_785_291_018, LogLevel::Info, "Channel ch-01 announced new fee policy: base 1,000 shannons, rate 100/1M"),
    log_line(1_785_290_992, LogLevel::Error, "Funding tx 0x9f3a…c401 not confirmed after 120s, polling CKB RPC; retry in 30s"),
    log_line(1_785_290_970, LogLevel::Info, "Channel ch-02 updated local balance +12.4 CKB"),
    log_line(1_785_290_927, LogLevel::Info, "Received 3 invoices for rebalancing, total 4,200 CKB"),
    log_line(1_785_290_892, LogLevel::Warn, "Peer old-relay-3 unresponsive > 30s, marked disconnected"),
    log_line(1_785_290_856, LogLevel::Info, "Rebalance triggered on ch-04: local 240.0 CKB → target 600.0 CKB"),
    log_line(1_785_290_818, LogLevel::Info, "HTLC #77805 settled: 320 CKB → node 03e1…bb22"),
    log_line(1_785_290_780, LogLevel::Info, "Synced to tip #12804221"),
    log_line(1_785_290_744, LogLevel::Info, "Mempool refresh: 2 new CKB txs, 1 funding, 1 withdrawal"),
    log_line(1_785_290_709, LogLevel::Warn, "Outbound liquidity below 10% on ch-06 (76.3 CKB), consider rebalancing"),
    log_line(1_785_290_673, LogLevel::Info, "Channel ch-03 negotiated, awaiting funding tx"),
    log_line(1_785_290_635, LogLevel::Info, "Announced node address /ip4/18.142.44.12/tcp/8115 to 5 seed peers"),
    log_line(1_785_290_598, LogLevel::Error, "Failed to decode incoming peer message from 45.77.65.221: invalid handshake nonce 0x9f3a…c401, ignoring (normal during reconnects)"),
    log_line(1_785_290_561, LogLevel::Info, "Watchtower remote sync OK — 9,512 channels backed up, last tx at block #12,804,214"),
    log_line(1_785_290_524, LogLevel::Info, "Peer fiber-jp-relay connected (2 channels, 4,200 CKB liquidity)"),
    log_line(1_785_290_487, LogLevel::Warn, "Htlc timeout watchtower check delayed 1.2s"),
    log_line(1_785_290_450, LogLevel::Info, "Channel ch-07 opened: 8,000 CKB, peer merchant-asia, funding tx 0x2b91…a7d2"),
    log_line(1_785_290_412, LogLevel::Info, "Swept 3 expired HTLC outputs: +642.10 CKB reclaimed to wallet"),
    log_line(1_785_290_375, LogLevel::Error, "Payment 12,400 CKB to node 09f8…c33d failed: route not found after 5 attempts, all candidate peers lack sufficient outbound capacity"),
    log_line(1_785_290_338, LogLevel::Info, "Invoice generated: 88.25 CKB, expires in 1h, memo \"merchant-payout-week-30\""),
    log_line(1_785_290_301, LogLevel::Info, "Channel ch-08 opened: 2,500 CKB, peer lp-foundation, funding tx 0x77aa…e021"),
    log_line(1_785_290_264, LogLevel::Warn, "High mempool congestion detected (avg fee 0.011 CKB/byte); funding txs may take longer"),
    log_line(1_785_290_227, LogLevel::Info, "Rebalance complete on ch-04: local 596.4 CKB (target 600.0)"),
    log_line(1_785_290_190, LogLevel::Info, "HTLC #77790 settled: 42.5 CKB → node 01ab…c9d2"),
    log_line(1_785_290_153, LogLevel::Info, "Peer relay-eu connected (11 channels, 96,000 CKB total liquidity)"),
    log_line(1_785_290_116, LogLevel::Warn, "Clock skew detected with peer 45.77.65.221: +0.42s, adjusted once"),
    log_line(1_785_290_079, LogLevel::Info, "Channel ch-02 closed: final balances local 1,250.4 / remote 749.6 CKB, mutual close tx 0x8f3a…1c40"),
    log_line(1_785_290_042, LogLevel::Info, "Channel ch-09 updated local balance -320 CKB (payment relay)"),
    log_line(1_785_290_005, LogLevel::Error, "Watchtower upstream 45.77.65.221 returned HTTP 503 for 3 consecutive backups; retrying with exponential backoff (next attempt in 64s)"),
    log_line(1_785_289_968, LogLevel::Info, "Mempool refresh: 4 new CKB txs, all channel funding"),
    log_line(1_785_289_931, LogLevel::Info, "Synced to tip #12804219"),
    log_line(1_785_289_894, LogLevel::Warn, "Inbound liquidity on ch-05 critically low (12 CKB), inbound payments may fail until rebalance"),
    log_line(1_785_289_857, LogLevel::Info, "Payment relayed: 150 CKB via merchant-node, fee earned 0.004 CKB"),
    log_line(1_785_289_820, LogLevel::Info, "Peer merchant-node connected (7 channels, 52,000 CKB total liquidity)"),
    log_line(1_785_289_783, LogLevel::Info, "Channel ch-10 negotiated: 12,000 CKB, peer fiber-jp-relay, conditions base 1,000 / rate 90"),
    log_line(1_785_289_746, LogLevel::Warn, "One of 5 seed peers failed to respond to ping; ignoring, will re-check in 5 min"),
    log_line(1_785_289_709, LogLevel::Info, "HTLC #77770 settled: 1,200 CKB → node 05e2…ff10"),
    log_line(1_785_289_672, LogLevel::Info, "Channel ch-11 opened: 500 CKB, peer opticrum-edge, funding tx 0x11aa…9f0d"),
    log_line(1_785_289_635, LogLevel::Error, "Rebalance attempt on ch-12 interrupted: insufficient remote liquidity on the 3 proposed circular paths; falling back to on-chain sweep"),
    log_line(1_785_289_598, LogLevel::Info, "Fee policy updated on ch-01: base 900 shannons, rate 90/1M (config auto-apply)"),
    log_line(1_785_289_561, LogLevel::Info, "Peer opticrum-edge connected (4 channels, 9,200 CKB liquidity)"),
    log_line(1_785_289_524, LogLevel::Warn, "Outbound liquidity below 10% on ch-03 (98.2 CKB), consider rebalancing"),
    log_line(1_785_289_487, LogLevel::Info, "Synced to tip #12804216"),
    log_line(1_785_289_450, LogLevel::Info, "Funding transaction broadcast for channel ch-14 (peer lp-foundation): tx 0xee44…12ab, inputs [0x9f3a…c401:0, 0x11aa…9f0d:1], outputs [channel script 4,200 CKB, change 80.12 CKB], estimated confirmations 6, fee 0.012 CKB"),
    log_line(1_785_289_413, LogLevel::Info, "Channel negotiation with peer merchant-asia completed after 3 rounds: proposed capacity 8,000 CKB accepted, base fee 1,000 shannons accepted, fee rate 100/1M adjusted to 96/1M to match peer policy, funding script locktime disabled"),
    log_line(1_785_289_376, LogLevel::Warn, "Watchtower backup throttled: 245 queued channel updates, syncing 50 per batch"),
  ]
}

pub fn mock_config() -> NodeConfig {
  NodeConfig {
    services: vec!["fiber".into(), "rpc".into(), "ckb".into()],
    fiber: FiberConfig {
      chain: "testnet".into(),
      announced_node_name: "ckb-bot-sg".into(),
      listening_addr: "/ip4/0.0.0.0/tcp/8228".into(),
      announce_listening_addr: true,
      bootnode_addrs: vec![
        "/ip4/54.179.226.154/tcp/8228/p2p/Qmes1EBD4yNo9Ywkfe6eRw9tG1nVNGLDmMud1xJMsoYFKy".into(),
        "/ip4/16.163.7.105/tcp/8228/p2p/QmdyQWjPtbK4NWWsvy8s69NGJaQULwgeQDT5ZpNDrTNaeV".into(),
      ],
      announced_addrs: vec![],
      standalone_watchtower_rpc_url: "/ip4/45.77.65.221/tcp/8115".into(),
      watchtower_check_interval_seconds: 60,
      disable_built_in_watchtower: false,
      open_channel_auto_accept_min_ckb_funding_amount: 10_000_000_000,
      auto_accept_channel_ckb_funding_amount: 9_900_000_000,
      tlc_expiry_delta: 14_400_000,
      tlc_fee_proportional_millionths: 1000,
      funding_timeout_seconds: 86_400,
      max_inbound_peers: 16,
      min_outbound_peers: 8,
      sync_network_graph: true,
      auto_announce_node: true,
      proxy_url: "".into(),
    },
    rpc: RpcConfig {
      listening_addr: "127.0.0.1:8227".into(),
      enabled_modules: vec![
        "cch".into(),
        "channel".into(),
        "graph".into(),
        "payment".into(),
        "info".into(),
        "invoice".into(),
        "peer".into(),
        "watchtower".into(),
      ],
    },
    ckb: CkbConfig {
      rpc_url: "https://testnet.ckbapp.dev/".into(),
      tx_tracing_polling_interval_ms: 4000,
    },
    scripts: vec![
      FiberScript {
        name: "FundingLock".into(),
        code_hash: "0x6c67887fe201ee0c7853f1682c0b77c0e6214044c156c7558269390a8afa6d7c".into(),
        hash_type: "type".into(),
        args: "0x".into(),
        cell_deps: vec![
          ScriptCellDep::TypeId {
            code_hash: "0x00000000000000000000000000000000000000000000000000545950455f4944".into(),
            hash_type: "type".into(),
            args: "0x3cb7c0304fe53f75bb5727e2484d0beae4bd99d979813c6fc97c3cca569f10f6".into(),
          },
          ScriptCellDep::CellDep {
            tx_hash: "0x12c569a258dd9c5bd99f632bb8314b1263b90921ba31496467580d6b79dd14a7".into(),
            index: "0x0".into(),
            dep_type: "code".into(),
          },
        ],
      },
      FiberScript {
        name: "CommitmentLock".into(),
        code_hash: "0x740dee83f87c6f309824d8fd3fbdd3c8380ee6fc9acc90b1a748438afcdf81d8".into(),
        hash_type: "type".into(),
        args: "0x".into(),
        cell_deps: vec![
          ScriptCellDep::TypeId {
            code_hash: "0x00000000000000000000000000000000000000000000000000545950455f4944".into(),
            hash_type: "type".into(),
            args: "0xf7e458887495cf70dd30d1543cad47dc1dfe9d874177bf19291e4db478d5751b".into(),
          },
          ScriptCellDep::CellDep {
            tx_hash: "0x12c569a258dd9c5bd99f632bb8314b1263b90921ba31496467580d6b79dd14a7".into(),
            index: "0x0".into(),
            dep_type: "code".into(),
          },
        ],
      },
    ],
    udt_whitelist: vec![UdtWhitelistEntry {
      name: "RUSD".into(),
      code_hash: "0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a".into(),
      hash_type: "type".into(),
      args: "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b".into(),
      auto_accept_amount: 1_000_000_000,
      cell_deps: Some(vec![ScriptCellDep::TypeId {
        code_hash: "0x00000000000000000000000000000000000000000000000000545950455f4944".into(),
        hash_type: "type".into(),
        args: "0x97d30b723c0b2c66e9cb8d4d0df4ab5d7222cbb00d4a9a2055ce2e5d7f0d8b0f".into(),
      }]),
    }],
  }
}

// ── channels ─────────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn chan(
  id: &str,
  tx_hash: &str,
  capacity: f64,
  local: f64,
  remote: f64,
  state: &str,
  base_fee: u64,
  ppm: u64,
  created_epoch_s: i64,
) -> Channel {
  let shannons = (capacity * 1e8) as u64;
  Channel {
    channel_id: id.to_string(),
    tx_hash: tx_hash.to_string(),
    output_index: 0,
    capacity_ckb: capacity,
    capacity_shannons: shannons,
    local_balance_ckb: local,
    local_balance_shannons: (local * 1e8) as u64,
    remote_balance_ckb: remote,
    remote_balance_shannons: (remote * 1e8) as u64,
    state: state.to_string(),
    is_public: true,
    enabled: true,
    created_at_ms: ms(created_epoch_s),
    close_flags: None,
    base_fee_mshannons: Some(base_fee),
    fee_rate_ppm: Some(ppm),
  }
}

pub fn mock_channels() -> ChannelList {
  let created = 1_785_201_240;
  ChannelList {
    nodes: vec![
      ChannelNode {
        peer: PeerInfo {
          id: "n-fiber-seed-1".into(),
          alias: Some("fiber-seed-1".into()),
          addr: Some("/ip4/104.21.88.201/tcp/8115".into()), version: Some("0.9.0-rc7".into()),
        },
        channels: vec![
          chan(
            "ch-01",
            "0x8f3a…1c40",
            2000.0,
            1250.4,
            749.6,
            "ChannelReady",
            1000,
            120,
            created,
          ),
          chan(
            "ch-02",
            "0x2b91…a7d2",
            1500.0,
            620.0,
            880.0,
            "ChannelReady",
            800,
            90,
            created,
          ),
        ],
      },
      ChannelNode {
        peer: PeerInfo {
          id: "n-merchant-node".into(),
          alias: Some("merchant-node".into()),
          addr: Some("/ip4/47.98.210.66/tcp/8115".into()), version: Some("0.9.0-rc7".into()),
        },
        channels: vec![
          chan(
            "ch-03",
            "0x44f0…9e21",
            800.0,
            400.0,
            400.0,
            "NegotiatingFunding",
            1000,
            100,
            created,
          ),
          chan(
            "ch-04",
            "0xd13c…55f8",
            600.0,
            510.2,
            89.8,
            "ChannelReady",
            500,
            75,
            created,
          ),
        ],
      },
      ChannelNode {
        peer: PeerInfo {
          id: "n-opticrum-edge".into(),
          alias: Some("opticrum-edge".into()),
          addr: Some("/ip4/13.229.101.7/tcp/8115".into()), version: Some("0.9.0-rc7".into()),
        },
        channels: vec![chan(
          "ch-05",
          "0x7be9…2a04",
          420.0,
          180.5,
          239.5,
          "ChannelReady",
          700,
          110,
          created,
        )],
      },
      ChannelNode {
        peer: PeerInfo {
          id: "n-relay-eu".into(),
          alias: Some("relay-eu".into()),
          addr: Some("/ip4/65.21.103.44/tcp/8115".into()), version: Some("0.9.0-rc7".into()),
        },
        channels: vec![chan(
          "ch-06",
          "0xa09c…33d7",
          1000.0,
          350.0,
          650.0,
          "ChannelReady",
          1200,
          150,
          created,
        )],
      },
      ChannelNode {
        peer: PeerInfo {
          id: "n-lp-foundation".into(),
          alias: Some("lp-foundation".into()),
          addr: Some("/ip4/34.96.140.55/tcp/8115".into()), version: Some("0.9.0-rc7".into()),
        },
        channels: vec![chan(
          "ch-07",
          "0x55d1…8f6a",
          300.0,
          120.0,
          180.0,
          "ShuttingDown",
          1000,
          100,
          created,
        )],
      },
      ChannelNode {
        peer: PeerInfo {
          id: "n-merchant-asia".into(),
          alias: Some("merchant-asia".into()),
          addr: Some("/ip4/13.213.4.99/tcp/8115".into()), version: Some("0.9.0-rc7".into()),
        },
        channels: vec![],
      },
      ChannelNode {
        peer: PeerInfo {
          id: "n-fiber-jp-relay".into(),
          alias: Some("fiber-jp-relay".into()),
          addr: Some("/ip4/13.115.32.211/tcp/8115".into()), version: Some("0.9.0-rc7".into()),
        },
        channels: vec![],
      },
    ],
  }
}

// ── liquidity ────────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn order(
  outpoint: &str,
  capacity: f64,
  spb: u64,
  deposit: f64,
  rental_days: u32,
  created_epoch_s: i64,
) -> LiquidityOrder {
  LiquidityOrder {
    outpoint: outpoint.to_string(),
    channel_capacity_ckb: capacity,
    channel_capacity_shannons: (capacity * 1e8) as u64,
    shannons_per_block: spb,
    annual_yield_bps: apy_bps(spb, capacity),
    deposit_ckb: deposit,
    rental_days: Some(rental_days),
    fiber_address: None,
    xudt_amount: "0".to_string(),
    created_at_ms: Some(ms(created_epoch_s)),
    status: OrderStatus::Open,
  }
}

pub fn mock_orders() -> Vec<LiquidityOrder> {
  vec![
    order(
      "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2:0",
      50_000.0,
      100_000,
      500.0,
      30,
      1_785_289_217,
    ),
    order(
      "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3:1",
      35_000.0,
      80_000,
      350.0,
      30,
      1_785_380_528,
    ),
    order(
      "0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4:2",
      42_000.0,
      60_000,
      420.0,
      14,
      1_785_479_201,
    ),
    order(
      "0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5:0",
      25_000.0,
      90_000,
      250.0,
      7,
      1_785_545_733,
    ),
    order(
      "0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6:0",
      60_000.0,
      110_000,
      600.0,
      30,
      1_786_241_692,
    ),
    order(
      "0xf6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7:1",
      30_000.0,
      70_000,
      300.0,
      14,
      1_786_178_829,
    ),
  ]
}

#[allow(clippy::too_many_arguments)]
fn match_(
  outpoint: &str,
  channel_outpoint: &str,
  capacity: f64,
  spb: u64,
  deposit: f64,
  withdrawable: f64,
  created_epoch_s: i64,
  expires_epoch_s: i64,
  health: MatchHealth,
) -> LiquidityMatch {
  let is_exhausted = matches!(health, MatchHealth::Exhausted) || capacity <= 0.0;
  LiquidityMatch {
    outpoint: outpoint.to_string(),
    channel_outpoint: channel_outpoint.to_string(),
    channel_capacity_ckb: capacity,
    shannons_per_block: spb,
    annual_yield_bps: if capacity <= 0.0 {
      1052.0 // exhausted mock match — hardcoded in the original mockup
    } else {
      apy_bps(spb, capacity)
    },
    deposit_ckb: deposit,
    withdrawable_ckb: withdrawable,
    xudt_amount: "0".to_string(),
    created_at_ms: ms(created_epoch_s),
    expires_at_ms: ms(expires_epoch_s),
    is_exhausted,
    health,
    last_extraction_block: 12_804_000,
    projected_exhaustion_block: 12_890_000,
    seller_lock_hash: "0x8e55773c1c3f5b2f1f2f6e9a8d0c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c"
      .to_string(),
  }
}

pub fn mock_matches() -> Vec<LiquidityMatch> {
  vec![
    match_(
      "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b:0",
      "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2:0",
      50_000.0,
      100_000,
      500.0,
      432.0,
      1_785_289_217,
      1_787_881_217,
      MatchHealth::Healthy,
    ),
    match_(
      "0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c:1",
      "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3:1",
      35_000.0,
      80_000,
      350.0,
      282.0,
      1_785_380_528,
      1_787_972_528,
      MatchHealth::Healthy,
    ),
    match_(
      "0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d:2",
      "0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4:2",
      42_000.0,
      60_000,
      420.0,
      352.0,
      1_785_479_201,
      1_786_688_801,
      MatchHealth::Critical,
    ),
    match_(
      "0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e:0",
      "0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5:0",
      25_000.0,
      90_000,
      250.0,
      182.0,
      1_785_545_733,
      1_786_150_533,
      MatchHealth::Exhausted,
    ),
    match_(
      "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f:0",
      "0xa7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8:0",
      0.0,
      72_000,
      68.0,
      0.0,
      1_785_147_655,
      1_785_406_855,
      MatchHealth::Exhausted,
    ),
  ]
}

pub fn mock_dashboard(orders: &[LiquidityOrder], matches: &[LiquidityMatch]) -> DashboardData {
  let active = matches.iter().filter(|m| !m.is_exhausted).count() as u64;
  let exhausted = matches.len() as u64 - active;
  let total_cap: u64 = matches
    .iter()
    .map(|m| (m.channel_capacity_ckb * 1e8) as u64)
    .sum();
  let order_cap: u64 = orders.iter().map(|o| o.channel_capacity_shannons).sum();
  let avg_spb = if orders.is_empty() {
    0
  } else {
    orders.iter().map(|o| o.shannons_per_block).sum::<u64>() / orders.len() as u64
  };
  let avg_yield = if matches.is_empty() {
    0
  } else {
    (matches.iter().map(|m| m.annual_yield_bps).sum::<f64>() / matches.len() as f64).round() as u64
  };

  // `total_matches` is the market-wide KPI (matches mockup's dashboard badge,
  // 42) — independent of the user's seeded matches surfaced in `recent_matches`.
  DashboardData {
    tip_block: 12_804_221,
    total_orders: 128,
    total_matches: 42,
    active_matches: active,
    exhausted_matches: exhausted,
    total_capacity_locked_shannons: total_cap,
    total_orders_capacity_shannons: order_cap,
    avg_shannons_per_block: avg_spb,
    avg_annual_yield_bps: avg_yield,
    matches_near_exhaustion: mock_deadlines(matches),
    recent_orders: orders.iter().map(order_summary).collect(),
    recent_matches: matches.iter().map(match_summary).collect(),
    yield_distribution: YieldDistribution { buckets: vec![] },
  }
}

fn order_summary(o: &LiquidityOrder) -> OrderSummary {
  OrderSummary {
    outpoint: o.outpoint.clone(),
    channel_capacity_ckb: o.channel_capacity_ckb,
    shannons_per_block: o.shannons_per_block,
    annual_yield_bps: o.annual_yield_bps,
    xudt_amount: o.xudt_amount.clone(),
    has_fiber_address: o.fiber_address.is_some(),
  }
}

fn match_summary(m: &LiquidityMatch) -> MatchSummary {
  MatchSummary {
    match_outpoint: m.outpoint.clone(),
    channel_outpoint: m.channel_outpoint.clone(),
    remaining_capacity_ckb: m.channel_capacity_ckb,
    shannons_per_block: m.shannons_per_block,
    annual_yield_bps: m.annual_yield_bps,
    is_exhausted: m.is_exhausted,
    last_extraction_block: m.last_extraction_block,
    projected_exhaustion_block: m.projected_exhaustion_block,
    xudt_amount: m.xudt_amount.clone(),
  }
}

/// Derive near-exhaustion deadlines (already exhausted matches filtered out —
/// they are covered by `get_matches`' `is_exhausted`), sorted by urgency.
pub fn mock_deadlines(matches: &[LiquidityMatch]) -> Vec<MatchDeadline> {
  let mut deadlines: Vec<MatchDeadline> = matches
    .iter()
    .filter(|m| !m.is_exhausted)
    .map(|m| MatchDeadline {
      match_outpoint: m.outpoint.clone(),
      channel_outpoint: m.channel_outpoint.clone(),
      shannons_per_block: m.shannons_per_block,
      remaining_capacity_ckb: m.channel_capacity_ckb,
      last_extraction_block: m.last_extraction_block,
      match_creation_block: 12_700_000,
      projected_exhaustion_block: m.projected_exhaustion_block,
      blocks_remaining: if m.health == MatchHealth::Critical {
        25_000
      } else {
        300_000
      },
      estimated_hours_remaining: if m.health == MatchHealth::Critical {
        83
      } else {
        1000
      },
      health: m.health,
      extractable_now_ckb: if m.health == MatchHealth::Critical {
        m.deposit_ckb
      } else {
        0.0
      },
    })
    .collect();
  // sort_by_urgency — most urgent (fewest blocks) first.
  deadlines.sort_by_key(|d| d.blocks_remaining);
  deadlines
}
