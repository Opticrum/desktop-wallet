import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import {
  buildPoolCells,
  cellDiameter,
  daysLeft,
  dwellHours,
  dwellTierColor,
  formatApyShort,
  formatBps,
  formatCkb,
  formatCompact,
  formatTimestamp,
  lifeTierColor,
  matchLife,
  rentalDaysForMatch,
  type LiquidityMatch,
  type LiquidityOrder,
  type PoolCellData,
  type SheetTarget,
} from '../lib/liquidity'

export type { SheetTarget } from '../lib/liquidity'

// ── Anchor + payload for the hover-detail tooltip. ─────────────────────────

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
const RING_OVERHANG = 5

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

function OrderTooltipContent({ order, sharePct }: { order: LiquidityOrder; sharePct: number }) {
  const { t } = useLocale()
  return (
    <>
      <div className="lm-tooltip-body">
        <div className="lm-tooltip-row lm-tooltip-share">
          <span>{t.lmShareOfTotal}</span>
          <strong>{sharePct.toFixed(1)}%</strong>
        </div>
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
          <strong>{t.lmRentalDays.replace('{days}', String(order.rentalDays ?? '—'))}</strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.lmDwellSince}</span>
          <strong>{t.lmDwellHoursFull.replace('{hours}', String(Math.round(dwellHours(order.createdAtMs ?? 0))))}</strong>
        </div>
        <div className="lm-tooltip-row">
          <span>{t.mgCreatedAt}</span>
          <strong>{formatTimestamp(order.createdAtMs ?? 0)}</strong>
        </div>
      </div>
    </>
  )
}

function MatchTooltipContent({ match }: { match: LiquidityMatch }) {
  const { t } = useLocale()
  const life = matchLife(match)
  return (
    <>
      <div className="lm-tooltip-body">
        <div className="lm-tooltip-row">
          <span>{t.matchCapacity}</span>
          <strong>
            {formatCkb(match.channelCapacityCkb)} {t.unitCkb}
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
          <strong>{formatTimestamp(match.expiresAtMs)}</strong>
        </div>
      </div>
    </>
  )
}

// ── Pool Overview corner donut (first-glance market Overview) ─────────────

type DonutSegment = { key: string; value: number; color: string }

/** A compact corner donut — one slice per cell: orders sized by demand in a
    cool palette (never echoing the cells' warm dwell colours); matches sized by
    capacity and coloured by health. Hovering a cell lights up its own slice. */
