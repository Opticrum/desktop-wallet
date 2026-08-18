// Wire types — the frontend ⇄ Rust IPC contract (`docs/ipc/ipc-api.md` §5).
//
// Application wire types use camelCase JSON fields. Two exceptions:
// - `NodeConfig` keeps config.yml key names (snake_case).
// - SDK-native aggregates (`DashboardData` / `MatchDeadline` / `OrderSummary` /
//   `MatchSummary` / `YieldDistribution`) keep snake_case and are returned bare
//   by `liquidity.get_dashboard` / `liquidity.get_matches_near_exhaustion`.

export type Chain = 'mainnet' | 'testnet'
export type WatchtowerMode = 'builtin' | 'standalone' | 'disabled'
export type MatchHealth = 'healthy' | 'warning' | 'critical' | 'exhausted'
export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export type WatchtowerConfig = {
  mode: WatchtowerMode
  endpoint?: string | null
}

// ── wallet ────────────────────────────────────────────────────────────────

export type WalletSummary = {
  hasWallet: boolean
  unlocked: boolean
  address: string
  availableCkb: number
  totalCkb: number
  lockedCkb: number
  fiatUsd: number | null
  chain: Chain
}

/** `wallet.get_status` — fast local wallet state (no chain balance), used to
 *  render the unlock form without waiting for the summary. */
export type WalletStatus = {
  hasWallet: boolean
  unlocked: boolean
  address: string
}

export type WalletAddress = {
  address: string
  lockHash: string
}

export type WalletTxKind = 'receive' | 'send' | 'channel_open' | 'channel_close'

export type WalletTx = {
  id: string
  kind: WalletTxKind
  /** Signed: +receive / −send (CKB). */
  amountCkb: number
  timestampMs: number
  txHash: string
}

// ── node ──────────────────────────────────────────────────────────────────

export type NodeRuntime = {
  running: boolean
  starting: boolean
  alias: string | null
  uptimeHours: number
  startedAtMs: number | null
  fiberPubkey: string
  fiberAddr: string | null
  addresses: string[]
  chain: Chain
  version: string | null
  commitHash: string | null
  peersCount: number
  channelCount: number
  pendingChannelCount: number
  watchtower: WatchtowerConfig
}

export type NodeLog = {
  tsMs: number
  level: LogLevel
  msg: string
}

/** `node.fnn_cli_status` — whether the local `fnn-cli` binary is on PATH,
 *  plus the install-docs URL to jump to when it isn't. */
export type FnnCliStatus = {
  installed: boolean
  installUrl: string
}

// `NodeConfig` — config.yml 1:1 (snake_case), the camelCase exception.
export type Service = 'fiber' | 'cch' | 'rpc' | 'ckb'

export type ScriptCellDep =
  | { kind: 'type_id'; code_hash: string; hash_type: string; args: string }
  | { kind: 'cell_dep'; tx_hash: string; index: string; dep_type: string }

export type FiberScript = {
  name: string
  code_hash: string
  hash_type: string
  args: string
  cell_deps: ScriptCellDep[]
}

export type UdtWhitelistEntry = {
  name: string
  code_hash: string
  hash_type: string
  args: string
  auto_accept_amount: number
  cell_deps?: ScriptCellDep[]
}

export type NodeConfig = {
  services: string[]
  fiber: {
    chain: string
    announced_node_name: string
    listening_addr: string
    announce_listening_addr: boolean
    bootnode_addrs: string[]
    announced_addrs: string[]
    standalone_watchtower_rpc_url: string
    watchtower_check_interval_seconds: number
    disable_built_in_watchtower: boolean
    open_channel_auto_accept_min_ckb_funding_amount: number
    auto_accept_channel_ckb_funding_amount: number
    tlc_expiry_delta: number
    tlc_fee_proportional_millionths: number
    funding_timeout_seconds: number
    max_inbound_peers: number
    min_outbound_peers: number
    sync_network_graph: boolean
    auto_announce_node: boolean
    proxy_url: string
  }
  rpc: { listening_addr: string; enabled_modules: string[] }
  ckb: { rpc_url: string; tx_tracing_polling_interval_ms: number }
  scripts: FiberScript[]
  udt_whitelist: UdtWhitelistEntry[]
}

