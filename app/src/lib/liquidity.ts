// Frontend liquidity formulas — pure display/math kept on the frontend per
// `docs/ipc/ipc-api.md` design decision #2. Rust returns raw fields + SDK
// aggregates only; everything here is derived and never re-computed by IPC.
//
// Migration notes from the old `mock/liquidity.ts`:
// - timestamps are now **ms** (`createdAtMs` / `expiresAtMs`), not ISO strings;
// - `matchLife().label` / `LiquidityMatch.health` are **lowercase**
//   (`healthy|warning|critical|exhausted`), matching the wire enum.

import type { DashboardData, MatchHealth, WalletTxKind } from '../api/types'

// ── view types ──────────────────────────────────────────────────────────────

import type { LiquidityOrder as WireOrder, LiquidityMatch as WireMatch } from '../api/types'

export type { MatchHealth }

/** Order view — wire `status` is always `'open'`; the frontend locally
 *  widens it so a cancelled order can be filtered from the pool. */
export type LiquidityOrder = Omit<WireOrder, 'status'> & { status: 'open' | 'cancelled' }
export type LiquidityMatch = WireMatch

/** A pool cell as a clickable target — order or match. */
export type SheetTarget =
  | { kind: 'order'; item: LiquidityOrder }
  | { kind: 'match'; item: LiquidityMatch }

// ── yield math (mirrors opticrum-calculator) ────────────────────────────────

/** ~12s block interval, 2,629,800 blocks per year (calculator config). */
export const BLOCKS_PER_YEAR = 2_629_800

/** CKB blocks per day (~12s interval, mirrors `BLOCKS_PER_YEAR`). */
export const BLOCKS_PER_DAY = Math.round(BLOCKS_PER_YEAR / 365.25)

/** Annual yield in basis points for a given per-block rent on a capacity. */
export function shannonsPerBlockToApyBps(shannonsPerBlock: number, capacityCkb: number): number {
  if (!capacityCkb) return 0
  const annualYield = (shannonsPerBlock * BLOCKS_PER_YEAR) / (capacityCkb * 1e8)
  return Math.round(annualYield * 10_000)
}

/**
 * Per-block rent (shannons) that spends `costCkb` evenly over `days` days:
 * `rate × days × BLOCKS_PER_DAY = cost`. The buy-order form derives the rate
 * from the user's desired liquidity, total cost and duration.
 */
export function costAndDaysToRateShPerBlock(costCkb: number, days: number): number {
  if (!costCkb || !days) return 0
  return Math.round((costCkb * 1e8) / (days * BLOCKS_PER_DAY))
}

// ── derived state: match life + rental/dwell ────────────────────────────────

export type MatchLife = {
  /** 0–100: remaining lifetime as a fraction of the match's full term. */
  pct: number
  label: MatchHealth
  isExhausted: boolean
}

/** Rental term of a match in whole days (created → expires). */
export function rentalDaysForMatch(match: LiquidityMatch): number {
  return Math.max(1, Math.round((match.expiresAtMs - match.createdAtMs) / 86_400_000))
}

/** Hours elapsed since a creation ms timestamp (order dwell time). */
export function dwellHours(createdAtMs: number, now: number = Date.now()): number {
  if (!createdAtMs) return 0
  return Math.max(0, (now - createdAtMs) / 3_600_000)
}

/** Life of a match at a given instant — derived from its expiry, not stored. */
export function matchLife(match: LiquidityMatch, now: number = Date.now()): MatchLife {
  const total = match.expiresAtMs - match.createdAtMs
  const remaining = match.expiresAtMs - now
  const pct = total > 0 ? Math.round(Math.max(0, Math.min(1, remaining / total)) * 100) : 0
  const label: MatchHealth =
    pct <= 0 ? 'exhausted' : pct < 25 ? 'critical' : pct < 50 ? 'warning' : 'healthy'
  return { pct, label, isExhausted: pct <= 0 }
}

/**
 * Phase of a match at a given instant. The hesitation window is a buyer-side
 * concept: while it's open the buyer may only withdraw ALL rent (abandon the
 * order) and may NOT inject; once it elapses (or the seller's first extraction
 * commits the match) withdrawal is forbidden and injection opens up. Mirrors
 * the contract predicate `last_extraction_block == 0 && tip −
 * match_creation_block ≤ HESITATION_BLOCKS`, approximated in wall-clock ms via
 * `hesitationEndsAtMs`.
 */