function OverviewChart({
  orders,
  matches,
  mode,
  hoverKey = null,
}: {
  orders: LiquidityOrder[]
  matches: LiquidityMatch[]
  mode: 'orders' | 'matches'
  hoverKey?: string | null
}) {
  const { t } = useLocale()

  let segments: DonutSegment[]
  let total: number
  let count: number
  if (mode === 'orders') {
    const active = orders
      .filter((o) => o.status !== 'cancelled')
      .sort((a, b) => b.channelCapacityCkb - a.channelCapacityCkb)
    const COOL = [
      'var(--donut-1)',
      'var(--donut-3)',
      'color-mix(in srgb, var(--donut-1) 55%, var(--donut-3))',
      'color-mix(in srgb, var(--donut-1) 55%, var(--surface))',
      'color-mix(in srgb, var(--donut-3) 55%, var(--surface))',
      'color-mix(in srgb, var(--donut-1) 70%, var(--surface))',
    ]
    segments = active.map((o, i) => ({ key: o.outpoint, value: o.channelCapacityCkb, color: COOL[i % COOL.length] }))
    total = segments.reduce((sum, s) => sum + s.value, 0)
    count = segments.length
  } else {
    // One equal slice per match cell (keyed by outpoint), coloured by the
    // match's health — so the ring mirrors the cell collection 1:1 and every
    // cell (even a spent 0-capacity one) gets a visible slice that lights up
    // on hover.
    segments = matches.map((m) => {
      const label = matchLife(m).label
      return {
        key: m.outpoint,
        value: 1,
        color:
          label === 'healthy'
            ? 'var(--ok)'
            : label === 'warning'
              ? 'var(--warn)'
              : label === 'critical'
                ? 'var(--danger)'
                : 'var(--ink-4)',
      }
    })
    total = segments.length
    count = segments.length
  }

  // Every cell is its own slice (keyed by outpoint), so the hovered cell always
  // lights up its own segment — same resolution for orders and matches.
  const litKey = hoverKey

  const R = 40
  const CIRC = 2 * Math.PI * R
  let acc = 0

  return (
    <div className="lm-pool-donut" role="img" aria-label={`${count} ${mode === 'orders' ? t.mgOrderTag : t.mgMatchTag}`}>
      <svg viewBox="0 0 100 100" aria-hidden>
        {total > 0 &&
          segments.map((seg, i) => {
            if (seg.value === 0) return null
            const frac = seg.value / total
            const offset = -acc * CIRC
            acc += frac
            const lit = litKey === seg.key
            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={lit ? 13 : 11}
                strokeLinecap="butt"
                transform="rotate(-90 50 50)"
                strokeDasharray={`${frac * CIRC} ${CIRC}`}
                strokeDashoffset={offset}
                style={{
                  filter: `drop-shadow(0 0 ${lit ? 5 : 3}px color-mix(in srgb, ${seg.color} ${lit ? 75 : 60}%, transparent))`,
                }}
              />
            )
          })}
      </svg>
      <span className="lm-pool-donut-count">{count}</span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────

export type LiquidityCellFieldProps = {
  orders: LiquidityOrder[]
  matches: LiquidityMatch[]
  /** Which tab is active — only that type is rendered as cells. */
  mode: 'orders' | 'matches'
  /** Key of the clicked cell whose detail drawer is open — it stays highlighted. */
  selected?: string | null
  onSelect: (t: SheetTarget) => void
}

export function LiquidityCellField({ orders, matches, mode, selected, onSelect }: LiquidityCellFieldProps) {
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
  // Sum of all active orders' channel demand — drives the pie share % on hover.
  const totalDemand = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.channelCapacityCkb, 0),
    [orders],
  )

  const fieldRef = useRef<HTMLDivElement>(null)
  const cellEls = useRef(new Map<string, HTMLButtonElement>())
  const simMap = useRef(new Map<string, SimCell>())
  const sizeRef = useRef({ w: 0, h: 0 })
  const startedRef = useRef(false)
  const cellsRef = useRef(cells)
  cellsRef.current = cells
  const writeAllRef = useRef<() => void>(() => {})

  // The hovered cell freezes in place while a detailed tooltip is shown; the
  // selected cell (detail drawer open) shows the same tooltip persistently.
  const [hovered, setHovered] = useState<HoverState | null>(null)
  const [selectedTooltip, setSelectedTooltip] = useState<HoverState | null>(null)
  const hoveredRef = useRef<string | null>(null)

  // Anchor the selected cell's tooltip to it (the cell freezes on selection).
  useEffect(() => {
    if (!selected) {
      setSelectedTooltip(null)
      return
    }
    const el = cellEls.current.get(selected)
    const cell = cells.find((c) => c.key === selected)
    if (el && cell) {
      const r = el.getBoundingClientRect()
      const below = r.top < 200
      setSelectedTooltip({
        key: selected,
        data: cell,
        x: Math.max(16, Math.min(r.left + r.width / 2, window.innerWidth - 16)),
        y: below ? r.bottom : r.top,
        below,
      })
    }
  }, [selected, cells])

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
  }, [mode, maxCap])

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
  // The hovered or selected cell freezes while its tooltip is shown.
  hoveredRef.current = hovered?.key ?? selected ?? null

  // Merged tooltip source — the hovered cell wins, otherwise the selected one.
  const tooltip = hovered ?? selectedTooltip
  const tooltipOrder = tooltip && tooltip.data.kind === 'order' ? (tooltip.data.target.item as LiquidityOrder) : null
  // Share of total demand for the inspected order — shown in the tooltip + pie.
  const hoveredOrderShare =
    tooltipOrder && totalDemand > 0 ? (tooltipOrder.channelCapacityCkb / totalDemand) * 100 : 0

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
            // Gauge dial: match = remaining life %; order = dwell progress toward 7 days.
            const gauge = c.kind === 'match' ? (c.life?.pct ?? 0) : Math.min(100, (c.dwellH / 168) * 100)
            const style = {
              width: d,
              height: d,
              '--cell-d': `${d}px`,
              '--tier': c.kind === 'match'
                ? (c.life ? lifeTierColor(c.life.pct) : 'var(--cell-accent)')
                : dwellTierColor(c.dwellH),
              '--gauge': gauge,
            } as CSSProperties
            const frozen = hovered?.key === c.key
            // Once one cell is selected, the rest dim out and become
            // non-interactive until the selection is cleared.
            const dimmed = !!selected && selected !== c.key
            return (
              <button
                key={c.key}
                ref={(el) => {
                  if (el) cellEls.current.set(c.key, el)
                  else cellEls.current.delete(c.key)
                }}
                type="button"
                className={`cell cell-${c.kind} ${c.life?.isExhausted ? 'is-exhausted' : ''} ${frozen ? 'is-frozen' : ''} ${selected === c.key ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
                style={style}
                onClick={() => {
                  if (!selected || selected === c.key) onSelect(c.target)
                }}
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
                  (c.kind === 'order'
                    ? ` · ${t.lmRentalDays.replace('{days}', String(c.rentalDays ?? '—'))} · ${t.lmDwell} ${Math.round(c.dwellH)}h`
                    : ` · ${t.lmRemaining} ${c.life ? c.life.pct : 0}%`)
                }
              >
                {c.kind === 'match' && (
                  <svg className="cell-gauge" viewBox="0 0 100 100" aria-hidden>
                    <circle className="cell-gauge-track" cx="50" cy="50" r="46" />
                    {gauge > 0 && <circle className="cell-gauge-arc" cx="50" cy="50" r="46" />}
                  </svg>
                )}
                <span className="cell-core">
                  {c.kind === 'order' ? (
                    <>
                      <span className="cell-label">{t.lmInboundDemand}</span>
                      <span className="cell-hero">
                        {formatCompact(c.capacityCkb)} <small>CKB</small>
                      </span>
                      {/* Dwell note only once the disc has aged past fresh (72h —
                          the same threshold that turns the tier amber/yellow). */}
                      {c.dwellH > 72 && (
                        <span className="cell-footer cell-dwell">
                          ({t.lmDwell} {Math.round(c.dwellH)}h)
                        </span>
                      )}
                    </>
                  ) : c.life?.isExhausted ? (
                    <>
                      <span className="cell-spent">{t.lmSpent}</span>
                      <span className="cell-footer">
                        {t.matchCapacity} {formatCompact(c.capacityCkb)}
                      </span>
                      <span className="cell-footer">
                        {t.lmApyLabel} {formatApyShort(c.apyBps)}%
                      </span>
                    </>
                  ) : c.life ? (
                    <>
                      <span className="cell-label">{t.lmRemaining}</span>
                      <span className="cell-hero">
                        {c.life.pct}
                        <small>%</small>
                      </span>
                      <span className="cell-footer">
                        {t.matchCapacity} {formatCompact(c.capacityCkb)}
                      </span>
                      <span className="cell-footer">
                        {t.lmApyLabel} {formatApyShort(c.apyBps)}%
                      </span>
                    </>
                  ) : null}
                </span>
                {c.kind === 'order' && (
                  <span className="cell-rental-badge">
                    {t.lmRentalTerm} {t.lmRentalDaysShort.replace('{days}', String(c.rentalDays ?? '—'))}
                  </span>
                )}
                {c.kind === 'order' && (
                  <span className="cell-apy-badge">
                    {t.lmApyLabel} {formatApyShort(c.apyBps)}%
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <OverviewChart orders={orders} matches={matches} mode={mode} hoverKey={hovered?.key ?? null} />
      </div>

      {tooltip && (
        <div
          className={`lm-tooltip ${tooltip.below ? 'is-below' : ''}`}
          role="tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.data.kind === 'order' ? (
            <OrderTooltipContent order={tooltip.data.target.item as LiquidityOrder} sharePct={hoveredOrderShare} />
          ) : (
            <MatchTooltipContent match={tooltip.data.target.item as LiquidityMatch} />
          )}
        </div>
      )}
    </>
  )
}
