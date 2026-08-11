// ── DEV-ONLY browser fallback ─────────────────────────────────────────────
//
// The desktop app always reads wallet/channels/node/liquidity data from the
// Rust shell over Tauri `invoke` (which serves the mock datasets from
// `src-tauri/src/mock_data.rs`). This module exists ONLY so the standalone
// vite browser workflow (`cd app && npm run dev`) — no Tauri shell — still
// renders the same wire-shaped data. It mirrors the Rust command surface and
// is kept in sync with `docs/ipc/ipc-api.md`; it is not a data source for the
// packaged desktop app.

import type {
  ChannelList,
  DashboardData,
  LiquidityMatch,
  LiquidityOrder,
  MatchDeadline,
  MatchHealth,
  NodeConfig,
  NodeLog,
  NodeRuntime,
  WalletSummary,
  WalletTx,
} from './types'

// ── datasets ──────────────────────────────────────────────────────────────

const WALLET: WalletSummary = {
  hasWallet: true,
  unlocked: true,
  address:
    'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s2p',
  availableCkb: 9820.12,
  totalCkb: 12480.52134,
  lockedCkb: 2660.40134,
  fiatUsd: 1842.1,
  chain: 'testnet',
}

const TXS: WalletTx[] = [
  { id: 'tx1', kind: 'receive', amountCkb: 500, timestampMs: 1785201240000, txHash: '0x7a1c9e2b4d8f01a3c5e7b9d0f2a4c6e8b1d3f5a7c9e0b2d4f6a8c0e2b4d6f8a0' },
  { id: 'tx2', kind: 'channel_open', amountCkb: -1200, timestampMs: 1785139320000, txHash: '0x91b044aa12cd34ef56ab78cd90ef12ab34cd56ef78ab90cd12ef34ab56cd78ef' },
  { id: 'tx3', kind: 'send', amountCkb: -42.5, timestampMs: 1785037200000, txHash: '0x33de0c18a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef012345678' },
  { id: 'tx4', kind: 'receive', amountCkb: 88.25, timestampMs: 1784981880000, txHash: '0x55aa11bb22cc33dd44ee55ff66778899aabbccddeeff00112233445566778899' },
  { id: 'tx5', kind: 'channel_close', amountCkb: 640.12, timestampMs: 1784851500000, txHash: '0xabcdef0123456789fedcba9876543210abcdef0123456789fedcba9876543210' },
  { id: 'tx6', kind: 'send', amountCkb: -250, timestampMs: 1784786700000, txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
  { id: 'tx7', kind: 'receive', amountCkb: 1200, timestampMs: 1784683980000, txHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210' },
  { id: 'tx8', kind: 'channel_open', amountCkb: -800, timestampMs: 1784629320000, txHash: '0x0f1e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3' },
  { id: 'tx9', kind: 'send', amountCkb: -15.75, timestampMs: 1784504880000, txHash: '0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff' },
  { id: 'tx10', kind: 'receive', amountCkb: 320.5, timestampMs: 1784466600000, txHash: '0xccddeeff00112233445566778899aabbccddeeff00112233445566778899aabb' },
]

const RUNTIME: NodeRuntime = {
  running: true,
  alias: 'ckb-bot-sg',
  uptimeHours: 186,
  fiberPubkey: '02ab91f4c5d27b8e6a1f4d3c9a72e881f0c5b7d4e3a9f8b6c1d2e5f4a3b7c9d1',
  fiberAddr: '/ip4/18.142.44.12/tcp/8115',
  addresses: ['/ip4/18.142.44.12/tcp/8115'],
  chain: 'testnet',
  version: '0.1.0',
  commitHash: '3c25bcf1',
  peersCount: 48,
  channelCount: 7,
  pendingChannelCount: 1,
  watchtower: { mode: 'standalone', endpoint: '/ip4/45.77.65.221/tcp/8115' },
}

const LOGS: NodeLog[] = [
  { tsMs: 1785291302000, level: 'INFO', msg: 'New outbound payment routed: 1,250 CKB → 9 hops, fee 0.03 CKB' },
  { tsMs: 1785291281000, level: 'ERROR', msg: 'Payment path failed on node 02c4…9a1f: insufficient inbound liquidity across all 3 candidate routes, retrying with fee bump' },
  { tsMs: 1785291245000, level: 'INFO', msg: 'Channel ch-05 updated remote balance -18.9 CKB (relay)' },
  { tsMs: 1785291208000, level: 'WARN', msg: 'HTLC #77812 approaching expiry (95 blocks remaining) on ch-03, forwarding delay 0.8s' },
  { tsMs: 1785291164000, level: 'INFO', msg: 'HTLC payment timeout on channel ch-02, retrying' },
  { tsMs: 1785291130000, level: 'INFO', msg: 'Invoice settled 2.5 CKB via Fiber Relay East' },
  { tsMs: 1785291093000, level: 'WARN', msg: 'Watchtower check delayed 1.4s across 12 pending HTLCs' },
  { tsMs: 1785291062000, level: 'INFO', msg: 'Peer fiber-seed-1 connected' },
  { tsMs: 1785291018000, level: 'INFO', msg: 'Channel ch-01 announced new fee policy: base 1,000 shannons, rate 100/1M' },
  { tsMs: 1785290992000, level: 'ERROR', msg: 'Funding tx 0x9f3a…c401 not confirmed after 120s, polling CKB RPC; retry in 30s' },
  { tsMs: 1785290970000, level: 'INFO', msg: 'Channel ch-02 updated local balance +12.4 CKB' },
  { tsMs: 1785290927000, level: 'INFO', msg: 'Received 3 invoices for rebalancing, total 4,200 CKB' },
  { tsMs: 1785290892000, level: 'WARN', msg: 'Peer old-relay-3 unresponsive > 30s, marked disconnected' },
  { tsMs: 1785290856000, level: 'INFO', msg: 'Rebalance triggered on ch-04: local 240.0 CKB → target 600.0 CKB' },
  { tsMs: 1785290818000, level: 'INFO', msg: 'HTLC #77805 settled: 320 CKB → node 03e1…bb22' },
  { tsMs: 1785290780000, level: 'INFO', msg: 'Synced to tip #12804221' },
  { tsMs: 1785290744000, level: 'INFO', msg: 'Mempool refresh: 2 new CKB txs, 1 funding, 1 withdrawal' },
  { tsMs: 1785290709000, level: 'WARN', msg: 'Outbound liquidity below 10% on ch-06 (76.3 CKB), consider rebalancing' },
]

// config.yml default — mirror of `src-tauri/src/mock_data.rs::mock_config`.
const CONFIG: NodeConfig = {
  services: ['fiber', 'rpc', 'ckb'],
  fiber: {
    chain: 'testnet',
    announced_node_name: 'ckb-bot-sg',
    listening_addr: '/ip4/0.0.0.0/tcp/8228',
    announce_listening_addr: true,
    bootnode_addrs: [
      '/ip4/54.179.226.154/tcp/8228/p2p/Qmes1EBD4yNo9Ywkfe6eRw9tG1nVNGLDmMud1xJMsoYFKy',
      '/ip4/16.163.7.105/tcp/8228/p2p/QmdyQWjPtbK4NWWsvy8s69NGJaQULwgeQDT5ZpNDrTNaeV',
    ],
    announced_addrs: [],
    standalone_watchtower_rpc_url: '/ip4/45.77.65.221/tcp/8115',
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
    proxy_url: '',
  },
  rpc: { listening_addr: '127.0.0.1:8227', enabled_modules: ['cch', 'channel', 'graph', 'payment', 'info', 'invoice', 'peer', 'watchtower'] },
  ckb: { rpc_url: 'https://testnet.ckbapp.dev/', tx_tracing_polling_interval_ms: 4000 },
  scripts: [
    {
      name: 'FundingLock',
      code_hash: '0x6c67887fe201ee0c7853f1682c0b77c0e6214044c156c7558269390a8afa6d7c',
      hash_type: 'type',
      args: '0x',
      cell_deps: [
        { kind: 'type_id', code_hash: '0x00000000000000000000000000000000000000000000000000545950455f4944', hash_type: 'type', args: '0x3cb7c0304fe53f75bb5727e2484d0beae4bd99d979813c6fc97c3cca569f10f6' },
        { kind: 'cell_dep', tx_hash: '0x12c569a258dd9c5bd99f632bb8314b1263b90921ba31496467580d6b79dd14a7', index: '0x0', dep_type: 'code' },
      ],
    },
    {
      name: 'CommitmentLock',
      code_hash: '0x740dee83f87c6f309824d8fd3fbdd3c8380ee6fc9acc90b1a748438afcdf81d8',
      hash_type: 'type',
      args: '0x',
      cell_deps: [
        { kind: 'type_id', code_hash: '0x00000000000000000000000000000000000000000000000000545950455f4944', hash_type: 'type', args: '0xf7e458887495cf70dd30d1543cad47dc1dfe9d874177bf19291e4db478d5751b' },
        { kind: 'cell_dep', tx_hash: '0x12c569a258dd9c5bd99f632bb8314b1263b90921ba31496467580d6b79dd14a7', index: '0x0', dep_type: 'code' },
      ],
    },
  ],
  udt_whitelist: [
    {
      name: 'RUSD',
      code_hash: '0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a',
      hash_type: 'type',
      args: '0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b',
      auto_accept_amount: 1_000_000_000,
      cell_deps: [{ kind: 'type_id', code_hash: '0x00000000000000000000000000000000000000000000000000545950455f4944', hash_type: 'type', args: '0x97d30b723c0b2c66e9cb8d4d0df4ab5d7222cbb00d4a9a2055ce2e5d7f0d8b0f' }],
    },
  ],
}

const CHANNELS: ChannelList = {
  nodes: [
    {
      peer: { id: 'n-fiber-seed-1', alias: 'fiber-seed-1', addr: '/ip4/104.21.88.201/tcp/8115' },
      channels: [
        { channelId: 'ch-01', txHash: '0x8f3a…1c40', outputIndex: 0, capacityCkb: 2000, capacityShannons: 200000000000, localBalanceCkb: 1250.4, localBalanceShannons: 125040000000, remoteBalanceCkb: 749.6, remoteBalanceShannons: 74960000000, state: 'ChannelReady', isPublic: true, enabled: true, createdAtMs: 1785201240000, closeFlags: null, baseFeeMshannons: 1000, feeRatePpm: 120 },
        { channelId: 'ch-02', txHash: '0x2b91…a7d2', outputIndex: 0, capacityCkb: 1500, capacityShannons: 150000000000, localBalanceCkb: 620, localBalanceShannons: 62000000000, remoteBalanceCkb: 880, remoteBalanceShannons: 88000000000, state: 'ChannelReady', isPublic: true, enabled: true, createdAtMs: 1785201240000, closeFlags: null, baseFeeMshannons: 800, feeRatePpm: 90 },
      ],
    },
    {
      peer: { id: 'n-merchant-node', alias: 'merchant-node', addr: '/ip4/47.98.210.66/tcp/8115' },
      channels: [
        { channelId: 'ch-03', txHash: '0x44f0…9e21', outputIndex: 0, capacityCkb: 800, capacityShannons: 80000000000, localBalanceCkb: 400, localBalanceShannons: 40000000000, remoteBalanceCkb: 400, remoteBalanceShannons: 40000000000, state: 'NegotiatingFunding', isPublic: true, enabled: true, createdAtMs: 1785201240000, closeFlags: null, baseFeeMshannons: 1000, feeRatePpm: 100 },
        { channelId: 'ch-04', txHash: '0xd13c…55f8', outputIndex: 0, capacityCkb: 600, capacityShannons: 60000000000, localBalanceCkb: 510.2, localBalanceShannons: 51020000000, remoteBalanceCkb: 89.8, remoteBalanceShannons: 8980000000, state: 'ChannelReady', isPublic: true, enabled: true, createdAtMs: 1785201240000, closeFlags: null, baseFeeMshannons: 500, feeRatePpm: 75 },
      ],
    },
    {
      peer: { id: 'n-opticrum-edge', alias: 'opticrum-edge', addr: '/ip4/13.229.101.7/tcp/8115' },
      channels: [{ channelId: 'ch-05', txHash: '0x7be9…2a04', outputIndex: 0, capacityCkb: 420, capacityShannons: 42000000000, localBalanceCkb: 180.5, localBalanceShannons: 18050000000, remoteBalanceCkb: 239.5, remoteBalanceShannons: 23950000000, state: 'ChannelReady', isPublic: true, enabled: true, createdAtMs: 1785201240000, closeFlags: null, baseFeeMshannons: 700, feeRatePpm: 110 }],
    },
    {
      peer: { id: 'n-relay-eu', alias: 'relay-eu', addr: '/ip4/65.21.103.44/tcp/8115' },
      channels: [{ channelId: 'ch-06', txHash: '0xa09c…33d7', outputIndex: 0, capacityCkb: 1000, capacityShannons: 100000000000, localBalanceCkb: 350, localBalanceShannons: 35000000000, remoteBalanceCkb: 650, remoteBalanceShannons: 65000000000, state: 'ChannelReady', isPublic: true, enabled: true, createdAtMs: 1785201240000, closeFlags: null, baseFeeMshannons: 1200, feeRatePpm: 150 }],
    },
    {
      peer: { id: 'n-lp-foundation', alias: 'lp-foundation', addr: '/ip4/34.96.140.55/tcp/8115' },
      channels: [{ channelId: 'ch-07', txHash: '0x55d1…8f6a', outputIndex: 0, capacityCkb: 300, capacityShannons: 30000000000, localBalanceCkb: 120, localBalanceShannons: 12000000000, remoteBalanceCkb: 180, remoteBalanceShannons: 18000000000, state: 'ShuttingDown', isPublic: true, enabled: true, createdAtMs: 1785201240000, closeFlags: null, baseFeeMshannons: 1000, feeRatePpm: 100 }],
    },
    { peer: { id: 'n-merchant-asia', alias: 'merchant-asia', addr: '/ip4/13.213.4.99/tcp/8115' }, channels: [] },
    { peer: { id: 'n-fiber-jp-relay', alias: 'fiber-jp-relay', addr: '/ip4/13.115.32.211/tcp/8115' }, channels: [] },
  ],
}

const BLOCKS_PER_YEAR = 2_629_800
function apyBps(spb: number, capacityCkb: number): number {
  if (!capacityCkb) return 0
  return Math.round((spb * BLOCKS_PER_YEAR) / (capacityCkb * 1e8) * 10_000)
}

function makeOrder(outpoint: string, capacity: number, spb: number, deposit: number, rentalDays: number, createdAtMs: number): LiquidityOrder {
  return {
    outpoint, channelCapacityCkb: capacity, channelCapacityShannons: capacity * 1e8,
    shannonsPerBlock: spb, annualYieldBps: apyBps(spb, capacity), depositCkb: deposit,
    rentalDays, fiberAddress: null, xudtAmount: '0', createdAtMs, status: 'open',
  }
}

const ORDERS: LiquidityOrder[] = [
  makeOrder('0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2:0', 50000, 100000, 500, 30, 1785289217000),
  makeOrder('0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3:1', 35000, 80000, 350, 30, 1785380528000),
  makeOrder('0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4:2', 42000, 60000, 420, 14, 1785479201000),
  makeOrder('0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5:0', 25000, 90000, 250, 7, 1785545733000),
  makeOrder('0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6:0', 60000, 110000, 600, 30, 1786241692000),
  makeOrder('0xf6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7:1', 30000, 70000, 300, 14, 1786178829000),
]

function makeMatch(outpoint: string, channelOutpoint: string, capacity: number, spb: number, deposit: number, withdrawable: number, createdAtMs: number, expiresAtMs: number, health: MatchHealth): LiquidityMatch {
  const exhausted = health === 'exhausted' || capacity <= 0
  return {
    outpoint, channelOutpoint, channelCapacityCkb: capacity, shannonsPerBlock: spb,
    annualYieldBps: capacity <= 0 ? 1052 : apyBps(spb, capacity), depositCkb: deposit,
    withdrawableCkb: withdrawable, xudtAmount: '0', createdAtMs, expiresAtMs,
    isExhausted: exhausted, health, lastExtractionBlock: 12804000, projectedExhaustionBlock: 12890000,
    sellerLockHash: '0x8e55773c1c3f5b2f1f2f6e9a8d0c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c',
  }
}

const MATCHES: LiquidityMatch[] = [
  makeMatch('0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b:0', '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2:0', 50000, 100000, 500, 432, 1785289217000, 1787881217000, 'healthy'),
  makeMatch('0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c:1', '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3:1', 35000, 80000, 350, 282, 1785380528000, 1787972528000, 'healthy'),
  makeMatch('0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d:2', '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4:2', 42000, 60000, 420, 352, 1785479201000, 1786688801000, 'critical'),
  makeMatch('0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e:0', '0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5:0', 25000, 90000, 250, 182, 1785545733000, 1786150533000, 'exhausted'),
  makeMatch('0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f:0', '0xa7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8:0', 0, 72000, 68, 0, 1785147655000, 1785406855000, 'exhausted'),
]

// ── mutable state so write commands behave like the Rust store ─────────────

const state: {
  unlocked: boolean
  running: boolean
  orders: LiquidityOrder[]
  matches: LiquidityMatch[]
  config: NodeConfig
  nextChannel: number
} = {
  unlocked: true,
  running: true,
  orders: ORDERS,
  matches: MATCHES,
  config: CONFIG,
  nextChannel: 8,
}

function fakeTxHash(seed: string): string {
  let h = 0xcbf29ce484222325
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x1000001b3) >>> 0
  }
  return '0x' + h.toString(16).padStart(16, '0').repeat(4)
}

