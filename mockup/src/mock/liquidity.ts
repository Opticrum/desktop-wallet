// ── Types (mirroring Opticrum SDK shapes, buyer-centric view) ───────────────

export type MatchHealth = 'Healthy' | 'Warning' | 'Critical' | 'Exhausted'

export type OrderStatus = 'open' | 'matched' | 'cancelled'

export type YieldBucket = {
  range_label: string
  order_count: number
  total_capacity_ckb: number
}

export type DashboardData = {
  total_capacity_locked_ckb: number
  total_orders: number
  total_matches: number
  yield_distribution: YieldBucket[]
}

/** A liquidity purchase order I posted (an Order cell where I'm the buyer). */
export type BuyOrder = {
  outpoint: string
  /** Inbound channel capacity requested (CKB). */
  channelCapacityCkb: number
  /** Per-block rent rate in shannons I'll pay. */
  shannonsPerBlock: number
  /** Equivalent annual yield in basis points. */
  annualYieldBps: number
  /** CKB staked as the rent pool. */
  depositCkb: number
  status: OrderStatus
  createdAt: string
}

/** A matched liquidity order (a Match cell where I'm the buyer). */
export type MyMatch = {
  outpoint: string
  channelOutpoint: string
  /** Inbound capacity secured on this channel (0 once exhausted). */
  channelCapacityCkb: number
  /** My stake locked in the match (the rent pool). */
  depositCkb: number
  /** Amount I can still withdraw (deposit − minimum reserve). */
  withdrawableCkb: number
  shannonsPerBlock: number
  annualYieldBps: number
  health: MatchHealth
  isExhausted: boolean
  createdAt: string
}

export type InboundSummary = {
  /** Total inbound capacity secured from active (non-exhausted) matches. */
  totalInboundCkb: number
  activeMatches: number
  totalDepositCkb: number
  avgRateBps: number
}

export type ConnectionPreset = {
  label: string
  rpcUrl: string
  indexerUrl: string
}

// ── Yield math (mirrors opticrum-calculator: rent_per_block × blocks/year) ──

/** ~12s block interval, 2,629,800 blocks per year (calculator config). */
export const BLOCKS_PER_YEAR = 2_629_800

/** Annual yield in basis points for a given per-block rent on a capacity. */
export function shannonsPerBlockToApyBps(shannonsPerBlock: number, capacityCkb: number): number {
  if (!capacityCkb) return 0
  const annualYield = (shannonsPerBlock * BLOCKS_PER_YEAR) / (capacityCkb * 1e8)
  return Math.round(annualYield * 10_000)
}

// ── My purchase orders (购买记录) ───────────────────────────────────────────

export const mockMyOrders: BuyOrder[] = [
  {
    outpoint: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2:0',
    channelCapacityCkb: 50_000,
    shannonsPerBlock: 100_000,
    annualYieldBps: shannonsPerBlockToApyBps(100_000, 50_000),
    depositCkb: 500,
    status: 'matched',
    createdAt: '2026-07-29T09:40:17+08:00',
  },
  {
    outpoint: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3:1',
    channelCapacityCkb: 35_000,
    shannonsPerBlock: 80_000,
    annualYieldBps: shannonsPerBlockToApyBps(80_000, 35_000),
    depositCkb: 350,
    status: 'matched',
    createdAt: '2026-07-30T11:02:08+08:00',
  },
  {
    outpoint: '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4:2',
    channelCapacityCkb: 42_000,
    shannonsPerBlock: 60_000,
    annualYieldBps: shannonsPerBlockToApyBps(60_000, 42_000),
    depositCkb: 420,
    status: 'matched',
    createdAt: '2026-07-31T14:26:41+08:00',
  },
  {
    outpoint: '0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5:0',
    channelCapacityCkb: 25_000,
    shannonsPerBlock: 90_000,
    annualYieldBps: shannonsPerBlockToApyBps(90_000, 25_000),
    depositCkb: 250,
    status: 'matched',
    createdAt: '2026-08-01T08:55:33+08:00',
  },
  {
    outpoint: '0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6:0',
    channelCapacityCkb: 60_000,
    shannonsPerBlock: 110_000,
    annualYieldBps: shannonsPerBlockToApyBps(110_000, 60_000),
    depositCkb: 600,
    status: 'open',
    createdAt: '2026-08-03T10:14:52+08:00',
  },
  {
    outpoint: '0xf6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7:1',
    channelCapacityCkb: 30_000,
    shannonsPerBlock: 70_000,
    annualYieldBps: shannonsPerBlockToApyBps(70_000, 30_000),
    depositCkb: 300,
    status: 'open',
    createdAt: '2026-08-04T16:47:09+08:00',
  },
  {
    outpoint: '0xa7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8:0',
    channelCapacityCkb: 18_000,
    shannonsPerBlock: 72_000,
    annualYieldBps: shannonsPerBlockToApyBps(72_000, 18_000),
    depositCkb: 180,
    status: 'cancelled',
    createdAt: '2026-07-28T12:03:27+08:00',
  },
]

