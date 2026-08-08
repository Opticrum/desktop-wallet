import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import {
  dwellHours,
  matchLife,
  rentalDaysForMatch,
  type BuyOrder,
  type MatchHealth,
  type MatchLife,
  type MyMatch,
} from '../mock/liquidity'

// ── Shared helpers (also consumed by LiquiditySheet) ──────────────────────

export type SheetTarget =
  | { kind: 'order'; item: BuyOrder }
  | { kind: 'match'; item: MyMatch }

export function truncateOutpoint(outpoint: string): string {
  return outpoint.slice(0, 10) + '…' + outpoint.slice(-6)
}

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

/** '2026-08-03T10:14:52+08:00' → '08-03 10:14' */
export function formatTimestamp(iso: string): string {
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`
}

export function daysLeft(match: MyMatch): number {
  const ms = new Date(match.expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
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

export function MatchHealthBadge({ health }: { health: MatchHealth }) {
  const { t } = useLocale()
  const labelMap: Record<MatchHealth, string> = {
    Healthy: t.healthHealthy,
    Warning: t.healthWarning,
    Critical: t.healthCritical,
    Exhausted: t.healthExhausted,
  }
  return <span className={`badge health-${health.toLowerCase()}`}>{labelMap[health]}</span>
}

// ── Pool cell data ────────────────────────────────────────────────────────

/** One floatable circle in the pool — an order or match as an on-chain cell. */
export type PoolCellData = {
  key: string
  kind: 'order' | 'match'
  apyBps: number
  /** Liquidity demand (order) or secured capacity (match) in CKB — drives size. */
  capacityCkb: number
  rentalDays: number
  /** Hours since creation — order cells show this as dwell time. */
  dwellH: number
  life: MatchLife | null
  target: SheetTarget
}

/** Anchor + payload for the hover-detail tooltip. */
export type HoverState = {
  key: string
  data: PoolCellData
  /** Clamped viewport centre-x of the hovered cell. */
  x: number
  /** Viewport y where the tooltip should be anchored (top or bottom of the cell). */
  y: number
  /** True → draw the tooltip below the cell (it was near the top of the viewport). */
  below: boolean
}

/** Cells shown in the pool for one tab (cancelled orders are spent cells — hidden). */
export function buildPoolCells(
  orders: BuyOrder[],
  matches: MyMatch[],
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
        dwellH: dwellHours(o.createdAt),
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

/** Area-scaled diameter so cell area tracks liquidity (square-root mapping). */
const CELL_MIN_D = 96
const CELL_MAX_D = 168
const RING_OVERHANG = 5

export function cellDiameter(capacityCkb: number, maxCapacityCkb: number): number {
  if (maxCapacityCkb <= 0) return CELL_MIN_D
  const t = Math.sqrt(Math.max(0, Math.min(1, capacityCkb / maxCapacityCkb)))
  return Math.round(CELL_MIN_D + (CELL_MAX_D - CELL_MIN_D) * t)
}

// ── Physics — drifting cells with wall bounce + circle collision ──────────

type SimCell = {
  key: string
  el: HTMLButtonElement | null
  x: number
  y: number
  vx: number
  vy: number
  /** Collision radius = visual radius + ring overhang, so the ring stays in-bounds. */
  r: number
}

const MAX_SPEED = 14 // px/s
const RESTITUTION = 0.92

/**
 * Keep a centre inside [r, size - r]. When the cell is larger than the field
 * (size < 2r) no in-bounds position exists — pin to the centre instead of
 * oscillating between contradictory edges (which would render it negative).
 */
function clampAxis(value: number, r: number, size: number): number {
  if (size < 2 * r) return size / 2
  return Math.min(Math.max(value, r), size - r)
}

/** Random, mostly non-overlapping placement inside the field. */
function placeCells(sims: SimCell[], w: number, h: number): void {
  const placed: { x: number; y: number; r: number }[] = []
  for (const s of sims) {
    let x = s.r
    let y = s.r
    let ok = false
    for (let attempt = 0; attempt < 60 && !ok; attempt++) {
      x = s.r + Math.random() * Math.max(0, w - s.r * 2)
      y = s.r + Math.random() * Math.max(0, h - s.r * 2)
      ok = placed.every((p) => Math.hypot(x - p.x, y - p.y) >= s.r + p.r + 8)
    }
    placed.push({ x, y, r: s.r })
    s.x = clampAxis(x, s.r, w)
    s.y = clampAxis(y, s.r, h)
    const ang = Math.random() * Math.PI * 2
    const spd = 3 + Math.random() * 6
    s.vx = Math.cos(ang) * spd
    s.vy = Math.sin(ang) * spd
  }
}

function stepSim(sims: SimCell[], w: number, h: number, dt: number, frozenKey: string | null): void {
  // Gentle random steering keeps the drift genuinely "aimless". The hovered
  // cell is skipped entirely so it stays perfectly still while inspected.
  for (const s of sims) {
    if (s.key === frozenKey) continue
    if (Math.random() < 0.008) {
      const a = Math.random() * Math.PI * 2
      s.vx += Math.cos(a) * 1.2
      s.vy += Math.sin(a) * 1.2
    }
    const spd = Math.hypot(s.vx, s.vy)
    if (spd > MAX_SPEED) {
      s.vx *= MAX_SPEED / spd
      s.vy *= MAX_SPEED / spd
    }
    s.x += s.vx * dt
    s.y += s.vy * dt

    // Wall bounce (a cell larger than the field is pinned to the centre).
    if (w >= 2 * s.r) {
      if (s.x < s.r) {
        s.x = s.r
        s.vx = Math.abs(s.vx)
      } else if (s.x > w - s.r) {
        s.x = w - s.r
        s.vx = -Math.abs(s.vx)
      }
    } else {
      s.x = w / 2
    }
    if (h >= 2 * s.r) {
      if (s.y < s.r) {
        s.y = s.r
        s.vy = Math.abs(s.vy)
      } else if (s.y > h - s.r) {
        s.y = h - s.r
        s.vy = -Math.abs(s.vy)
      }
    } else {
      s.y = h / 2
    }
  }

  // Elastic circle-circle collision with inverse-mass weighting (the frozen
  // cell has zero inverse mass, so it acts as a fixed obstacle — other cells
  // bounce off it but it never moves). A small tangential jitter keeps clumps
  // drifting apart instead of freezing into a lattice; coincident cells
  // (dist 0) are separated along an arbitrary axis.
  for (let i = 0; i < sims.length; i++) {
    for (let j = i + 1; j < sims.length; j++) {
      const a = sims[i]
      const b = sims[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy)
      const minDist = a.r + b.r
      if (dist < minDist) {
        const nx = dist === 0 ? 1 : dx / dist
        const ny = dist === 0 ? 0 : dy / dist
        const aInv = a.key === frozenKey ? 0 : 1
        const bInv = b.key === frozenKey ? 0 : 1
        const totalInv = aInv + bInv
        if (totalInv > 0) {
          const overlap = (minDist - dist) / totalInv
          a.x -= nx * overlap * aInv
          a.y -= ny * overlap * aInv
          b.x += nx * overlap * bInv
          b.y += ny * overlap * bInv
          const relV = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
          if (relV > 0) {
            const impulse = (relV * RESTITUTION) / totalInv
            a.vx -= impulse * nx * aInv
            a.vy -= impulse * ny * aInv
            b.vx += impulse * nx * bInv
            b.vy += impulse * ny * bInv
          }
          a.vx += (Math.random() - 0.5) * 0.3 * aInv
          a.vy += (Math.random() - 0.5) * 0.3 * aInv
          b.vx += (Math.random() - 0.5) * 0.3 * bInv
          b.vy += (Math.random() - 0.5) * 0.3 * bInv
        }
      }
    }
  }
}

// ── Hover tooltip content (relatively detailed cell info) ──────────────────

function OrderTooltipContent({ order }: { order: BuyOrder }) {
  const { t } = useLocale()
  const status =
    order.status === 'cancelled'
      ? t.lmStatusCancelled
      : order.status === 'matched'
        ? t.lmStatusMatched
        : t.meAwaitingMatch
  return (
    <>
      <div className="lm-tooltip-head">
        <span className="mg-tag mg-tag-order">{t.mgOrderTag}</span>
        <span className={`mg-pill ${order.status === 'cancelled' ? 'muted' : order.status === 'matched' ? 'ok' : 'wait'}`}>
          {order.status === 'open' && <i className="mg-dot" />}
          {status}
        </span>
        <span className="lm-tooltip-tx mono">{truncateOutpoint(order.outpoint)}</span>
      </div>
      <div className="lm-tooltip-body">
        <div className="lm-tooltip-row">
          <span>{t.matchCapacity}</span>
          <strong>
            {formatCkb(order.channelCapacityCkb)} {t.unitCkb}
          </strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.matchRate}</span>
          <strong>
            {formatBps(order.annualYieldBps)} · {order.shannonsPerBlock.toLocaleString()} {t.shannonsPerBlock}
          </strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.lmDeposit}</span>
          <strong>
            {formatCkb(order.depositCkb)} {t.unitCkb}
          </strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.lmRentalTerm}</span>
          <strong>{t.lmRentalDays.replace('{days}', String(order.rentalDays))}</strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.lmDwellSince}</span>
          <strong>{t.lmDwellHoursFull.replace('{hours}', String(Math.round(dwellHours(order.createdAt))))}</strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.mgCreatedAt}</span>
          <strong>{formatTimestamp(order.createdAt)}</strong>
        </div>
      </div>
    </>
  )
}

function MatchTooltipContent({ match }: { match: MyMatch }) {
  const { t } = useLocale()
  const life = matchLife(match)
  return (
    <>
      <div className="lm-tooltip-head">
        <span className="mg-tag mg-tag-match">{t.mgMatchTag}</span>
        <MatchHealthBadge health={life.label} />
        <span className="lm-tooltip-tx mono">{truncateOutpoint(match.channelOutpoint)}</span>
      </div>
      <div className="lm-tooltip-body">
        <div className="lm-tooltip-row">
          <span>{t.matchCapacity}</span>
          <strong>
            {life.isExhausted ? '—' : `${formatCkb(match.channelCapacityCkb)} ${t.unitCkb}`}
          </strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.matchRate}</span>
          <strong>
            {formatBps(match.annualYieldBps)} · {match.shannonsPerBlock.toLocaleString()} {t.shannonsPerBlock}
          </strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.lmDeposit}</span>
          <strong>
            {formatCkb(match.depositCkb)} {t.unitCkb}
          </strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.lmWithdrawable}</span>
          <strong>
            {formatCkb(match.withdrawableCkb)} {t.unitCkb}
          </strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.lmRentalTerm}</span>
          <strong>{t.lmRentalDays.replace('{days}', String(rentalDaysForMatch(match)))}</strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.lmRemaining}</span>
          <strong>
            {life.isExhausted
              ? t.healthExhausted
              : `${life.pct}% · ${t.mgRemainingDays.replace('{days}', String(daysLeft(match)))}`}
          </strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.mgExpiresAt}</span>
          <strong>{formatTimestamp(match.expiresAt)}</strong>
        </div>
      </div>
    </>
  )
}

// ── Component ─────────────────────────────────────────────────────────────

export type LiquidityCellFieldProps = {
  orders: BuyOrder[]
  matches: MyMatch[]
  /** Which tab is active — only that type is rendered as cells. */
  mode: 'orders' | 'matches'
  onSelect: (t: SheetTarget) => void
}

export function LiquidityCellField({ orders, matches, mode, onSelect }: LiquidityCellFieldProps) {
  const { t } = useLocale()

  // Re-render every 30s so the match life ring and order dwell hours stay live
  // while the page stays open (the physics loop itself is untouched).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const cells = useMemo(() => buildPoolCells(orders, matches, mode), [orders, matches, mode, tick])
  const maxCap = useMemo(() => Math.max(0, ...cells.map((c) => c.capacityCkb)), [cells])

  const fieldRef = useRef<HTMLDivElement>(null)
  const cellEls = useRef(new Map<string, HTMLButtonElement>())
  const simMap = useRef(new Map<string, SimCell>())
  const sizeRef = useRef({ w: 0, h: 0 })
  const startedRef = useRef(false)
  const cellsRef = useRef(cells)
  cellsRef.current = cells
  const writeAllRef = useRef<() => void>(() => {})

  // The hovered cell freezes in place while a detailed tooltip is shown.
  const [hovered, setHovered] = useState<HoverState | null>(null)
  const hoveredRef = useRef<string | null>(null)

  // Physics loop + wall bounds. Set up once per tab; data changes are
  // reconciled in a separate effect so existing cells never teleport.
  useEffect(() => {
    const host = fieldRef.current
    if (!host) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let last = performance.now()

    const writeAll = () => {
      for (const s of simMap.current.values()) {
        if (s.el) {
          // Translate so the element's visual centre sits at (x, y).
          s.el.style.transform = `translate3d(${s.x - s.r + RING_OVERHANG}px, ${s.y - s.r + RING_OVERHANG}px, 0)`
        }
      }
    }
    writeAllRef.current = writeAll

    const loop = (ts: number) => {
      const dt = Math.min(0.05, (ts - last) / 1000)
      last = ts
      const { w, h } = sizeRef.current
      stepSim([...simMap.current.values()], w, h, dt, hoveredRef.current)
      writeAll()
      raf = requestAnimationFrame(loop)
    }

    // Build a sim for every current cell, then scatter them non-overlapping.
    const buildAll = () => {
      for (const c of cellsRef.current) {
        if (simMap.current.has(c.key)) continue
        const el = cellEls.current.get(c.key) ?? null
        const d = el ? el.offsetWidth : cellDiameter(c.capacityCkb, maxCap)
        simMap.current.set(c.key, { key: c.key, el, x: 0, y: 0, vx: 0, vy: 0, r: d / 2 + RING_OVERHANG })
      }
      const { w, h } = sizeRef.current
      if (w > 0 && h > 0) placeCells([...simMap.current.values()], w, h)
      writeAll()
    }

    const start = () => {
      if (startedRef.current || !host) return
      const { w, h } = sizeRef.current
      if (w <= 0 || h <= 0) return
      startedRef.current = true
      buildAll()
      if (!reduced) raf = requestAnimationFrame(loop)
    }

    // On resize, keep each cell's spot but pull out-of-bounds ones back inside
    // (clamping, not re-scattering).
    const ro = new ResizeObserver(() => {
      sizeRef.current = { w: host.clientWidth, h: host.clientHeight }
      const { w, h } = sizeRef.current
      for (const s of simMap.current.values()) {
        s.x = clampAxis(s.x, s.r, w)
        s.y = clampAxis(s.y, s.r, h)
      }
      writeAll()
      start()
    })
    ro.observe(host)

    sizeRef.current = { w: host.clientWidth, h: host.clientHeight }
    start()

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduced && startedRef.current) {
        last = performance.now()
        raf = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      simMap.current.clear()
      startedRef.current = false
      writeAllRef.current = () => {}
    }
    // Intentionally keyed on mode only — data changes are reconciled below.
  }, [mode])

  // Reconcile the sim map when orders/matches change (publish / cancel /
  // extract): drop removed cells and place brand-new ones without moving any
  // of the existing cells.
  useEffect(() => {
    if (!startedRef.current) return
    const wanted = new Set(cells.map((c) => c.key))
    for (const key of [...simMap.current.keys()]) {
      if (!wanted.has(key)) simMap.current.delete(key)
    }
    // If the hovered cell disappeared (tab switch / extract), close the tooltip.
    if (hoveredRef.current && !wanted.has(hoveredRef.current)) {
      hoveredRef.current = null
      setHovered(null)
    }
    const placed = [...simMap.current.values()].map((s) => ({ x: s.x, y: s.y, r: s.r }))
    const { w, h } = sizeRef.current
    for (const c of cells) {
      if (simMap.current.has(c.key)) continue
      const el = cellEls.current.get(c.key) ?? null
      const d = el ? el.offsetWidth : cellDiameter(c.capacityCkb, maxCap)
      const sim: SimCell = { key: c.key, el, x: 0, y: 0, vx: 0, vy: 0, r: d / 2 + RING_OVERHANG }
      if (w > 0 && h > 0) {
        for (let attempt = 0; attempt < 60; attempt++) {
          sim.x = sim.r + Math.random() * Math.max(0, w - sim.r * 2)
          sim.y = sim.r + Math.random() * Math.max(0, h - sim.r * 2)
          if (placed.every((p) => Math.hypot(sim.x - p.x, sim.y - p.y) >= sim.r + p.r + 8)) break
        }
        placed.push({ x: sim.x, y: sim.y, r: sim.r })
      } else {
        sim.x = sim.r
        sim.y = sim.r
      }
      const ang = Math.random() * Math.PI * 2
      const spd = 3 + Math.random() * 6
      sim.vx = Math.cos(ang) * spd
      sim.vy = Math.sin(ang) * spd
      simMap.current.set(c.key, sim)
    }
    writeAllRef.current()
  }, [cells])

  const themeClass = mode === 'orders' ? 'is-orders' : 'is-matches'

  return (
    <>
      <div
        className={`lm-pool ${themeClass}`}
        id="pool-panel"
        role="tabpanel"
        aria-labelledby={mode === 'orders' ? 'pool-tab-orders' : 'pool-tab-matches'}
      >
        <div className="lm-pool-cells" key={mode} ref={fieldRef}>
          {cells.map((c) => {
            const d = cellDiameter(c.capacityCkb, maxCap)
            const style = {
              width: d,
              height: d,
              '--tier': c.life ? lifeTierColor(c.life.pct) : 'var(--cell-accent)',
              '--ring-deg': c.life ? Math.round(c.life.pct * 3.6) : 0,
            } as CSSProperties
            const frozen = hovered?.key === c.key
            return (
              <button
                key={c.key}
                ref={(el) => {
                  if (el) cellEls.current.set(c.key, el)
                  else cellEls.current.delete(c.key)
                }}
                type="button"
                className={`cell cell-${c.kind} ${c.life?.isExhausted ? 'is-exhausted' : ''} ${frozen ? 'is-frozen' : ''}`}
                style={style}
                onClick={() => onSelect(c.target)}
                onMouseEnter={() => {
                  const el = cellEls.current.get(c.key)
                  hoveredRef.current = c.key
                  if (el) {
                    const r = el.getBoundingClientRect()
                    const below = r.top < 200
                    setHovered({
                      key: c.key,
                      data: c,
                      x: Math.max(16, Math.min(r.left + r.width / 2, window.innerWidth - 16)),
                      y: below ? r.bottom : r.top,
                      below,
                    })
                  }
                }}
                onMouseLeave={() => {
                  hoveredRef.current = null
                  setHovered(null)
                }}
                aria-label={
                  (c.kind === 'order' ? t.mgOrderTag : t.mgMatchTag) +
                  ` · ${t.lmApyLabel} ${formatApyShort(c.apyBps)}%` +
                  ` · ${t.lmDemand} ${formatCkb(c.capacityCkb)} CKB` +
                  (c.kind === 'match' && c.life
                    ? ` · ${t.lmRemaining} ${c.life.pct}%`
                    : ` · ${t.lmDwell} ${Math.round(c.dwellH)}h`)
                }
              >
                {c.kind === 'match' && <span className="cell-ring" aria-hidden />}
                <span className="cell-core">
                  <span className="cell-apy">
                    <span className="cell-apy-num">
                      {formatApyShort(c.apyBps)}
                      <i>%</i>
                    </span>
                    <span className="cell-apy-tag">{t.lmApyLabel}</span>
                  </span>
                  <span className="cell-line cell-demand">
                    <em>{t.lmDemand}</em>
                    {formatCompact(c.capacityCkb)} <small>CKB</small>
                  </span>
                  <span className="cell-line cell-rental">
                    <em>{t.lmRentalDuration}</em>
                    {t.lmRentalDays.replace('{days}', String(c.rentalDays))}
                  </span>
                  {c.kind === 'order' ? (
                    <span className="cell-line cell-dwell">
                      <em>{t.lmDwell}</em>
                      {Math.round(c.dwellH)}
                      <small>h</small>
                    </span>
                  ) : (
                    c.life && (
                      <span className="cell-line cell-remaining">
                        <em>{t.lmRemaining}</em>
                        {c.life.pct}%
                      </span>
                    )
                  )}
                </span>
              </button>
            )
          })}
        </div>
        <span className="lm-pool-hint">{t.lmPoolHint}</span>
        {mode === 'matches' && <span className="lm-pool-legend">{t.lmPoolLegend}</span>}
      </div>

      {hovered && (
        <div
          className={`lm-tooltip ${hovered.below ? 'is-below' : ''}`}
          role="tooltip"
          style={{ left: hovered.x, top: hovered.y }}
        >
          {hovered.data.kind === 'order' ? (
            <OrderTooltipContent order={hovered.data.target.item as BuyOrder} />
          ) : (
            <MatchTooltipContent match={hovered.data.target.item as MyMatch} />
          )}
        </div>
      )}
    </>
  )
}