function dashboard(): DashboardData {
  const active = state.matches.filter((m) => !m.isExhausted).length
  const deadlines = state.matches
    .filter((m) => !m.isExhausted)
    .map((m): MatchDeadline => ({
      match_outpoint: m.outpoint,
      channel_outpoint: m.channelOutpoint,
      shannons_per_block: m.shannonsPerBlock,
      remaining_capacity_ckb: m.channelCapacityCkb,
      last_extraction_block: m.lastExtractionBlock,
      match_creation_block: 12700000,
      projected_exhaustion_block: m.projectedExhaustionBlock,
      blocks_remaining: m.health === 'critical' ? 25000 : 300000,
      estimated_hours_remaining: m.health === 'critical' ? 83 : 1000,
      health: m.health,
      extractable_now_ckb: m.health === 'critical' ? m.depositCkb : 0,
    }))
    .sort((a, b) => a.blocks_remaining - b.blocks_remaining)
  return {
    tip_block: 12804221,
    total_orders: 128,
    // market-wide KPI (matches mockup's dashboard badge), independent of the
    // user's seeded matches in `recent_matches`
    total_matches: 42,
    active_matches: active,
    exhausted_matches: state.matches.length - active,
    total_capacity_locked_shannons: state.matches.reduce((s, m) => s + m.channelCapacityCkb * 1e8, 0),
    total_orders_capacity_shannons: state.orders.reduce((s, o) => s + o.channelCapacityShannons, 0),
    avg_shannons_per_block: state.orders.reduce((s, o) => s + o.shannonsPerBlock, 0) / Math.max(1, state.orders.length),
    avg_annual_yield_bps: state.matches.reduce((s, m) => s + m.annualYieldBps, 0) / Math.max(1, state.matches.length),
    matches_near_exhaustion: deadlines,
    recent_orders: state.orders.map((o) => ({
      outpoint: o.outpoint, channel_capacity_ckb: o.channelCapacityCkb, shannons_per_block: o.shannonsPerBlock,
      annual_yield_bps: o.annualYieldBps, xudt_amount: o.xudtAmount, has_fiber_address: !!o.fiberAddress,
    })),
    recent_matches: state.matches.map((m) => ({
      match_outpoint: m.outpoint, channel_outpoint: m.channelOutpoint, remaining_capacity_ckb: m.channelCapacityCkb,
      shannons_per_block: m.shannonsPerBlock, annual_yield_bps: m.annualYieldBps, is_exhausted: m.isExhausted,
      last_extraction_block: m.lastExtractionBlock, projected_exhaustion_block: m.projectedExhaustionBlock, xudt_amount: m.xudtAmount,
    })),
    yield_distribution: { buckets: [] },
  }
}

