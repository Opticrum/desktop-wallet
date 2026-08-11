// Frontend liquidity formulas — pure display/math kept on the frontend per
// `docs/ipc/ipc-api.md` design decision #2. Rust returns raw fields + SDK
// aggregates only; everything here is derived and never re-computed by IPC.
//
// Migration notes from the old `mock/liquidity.ts`:
// - timestamps are now **ms** (`createdAtMs` / `expiresAtMs`), not ISO strings;
// - `matchLife().label` / `LiquidityMatch.health` are **lowercase**
//   (`healthy|warning|critical|exhausted`), matching the wire enum.

import type { MatchHealth, WalletTxKind } from '../api/types'

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

/** Annual yield in basis points for a given per-block rent on a capacity. */
export function shannonsPerBlockToApyBps(shannonsPerBlock: number, capacityCkb: number): number {
  if (!capacityCkb) return 0
  const annualYield = (shannonsPerBlock * BLOCKS_PER_YEAR) / (capacityCkb * 1e8)
  return Math.round(annualYield * 10_000)
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

/** Outpoint without its `:index` suffix, then truncated for the detail row. */
export function truncateOutpointNoIndex(outpoint: string): string {
  const base = outpoint.split(':')[0]
  if (base.length <= 16) return base
  return base.slice(0, 10) + '…' + base.slice(-6)
}

export function truncateOutpoint(outpoint: string): string {
  return outpoint.slice(0, 10) + '…' + outpoint.slice(-6)
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
  target: SheetTarget
}

/** Cells shown in the pool for one tab (cancelled orders are spent cells — hidden). */
export function buildPoolCells(
  orders: LiquidityOrder[],
  matches: LiquidityMatch[],
  mode: 'orders' | 'matches',
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
    target: { kind: 'match' as const, item: m },
  }))
}

// ── wallet-formula re-export used by liquidity page charts ──────────────────

export type { WalletTxKind }