export type MatchPhase = 'hesitating' | 'active' | 'exhausted'

export function matchPhase(match: LiquidityMatch, now: number = Date.now()): MatchPhase {
  if (matchLife(match, now).isExhausted) return 'exhausted'
  // The window only constrains the buyer; other roles just see a live match.
  if (match.role !== 'buyer') return 'active'
  // First extraction commits the match — the buyer is no longer free to leave.
  if (match.lastExtractionBlock > 0) return 'active'
  return now < match.hesitationEndsAtMs ? 'hesitating' : 'active'
}

/** Milliseconds still left in the hesitation window (0 when not hesitating). */
export function hesitationRemainingMs(match: LiquidityMatch, now: number = Date.now()): number {
  return Math.max(0, match.hesitationEndsAtMs - now)
}

/** Compact h/m countdown: `8h 32m` / `43m` / `0m`. */
export function formatDurationHm(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000))
  if (totalMin <= 0) return '0m'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Discrete tier color for a hesitating match cell (pending buyer decision). */
export function hesitationTierColor(): string {
  return 'var(--violet)'
}

// ── extraction progress (capacity-based, reflects on-chain extractions) ─────

/** Rent-extraction progress of a match — the original rent pool (traced back
 *  on-chain) vs the current remaining pool (`depositCkb`). Time-based
 *  `matchLife` stays the rental-term projection; this is the actual funds
 *  drained by seller extractions. */
export type ExtractionProgress = {
  /** Original rent pool at match creation (CKB). */
  originalCkb: number
  /** Current remaining rent pool (`depositCkb`, CKB). */
  remainingCkb: number
  /** `max(0, original − remaining)` — rent swept so far (buyer injections are
   *  not attributed, so this clamps at 0 rather than going negative). */
  extractedCkb: number
  /** 0–100: extracted as a fraction of the original stake. */
  pct: number
}

export function extractionProgress(match: LiquidityMatch): ExtractionProgress {
  const original = match.originalStakeCkb
  const remaining = match.depositCkb
  const extracted = Math.max(0, original - remaining)
  const pct = original > 0 ? Math.round(Math.min(100, (extracted / original) * 100)) : 0
  return { originalCkb: original, remainingCkb: remaining, extractedCkb: extracted, pct }
}

export type InboundSummary = {
  /** Total inbound capacity secured from active (non-exhausted) matches. */
  totalInboundCkb: number
  activeMatches: number
  totalDepositCkb: number
  avgRateBps: number
}

export function computeInboundSummary(matches: LiquidityMatch[]): InboundSummary {
  const active = matches.filter((m) => !matchLife(m).isExhausted)
  const totalInboundCkb = active.reduce((sum, m) => sum + m.channelCapacityCkb, 0)
  const totalDepositCkb = matches.reduce((sum, m) => sum + m.depositCkb, 0)
  const avgRateBps =
    active.length > 0
      ? Math.round(active.reduce((sum, m) => sum + m.annualYieldBps, 0) / active.length)
      : 0
  return { totalInboundCkb, activeMatches: active.length, totalDepositCkb, avgRateBps }
}

/** Days left until a match expires. */
export function daysLeft(match: LiquidityMatch, now: number = Date.now()): number {
  const ms = match.expiresAtMs - now
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

// ── formatting helpers ──────────────────────────────────────────────────────

export function formatCkb(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/** Compact amount for tight spaces: 50_000 → "50k", 1_250_000 → "1.3M". */
export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000
    return (Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')) + 'M'
  }
  if (amount >= 1_000) {
    const k = amount / 1_000
    return (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '')) + 'k'
  }
  return String(amount)
}

export function formatBps(bps: number): string {
  return (bps / 100).toFixed(2) + '% APY'
}