// ── channels ──────────────────────────────────────────────────────────────

export type ChannelList = { nodes: ChannelNode[] }

export type ChannelNode = { peer: PeerInfo; channels: Channel[] }

export type PeerInfo = { id: string; alias: string | null; addr: string | null; version: string | null }

export type Channel = {
  channelId: string
  txHash: string
  outputIndex: number
  capacityCkb: number
  capacityShannons: number
  localBalanceCkb: number
  localBalanceShannons: number
  remoteBalanceCkb: number
  remoteBalanceShannons: number
  /** Fiber raw `state_name` — the frontend maps it to active|pending|closing. */
  state: string
  isPublic: boolean
  enabled: boolean
  createdAtMs: number
  closeFlags: number | null
  baseFeeMshannons: number | null
  feeRatePpm: number | null
}

// ── liquidity ─────────────────────────────────────────────────────────────

export type LiquidityOrder = {
  outpoint: string
  channelCapacityCkb: number
  channelCapacityShannons: number
  shannonsPerBlock: number
  annualYieldBps: number
  depositCkb: number
  rentalDays: number | null
  fiberAddress: string | null
  /** u128 serialized as string. */
  xudtAmount: string
  /** null when the order predates local tracking → frontend hides dwell/rental badges. */
  createdAtMs: number | null
  status: 'open'
}

export type LiquidityMatch = {
  outpoint: string
  channelOutpoint: string
  /** Remaining capacity — 0 when exhausted. */
  channelCapacityCkb: number
  shannonsPerBlock: number
  annualYieldBps: number
  depositCkb: number
  withdrawableCkb: number
  xudtAmount: string
  createdAtMs: number
  /** Number.MAX_SAFE_INTEGER when never exhausted (`shannonsPerBlock === 0`). */
  expiresAtMs: number
  isExhausted: boolean
  health: MatchHealth
  lastExtractionBlock: number
  projectedExhaustionBlock: number
  sellerLockHash: string
}

// ── SDK-native aggregates (snake_case) ─────────────────────────────────────

export type OrderSummary = {
  outpoint: string
  channel_capacity_ckb: number
  shannons_per_block: number
  annual_yield_bps: number
  xudt_amount: string
  has_fiber_address: boolean
}

export type MatchSummary = {
  match_outpoint: string
  channel_outpoint: string
  remaining_capacity_ckb: number
  shannons_per_block: number
  annual_yield_bps: number
  is_exhausted: boolean
  last_extraction_block: number
  projected_exhaustion_block: number
  xudt_amount: string
}

export type MatchDeadline = {
  match_outpoint: string
  channel_outpoint: string
  shannons_per_block: number
  remaining_capacity_ckb: number
  last_extraction_block: number
  match_creation_block: number
  projected_exhaustion_block: number
  blocks_remaining: number
  estimated_hours_remaining: number
  health: MatchHealth
  extractable_now_ckb: number
}

export type YieldDistribution = {
  buckets: { low_bps: number; high_bps: number; count: number; capacity_shannons: number }[]
}

export type DashboardData = {
  tip_block: number
  total_orders: number
  total_matches: number
  active_matches: number
  exhausted_matches: number
  total_capacity_locked_shannons: number
  total_orders_capacity_shannons: number
  avg_shannons_per_block: number
  avg_annual_yield_bps: number
  matches_near_exhaustion: MatchDeadline[]
  recent_orders: OrderSummary[]
  recent_matches: MatchSummary[]
  yield_distribution: YieldDistribution
}

// ── errors ────────────────────────────────────────────────────────────────

/** serde-tagged `{ code, message }` — switch on `code`. */
export type CommandError = {
  code: string
  message: string
}

/** unwraps a rejected invoke into `{ code, message }`. */
export function toCommandError(err: unknown): CommandError {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return err as CommandError
  }
  const e = err instanceof Error ? err.message : String(err)
  return { code: 'internal', message: e }
}
