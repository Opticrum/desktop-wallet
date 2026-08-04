// ── Types (mirroring Opticrum SDK shapes) ────────────────────────────────

export type MatchHealth = 'Healthy' | 'Warning' | 'Critical' | 'Exhausted'

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

export type MatchDeadline = {
  projected_exhaustion_block: number
  blocks_remaining: number
  estimated_hours_remaining: number
  health: MatchHealth
  extractable_now_ckb: number
}

export type MatchSummary = {
  channel_outpoint: string
  shannons_per_block: number
  annual_yield_bps: number
  total_capacity_ckb: number
  remaining_capacity_ckb: number
  extractable_now_ckb: number
  is_exhausted: boolean
  deadline: MatchDeadline
}

export type ConnectionPreset = {
  label: string
  rpcUrl: string
  indexerUrl: string
}

// ── Mock Dashboard Data ──────────────────────────────────────────────────

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

// ── Mock Matches ─────────────────────────────────────────────────────────

export const mockMatches: MatchSummary[] = [
  {
    channel_outpoint: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2:0',
    shannons_per_block: 420,
    annual_yield_bps: 735,
    total_capacity_ckb: 50_000,
    remaining_capacity_ckb: 42_300,
    extractable_now_ckb: 152.4,
    is_exhausted: false,
    deadline: {
      projected_exhaustion_block: 1_285_000,
      blocks_remaining: 84_200,
      estimated_hours_remaining: 701,
      health: 'Healthy',
      extractable_now_ckb: 152.4,
    },
  },
  {
    channel_outpoint: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3:1',
    shannons_per_block: 680,
    annual_yield_bps: 1190,
    total_capacity_ckb: 35_000,
    remaining_capacity_ckb: 28_900,
    extractable_now_ckb: 87.2,
    is_exhausted: false,
    deadline: {
      projected_exhaustion_block: 1_243_000,
      blocks_remaining: 42_200,
      estimated_hours_remaining: 351,
      health: 'Healthy',
      extractable_now_ckb: 87.2,
    },
  },
  {
    channel_outpoint: '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4:0',
    shannons_per_block: 310,
    annual_yield_bps: 542,
    total_capacity_ckb: 20_000,
    remaining_capacity_ckb: 15_600,
    extractable_now_ckb: 44.8,
    is_exhausted: false,
    deadline: {
      projected_exhaustion_block: 1_356_000,
      blocks_remaining: 155_200,
      estimated_hours_remaining: 1293,
      health: 'Healthy',
      extractable_now_ckb: 44.8,
    },
  },
  {
    channel_outpoint: '0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5:2',
    shannons_per_block: 520,
    annual_yield_bps: 910,
    total_capacity_ckb: 42_000,
    remaining_capacity_ckb: 35_100,
    extractable_now_ckb: 121.9,
    is_exhausted: false,
    deadline: {
      projected_exhaustion_block: 1_270_000,
      blocks_remaining: 69_200,
      estimated_hours_remaining: 576,
      health: 'Healthy',
      extractable_now_ckb: 121.9,
    },
  },
  {
    channel_outpoint: '0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6:0',
    shannons_per_block: 890,
    annual_yield_bps: 1557,
    total_capacity_ckb: 8_000,
    remaining_capacity_ckb: 465,
    extractable_now_ckb: 12.3,
    is_exhausted: false,
    deadline: {
      projected_exhaustion_block: 1_201_350,
      blocks_remaining: 550,
      estimated_hours_remaining: 4.6,
      health: 'Warning',
      extractable_now_ckb: 12.3,
    },
  },
  {
    channel_outpoint: '0xf6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7:1',
    shannons_per_block: 750,
    annual_yield_bps: 1312,
    total_capacity_ckb: 15_000,
    remaining_capacity_ckb: 1_020,
    extractable_now_ckb: 28.7,
    is_exhausted: false,
    deadline: {
      projected_exhaustion_block: 1_202_100,
      blocks_remaining: 1_300,
      estimated_hours_remaining: 10.8,
      health: 'Warning',
      extractable_now_ckb: 28.7,
    },
  },
  {
    channel_outpoint: '0xa7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8:0',
    shannons_per_block: 640,
    annual_yield_bps: 1120,
    total_capacity_ckb: 12_000,
    remaining_capacity_ckb: 3_200,
    extractable_now_ckb: 19.5,
    is_exhausted: false,
    deadline: {
      projected_exhaustion_block: 1_205_800,
      blocks_remaining: 5_000,
      estimated_hours_remaining: 41.7,
      health: 'Warning',
      extractable_now_ckb: 19.5,
    },
  },
  {
    channel_outpoint: '0xb8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9:2',
    shannons_per_block: 980,
    annual_yield_bps: 1715,
    total_capacity_ckb: 5_500,
    remaining_capacity_ckb: 82,
    extractable_now_ckb: 4.1,
    is_exhausted: false,
    deadline: {
      projected_exhaustion_block: 1_200_920,
      blocks_remaining: 120,
      estimated_hours_remaining: 1.0,
      health: 'Critical',
      extractable_now_ckb: 4.1,
    },
  },
  {
    channel_outpoint: '0xc9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0:0',
    shannons_per_block: 550,
    annual_yield_bps: 962,
    total_capacity_ckb: 9_200,
    remaining_capacity_ckb: 38,
    extractable_now_ckb: 7.8,
    is_exhausted: false,
    deadline: {
      projected_exhaustion_block: 1_200_856,
      blocks_remaining: 56,
      estimated_hours_remaining: 0.5,
      health: 'Critical',
      extractable_now_ckb: 7.8,
    },
  },
  {
    channel_outpoint: '0xd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1:1',
    shannons_per_block: 360,
    annual_yield_bps: 630,
    total_capacity_ckb: 18_000,
    remaining_capacity_ckb: 0,
    extractable_now_ckb: 0,
    is_exhausted: true,
    deadline: {
      projected_exhaustion_block: 1_200_800,
      blocks_remaining: 0,
      estimated_hours_remaining: 0,
      health: 'Exhausted',
      extractable_now_ckb: 0,
    },
  },
]

// ── Connection Presets ───────────────────────────────────────────────────

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