/** Compact APY for the cell face: "12.5" (trailing zeros trimmed). */
export function formatApyShort(bps: number): string {
  const value = bps / 100
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/** Bare APY number — the `%` unit rides in the tile's `.kpi-sub`. */
export function formatBpsNum(bps: number): string {
  return (bps / 100).toFixed(2)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** `1785289217000` → `07-29 09:40` — rendered in UTC+8 to match the +08:00
 *  wall-clock of the seeded mock timestamps (TZ-independent). */
export function formatTimestamp(ms: number): string {
  if (!ms) return '—'
  const tz = new Date(ms + 8 * 3_600_000)
  return `${pad2(tz.getUTCMonth() + 1)}-${pad2(tz.getUTCDate())} ${pad2(tz.getUTCHours())}:${pad2(tz.getUTCMinutes())}`
}

/** Per-block rent in CKB (shannons ÷ 1e8), trimmed of trailing zeros. */
export function formatCkbPerBlock(shannons: number): string {
  const ckb = shannons / 1e8
  if (ckb === 0) return '0'
  return ckb.toFixed(4).replace(/\.?0+$/, '')
}

// ── global market dashboard (snake → camel thin mapper) ─────────────────────

/** High bound for a yield bucket Rust leaves open (u64::MAX → unbounded). */
const OPEN_BPS = 1e15

export type YieldBucketView = {
  lowBps: number
  highBps: number
  /** True when this is the top, open-ended band ("≥ X%"). */
  openEnded: boolean
  count: number
  capacityCkb: number
  /** 0–1 share of the largest bucket's count — drives the histogram bar. */
  share: number
}

/** Global whole-chain market overview — the `lm-dash` panel (camelCase). */
export type MappedDashboard = {
  totalOrders: number
  totalCapacityLockedCkb: number
  totalOrdersCapacityCkb: number
  avgAnnualYieldBps: number
  avgShannonsPerBlock: number
  yieldBuckets: YieldBucketView[]
  hasYieldData: boolean
}

/** Thin snake_case → camelCase mapper for `liquidity.get_dashboard`. */
export function mapDashboardData(raw: DashboardData): MappedDashboard {
  const buckets = (raw.yield_distribution?.buckets ?? []).map((b) => ({
    lowBps: b.low_bps,
    highBps: b.high_bps,
    openEnded: b.high_bps >= OPEN_BPS,
    count: b.count,
    capacityCkb: b.capacity_shannons / 1e8,
  }))
  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 1)
  return {
    totalOrders: raw.total_orders,
    totalCapacityLockedCkb: raw.total_capacity_locked_shannons / 1e8,
    totalOrdersCapacityCkb: raw.total_orders_capacity_shannons / 1e8,
    avgAnnualYieldBps: raw.avg_annual_yield_bps,
    avgShannonsPerBlock: raw.avg_shannons_per_block,
    yieldBuckets: buckets.map((b) => ({ ...b, share: b.count / maxCount })),
    hasYieldData: buckets.some((b) => b.count > 0),
  }
}

/** "0–2%" / open-ended "≥25%" — the yield-band label for a histogram row. */
export function formatYieldRange(b: YieldBucketView): string {
  const lo = trimPercent(b.lowBps / 100)
  if (b.openEnded) return `≥${lo}%`
  return `${lo}–${trimPercent(b.highBps / 100)}%`
}

/** Percent string with ≤1 decimal, trailing `.0` trimmed (25 → "25"). */
const trimPercent = (v: number) =>
  v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, '')

/** Outpoint without its `:index` suffix, then truncated in the middle.
 *  Default `10…6` (cell tooltips); the detail drawer uses `20…12`. */
export function truncateOutpointNoIndex(outpoint: string, head = 10, tail = 6): string {
  const base = outpoint.split(':')[0]
  if (base.length <= head + tail) return base
  return base.slice(0, head) + '…' + base.slice(-tail)
}

export function truncateOutpoint(outpoint: string, head = 10, tail = 6): string {
  if (outpoint.length <= head + tail) return outpoint
  return outpoint.slice(0, head) + '…' + outpoint.slice(-tail)
}

/** Truncate a fiber pubkey in the middle. Empty (legacy cache) → `—`. */
export function truncatePubkey(pubkey: string, head = 10, tail = 6): string {
  if (!pubkey) return '—'
  if (pubkey.length <= head + tail) return pubkey
  return pubkey.slice(0, head) + '…' + pubkey.slice(-tail)
}

/** Continuous green → yellow → red life color, driven by remaining lifetime pct. */
export function lifeColor(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100))
  if (t >= 0.5) return `color-mix(in srgb, var(--ok) ${((t - 0.5) * 200).toFixed(0)}%, var(--warn))`
  return `color-mix(in srgb, var(--warn) ${(t * 200).toFixed(0)}%, var(--danger))`
}

/**
 * Discrete life tier for match cells: the remaining rental time is bucketed
 * into tiers that start green and run red as the deadline approaches.
 */