function watchtowerFromConfig(cfg: NodeConfig) {
  const url = cfg.fiber.standalone_watchtower_rpc_url.trim()
  if (url) return { mode: 'standalone' as const, endpoint: url }
  if (cfg.fiber.disable_built_in_watchtower) return { mode: 'disabled' as const, endpoint: null }
  return { mode: 'builtin' as const, endpoint: null }
}

// ── command surface ─────────────────────────────────────────────────────────

/** Throw a wire-shaped `{ code, message }` error (never returns). */
function fail(code: string, message: string): never {
  throw { code, message }
}

export async function browserInvoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  switch (cmd) {
    // wallet
    case 'wallet.get_summary':
      return { ...WALLET, unlocked: state.unlocked, chain: state.config.fiber.chain } as T
    case 'wallet.get_addresses':
      return [{ address: WALLET.address, lockHash: '0x8e55773c1c3f5b2f1f2f6e9a8d0c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c' }] as T
    case 'wallet.get_transactions':
      return TXS as T
    case 'wallet.unlock':
      if (!state.unlocked) state.unlocked = true
      return { ...WALLET, unlocked: true } as T
    case 'wallet.lock':
      state.unlocked = false
      return null as T
    case 'wallet.create_hd_wallet':
      return { mnemonic: 'gospel upgrade venue act wrong abandon length convince genre dream bundle glue', address: WALLET.address, addresses: [WALLET.address] } as T
    case 'wallet.import_mnemonic':
    case 'wallet.import_private_key':
      state.unlocked = true
      return { ...WALLET, unlocked: true } as T
    case 'wallet.derive_addresses':
      if (!state.unlocked) fail('wallet_locked', 'wallet is locked')
      return [WALLET.address] as T
    case 'wallet.send_ckb':
      if (!state.unlocked) fail('wallet_locked', 'wallet is locked')
      return { tx_hash: fakeTxHash('send') } as T

    // node
    case 'node.get_runtime':
      return { ...RUNTIME, running: state.running, chain: state.config.fiber.chain, watchtower: watchtowerFromConfig(state.config) } as T
    case 'node.start':
      state.running = true
      return { ...RUNTIME, running: true } as T
    case 'node.stop':
      state.running = false
      return null as T
    case 'node.get_logs':
      return LOGS as T
    case 'node.get_config':
      return state.config as T
    case 'node.save_config':
      state.config = args.config as NodeConfig
      return { chain: state.config.fiber.chain, watchtower: watchtowerFromConfig(state.config) } as T

    // channels
    case 'channels.list':
      return CHANNELS as T
    case 'channels.connect_peer': {
      const addr = args.addr as string
      const peerId = (args.pubkey as string | undefined) ?? addr.split('/p2p/')[1] ?? `peer-${state.nextChannel++}`
      return { peer_id: peerId } as T
    }
    case 'channels.disconnect_peer':
      return null as T
    case 'channels.open_channel': {
      const n = state.nextChannel++
      return { temp_id: `temp-${n}`, channel_id: `ch-${String(n).padStart(2, '0')}` } as T
    }
    case 'channels.close_channel':
      return null as T

    // liquidity
    case 'liquidity.get_dashboard':
      return dashboard() as T
    case 'liquidity.get_orders':
      return state.orders as T
    case 'liquidity.get_matches':
      return state.matches as T
    case 'liquidity.get_matches_near_exhaustion':
      return dashboard().matches_near_exhaustion as T
    case 'liquidity.publish_order': {
      if (!state.unlocked) fail('wallet_locked', 'wallet is locked')
      const capacity = (args.capacity_shannons as number) / 1e8
      const deposit = (args.rent_capacity_shannons as number) / 1e8
      const outpoint = `${fakeTxHash(`order:${state.orders.length}`)}:0`
      const now = Date.now()
      const order: LiquidityOrder = {
        outpoint, channelCapacityCkb: capacity, channelCapacityShannons: args.capacity_shannons as number,
        shannonsPerBlock: args.shannons_per_block as number, annualYieldBps: apyBps(args.shannons_per_block as number, capacity),
        depositCkb: deposit, rentalDays: args.rental_days as number, fiberAddress: (args.fiber_address as string | undefined) ?? null,
        xudtAmount: '0', createdAtMs: now, status: 'open',
      }
      state.orders.unshift(order)
      return { order_outpoint: outpoint, tx_hash: fakeTxHash(outpoint) } as T
    }
    case 'liquidity.cancel_order':
      state.orders = state.orders.filter((o) => o.outpoint !== args.outpoint)
      return { tx_hash: fakeTxHash(String(args.outpoint)) } as T
    case 'liquidity.inject_deposit': {
      const m = state.matches.find((x) => x.outpoint === args.match_outpoint)
      if (m) {
        m.depositCkb += (args.amount_shannons as number) / 1e8
        m.withdrawableCkb += (args.amount_shannons as number) / 1e8
      }
      return { tx_hash: fakeTxHash(String(args.match_outpoint)) } as T
    }
    case 'liquidity.withdraw_deposit': {
      const m = state.matches.find((x) => x.outpoint === args.match_outpoint)
      if (m) {
        const amount = (args.amount_shannons as number) / 1e8
        if (amount > m.withdrawableCkb) fail('invalid_input', 'amount exceeds withdrawable balance')
        m.depositCkb = Math.max(0, m.depositCkb - amount)
        m.withdrawableCkb = Math.max(0, m.withdrawableCkb - amount)
      }
      return { tx_hash: fakeTxHash(String(args.match_outpoint)) } as T
    }
    case 'liquidity.extract_spent_match': {
      const m = state.matches.find((x) => x.outpoint === args.match_outpoint)
      if (!m) return fail('invalid_input', 'match not found')
      if (!m.isExhausted) return fail('not_exhausted', 'match still has remaining capacity')
      const returned = m.depositCkb
      state.matches = state.matches.filter((x) => x.outpoint !== args.match_outpoint)
      return { tx_hash: fakeTxHash(String(args.match_outpoint)), returned_ckb: returned } as T
    }

    default:
      return fail('internal', `unknown command: ${cmd}`)
  }
}