// ── My matched liquidity (已匹配流动性) ──────────────────────────────────────

export const mockMyMatches: MyMatch[] = [
  {
    outpoint: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b:0',
    channelOutpoint: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2:0',
    channelCapacityCkb: 50_000,
    depositCkb: 500,
    withdrawableCkb: 432,
    shannonsPerBlock: 100_000,
    annualYieldBps: shannonsPerBlockToApyBps(100_000, 50_000),
    health: 'Healthy',
    isExhausted: false,
    createdAt: '2026-07-29T09:40:17+08:00',
  },
  {
    outpoint: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c:1',
    channelOutpoint: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3:1',
    channelCapacityCkb: 35_000,
    depositCkb: 350,
    withdrawableCkb: 282,
    shannonsPerBlock: 80_000,
    annualYieldBps: shannonsPerBlockToApyBps(80_000, 35_000),
    health: 'Healthy',
    isExhausted: false,
    createdAt: '2026-07-30T11:02:08+08:00',
  },
  {
    outpoint: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d:2',
    channelOutpoint: '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4:2',
    channelCapacityCkb: 42_000,
    depositCkb: 420,
    withdrawableCkb: 352,
    shannonsPerBlock: 60_000,
    annualYieldBps: shannonsPerBlockToApyBps(60_000, 42_000),
    health: 'Warning',
    isExhausted: false,
    createdAt: '2026-07-31T14:26:41+08:00',
  },
  {
    outpoint: '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e:0',
    channelOutpoint: '0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5:0',
    channelCapacityCkb: 25_000,
    depositCkb: 250,
    withdrawableCkb: 182,
    shannonsPerBlock: 90_000,
    annualYieldBps: shannonsPerBlockToApyBps(90_000, 25_000),
    health: 'Critical',
    isExhausted: false,
    createdAt: '2026-08-01T08:55:33+08:00',
  },
  {
    outpoint: '0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f:0',
    channelOutpoint: '0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6:0',
    channelCapacityCkb: 0,
    depositCkb: 68,
    withdrawableCkb: 0,
    shannonsPerBlock: 72_000,
    annualYieldBps: 1052,
    health: 'Exhausted',
    isExhausted: true,
    createdAt: '2026-07-27T18:20:55+08:00',
  },
]

// ── Inbound liquidity summary (computed from matches) ──────────────────────

export function computeInboundSummary(matches: MyMatch[]): InboundSummary {
  const active = matches.filter((m) => !m.isExhausted)
  const totalInboundCkb = active.reduce((sum, m) => sum + m.channelCapacityCkb, 0)
  const totalDepositCkb = matches.reduce((sum, m) => sum + m.depositCkb, 0)
  const avgRateBps =
    active.length > 0
      ? Math.round(active.reduce((sum, m) => sum + m.annualYieldBps, 0) / active.length)
      : 0
  return {
    totalInboundCkb,
    activeMatches: active.length,
    totalDepositCkb,
    avgRateBps,
  }
}

// ── Market overview (yield distribution) ───────────────────────────────────

export const mockDashboardData: DashboardData = {
  total_capacity_locked_ckb: 1_284_500.75,
  total_orders: 347,
  total_matches: 42,
  yield_distribution: [
    { range_label: '0-5%',   order_count: 120, total_capacity_ckb: 480_000 },
    { range_label: '5-10%',  order_count: 95,  total_capacity_ckb: 380_000 },
    { range_label: '10-15%', order_count: 72,  total_capacity_ckb: 250_000 },
    { range_label: '15-20%', order_count: 40,  total_capacity_ckb: 120_000 },
    { range_label: '20%+',   order_count: 20,  total_capacity_ckb: 54_500.75 },
  ],
}

// ── Connection Presets (driven by the node's chain) ────────────────────────

export const connectionPresets: Record<'mainnet' | 'testnet', ConnectionPreset> = {
  mainnet: {
    label: 'CKB Mainnet',
    rpcUrl: 'https://mainnet.ckb.dev/rpc',
    indexerUrl: 'https://mainnet.ckb.dev/indexer',
  },
  testnet: {
    label: 'CKB Testnet',
    rpcUrl: 'https://testnet.ckb.dev/rpc',
    indexerUrl: 'https://testnet.ckb.dev/indexer',
  },
}