export function lifeTierColor(pct: number): string {
  if (pct <= 0) return 'var(--ink-4)'
  if (pct < 25) return 'var(--danger)'
  if (pct < 50) return 'var(--warn)'
  if (pct < 75) return 'color-mix(in srgb, var(--ok) 55%, var(--warn))'
  return 'var(--ok)'
}

/** Order dwell freshness: hours waiting → background tier color. */
export function dwellTierColor(hours: number): string {
  if (hours <= 72) return 'var(--me-accent)' // <= 3d fresh
  if (hours <= 168) return 'var(--warn)' // 3-7d aging
  return 'var(--danger)' // > 7d aged
}

/** Area-scaled diameter so cell area tracks liquidity (square-root mapping). */
export function cellDiameter(capacityCkb: number, maxCapacityCkb: number): number {
  const CELL_MIN_D = 96
  const CELL_MAX_D = 168
  if (maxCapacityCkb <= 0) return CELL_MIN_D
  const t = Math.sqrt(Math.max(0, Math.min(1, capacityCkb / maxCapacityCkb)))
  return Math.round(CELL_MIN_D + (CELL_MAX_D - CELL_MIN_D) * t)
}

// ── pool cell building ──────────────────────────────────────────────────────

/** One floatable circle in the pool — an order or match as an on-chain cell. */
export type PoolCellData = {
  key: string
  kind: 'order' | 'match'
  apyBps: number
  /** Liquidity demand (order) or secured capacity (match) in CKB — drives size. */
  capacityCkb: number
  rentalDays: number | null
  /** Hours since creation — order cells show this as dwell time. */
  dwellH: number
  life: MatchLife | null
  /** Match lifecycle phase (orders are always `'active'`). */
  phase: MatchPhase
  /** Rent-extraction progress — matches only; `null` for orders. */
  extraction: ExtractionProgress | null
  /** True when the cell's embedded fiber pubkey ≠ the current node's — the
   *  order was created under an older/different node identity. */
  fiberKeyMismatch: boolean
  target: SheetTarget
}

/** Strip 0x and case so cache / RPC hex compares as the same identity. */
export function normalizeFiberPubkey(hex: string): string {
  return hex.trim().replace(/^0x/i, '').toLowerCase()
}

/** True only when both sides are non-empty and equal after normalize. */
export function sameFiberPubkey(cellPubkey: string, nodeFiberPubkey: string): boolean {
  const cell = normalizeFiberPubkey(cellPubkey)
  const node = normalizeFiberPubkey(nodeFiberPubkey)
  return cell.length > 0 && cell === node
}

/** Cell pubkey vs current node pubkey — only mismatches when the node pubkey
 *  is known (node down → unknown, not a mismatch). */
const pubkeyMismatch = (cellPubkey: string, nodeFiberPubkey?: string) =>
  !!nodeFiberPubkey && !sameFiberPubkey(cellPubkey, nodeFiberPubkey)

/** Cells shown in the pool for one tab (cancelled orders are spent cells — hidden). */
export function buildPoolCells(
  orders: LiquidityOrder[],
  matches: LiquidityMatch[],
  mode: 'orders' | 'matches',
  nodeFiberPubkey?: string,
): PoolCellData[] {
  if (mode === 'orders') {
    return orders
      .filter((o) => o.status !== 'cancelled')
      .map((o) => ({
        key: o.outpoint,
        kind: 'order' as const,
        apyBps: o.annualYieldBps,
        capacityCkb: o.channelCapacityCkb,
        rentalDays: o.rentalDays,
        dwellH: dwellHours(o.createdAtMs ?? 0),
        life: null,
        phase: 'active' as const,
        extraction: null,
        fiberKeyMismatch: pubkeyMismatch(o.fiberPubkey, nodeFiberPubkey),
        target: { kind: 'order' as const, item: o },
      }))
  }
  return matches.map((m) => ({
    key: m.outpoint,
    kind: 'match' as const,
    apyBps: m.annualYieldBps,
    capacityCkb: m.channelCapacityCkb,
    rentalDays: rentalDaysForMatch(m),
    dwellH: 0,
    life: matchLife(m),
    phase: matchPhase(m),
    extraction: extractionProgress(m),
    fiberKeyMismatch: pubkeyMismatch(m.fiberPubkey, nodeFiberPubkey),
    target: { kind: 'match' as const, item: m },
  }))
}

// ── wallet-formula re-export used by liquidity page charts ──────────────────

export type { WalletTxKind }
