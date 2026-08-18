import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { useNode } from '../node/NodeContext'
import { liquidity, wallet } from '../api/client'
import { CkbTxModal, useCkbTx } from '../components/CkbTxModal'
import {
  costAndDaysToRateShPerBlock,
  dwellHours,
  formatCkb,
  formatYieldRange,
  mapDashboardData,
  matchLife,
  shannonsPerBlockToApyBps,
  type LiquidityMatch,
  type LiquidityOrder,
  type MappedDashboard,
  type SheetTarget,
} from '../lib/liquidity'
import { LiquidityCellField } from '../components/LiquidityCellField'
import { LiquiditySheet } from '../components/LiquiditySheet'
import { ConfirmModal } from '../components/ConfirmModal'
import { Toast } from '../components/Toast'

// ── Helpers ───────────────────────────────────────────────────────────────

/** Value-only APY (no unit suffix) — for labels that already carry a unit. */
function formatBpsValue(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
}

/** Bare APY number — the `%` unit rides in the tile's `.kpi-sub`. */
function formatBpsNum(bps: number): string {
  return (bps / 100).toFixed(2)
}

// ── Buy order modal ───────────────────────────────────────────────────────

type PublishValues = {
  capacityCkb: number
  shannonsPerBlock: number
  depositCkb: number
  rentalDays: number
  fiberAddress: string
}

type BuyOrderModalProps = {
  open: boolean
  onClose: () => void
  onPublish: (values: PublishValues) => void
  /** Node is down/starting — publishing is inert. */
  disabled?: boolean
}

/**
 * Buy-order form — asks for what the user wants (liquidity, total cost,
 * duration); the per-block rate and APY are derived from those and shown as
 * hints, so the user never has to reason about `sh/block` directly.
 */
function BuyOrderModal({ open, onClose, onPublish, disabled }: BuyOrderModalProps) {
  const { t } = useLocale()
  const [capacity, setCapacity] = useState('25,000')
  const [cost, setCost] = useState('250')
  const [days, setDays] = useState('30')
  const [fiberAddress, setFiberAddress] = useState('')

  if (!open) return null

  const capacityNum = Number(capacity.replace(/,/g, '')) || 0
  const costNum = Number(cost.replace(/,/g, '')) || 0
  const daysNum = Math.round(Number(days.replace(/,/g, '')) || 0)
  const valid = capacityNum > 0 && costNum > 0 && daysNum > 0
  // Total cost spread evenly across the requested duration.
  const shannonsPerBlock = costAndDaysToRateShPerBlock(costNum, daysNum)
  const apyBps = shannonsPerBlockToApyBps(shannonsPerBlock, capacityNum)

  const handlePublish = () => {
    if (!valid) return
    onPublish({
      capacityCkb: capacityNum,
      shannonsPerBlock,
      depositCkb: costNum,
      rentalDays: daysNum,
      fiberAddress,
    })
    // Reset so the next "New buy order" opens with the defaults.
    setCapacity('25,000')
    setCost('250')
    setDays('30')
    setFiberAddress('')
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={t.lmNewOrder} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t.lmNewOrder}</div>
        <div className="modal-body">
          <div className="lm-form-field">
            <label>{t.lmLiquidity}</label>
            <input className="search-input" type="text" inputMode="decimal" value={capacity} onChange={(e) => setCapacity(e.target.value)} spellCheck={false} />
          </div>
          <div className="lm-form-field">
            <label>{t.lmCost}</label>
            <input className="search-input" type="text" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} spellCheck={false} />
          </div>
          <div className="lm-form-field">
            <label>{t.lmDays}</label>
            <input className="search-input" type="text" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} spellCheck={false} />
          </div>

          {valid && (
            <div className="lm-derive">
              <span className="lm-derive-item">
                {t.lmRateShPerBlock} ≈ <strong>{shannonsPerBlock.toLocaleString()}</strong>
              </span>
              <span className="lm-derive-sep" aria-hidden="true" />
              <span className="lm-derive-item">
                {t.lmEstimatedApy} ≈ <strong>{formatBpsValue(apyBps)}</strong>
              </span>
            </div>
          )}

          <div className="lm-form-field">
            <label>{t.lmFiberAddressOptional}</label>
            <input className="search-input mono lm-fiber-address" type="text" value={fiberAddress} onChange={(e) => setFiberAddress(e.target.value)} placeholder="/ip4/…/tcp/8228" spellCheck={false} />
            {fiberAddress.trim() === '' && (
              <div className="lm-fiber-risk" role="note">
                <svg
                  className="lm-fiber-risk-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="lm-fiber-risk-text">
                  <div className="lm-fiber-risk-title">{t.lmFiberRiskTitle}</div>
                  <div className="lm-fiber-risk-body">{t.lmFiberRiskBody}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>{t.close}</button>
          <button
            className="btn-primary"
            disabled={!valid || disabled}
            title={disabled ? t.nodeNotRunning : undefined}
            onClick={handlePublish}
          >
            {t.lmPublishOrder}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Adjust deposit modal (inject / withdraw) ──────────────────────────────

type AdjustMode = 'inject' | 'withdraw'

type AdjustDepositModalProps = {
  open: boolean
  mode: AdjustMode
  match: LiquidityMatch | null
  /** Node is down/starting — 出入金 is inert. */
  disabled?: boolean
  onClose: () => void
  onConfirm: (match: LiquidityMatch, mode: AdjustMode, amount: number) => void
}

function AdjustDepositModal({ open, mode, match, disabled, onClose, onConfirm }: AdjustDepositModalProps) {
  const { t } = useLocale()
  const [amount, setAmount] = useState('')

  if (!open || !match) return null

  const amountNum = Number(amount.replace(/,/g, '')) || 0
  const cap = mode === 'withdraw' ? match.withdrawableCkb : Number.POSITIVE_INFINITY
  const valid = amountNum > 0 && amountNum <= cap

  const handleConfirm = () => {
    if (!valid) return
    onConfirm(match, mode, amountNum)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={t.lmAdjustTitle} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          {t.lmAdjustTitle} · {mode === 'inject' ? t.lmInject : t.lmWithdraw}
        </div>
        <div className="modal-body">
          <div className="lm-form-field">
            <label>{t.lmAdjustAmount}</label>
            <input className="search-input" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} spellCheck={false} autoFocus />
          </div>
          <div className="lm-form-hint">
            {t.lmStakedHint.replace('{amount}', formatCkb(match.depositCkb))}
            {mode === 'withdraw' && ` · ${t.lmWithdrawableHint.replace('{amount}', formatCkb(match.withdrawableCkb))}`}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>{t.close}</button>
          <button
            className="btn-primary"
            disabled={!valid || disabled}
            title={disabled ? t.nodeNotRunning : undefined}
            onClick={handleConfirm}
          >
            {mode === 'inject' ? t.lmInject : t.lmWithdraw}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export function LiquidityMarket() {
  const { t } = useLocale()
  const { chain, running, starting } = useNode()

  // Every on-chain action (发布/撤销/注入/抽离/提取) needs the node up.
  const nodeReady = running && !starting

  // Wallet lock gates the market — a locked wallet can't place trades, so the
  // cell pool freezes and shows an unlock hint.
  const [walletLocked, setWalletLocked] = useState(false)
  useEffect(() => {
    let alive = true
    const poll = () =>
      wallet
        .getSummary()
        .then((s) => {
          if (alive) setWalletLocked(!s.unlocked)
        })
        .catch(() => {})
    poll()
    const id = window.setInterval(poll, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const [orders, setOrders] = useState<LiquidityOrder[]>([])
  const [matches, setMatches] = useState<LiquidityMatch[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [active, setActive] = useState<SheetTarget | null>(null)
  const [poolTab, setPoolTab] = useState<'orders' | 'matches'>('orders')

  const [buyOpen, setBuyOpen] = useState(false)
  const [adjust, setAdjust] = useState<{ match: LiquidityMatch; mode: AdjustMode } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<LiquidityOrder | null>(null)
  const [extractTarget, setExtractTarget] = useState<LiquidityMatch | null>(null)
  // Global whole-chain market overview — `null` until the first load; a loaded
  // all-zero value (node offline) still renders real numbers.
  const [dashboard, setDashboard] = useState<MappedDashboard | null>(null)

  const reload = useCallback(async () => {
    try {
      const [o, m, d] = await Promise.all([
        liquidity.getOrders(),
        liquidity.getMatches(),
        // Whole-chain scan — best-effort so a scan failure can't sink the
        // personal orders/matches update.
        liquidity.getDashboard().catch(() => null),
      ])
      setOrders(o)
      setMatches(m)
      if (d) setDashboard(mapDashboardData(d))
    } catch {
      /* mock — best-effort */
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // On the lock→unlock transition, re-fetch — while locked the backend returns
  // no orders, so fresh data arrives once the wallet can filter again.
  const prevLockedRef = useRef(false)
  useEffect(() => {
    const wasLocked = prevLockedRef.current
    prevLockedRef.current = walletLocked
    if (wasLocked && !walletLocked) reload()
  }, [walletLocked, reload])

  // Manual refresh — the only time personal orders are re-scanned from the chain
  // (normal loads read the local cache).
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const [o, m, d] = await Promise.all([
        liquidity.refreshOrders(),
        liquidity.getMatches(),
        liquidity.getDashboard().catch(() => null),
      ])
      setOrders(o)
      setMatches(m)
      if (d) setDashboard(mapDashboardData(d))
    } catch {
      /* mock — best-effort */
    } finally {
      setRefreshing(false)
    }
  }

  // Manual refresh — re-scans personal orders from the chain (normal loads read
  // the local cache). Rendered by the cell pool at its top-left.
  const refreshButton = (
    <button
      type="button"
      className="lm-refresh-btn"
      onClick={handleRefresh}
      disabled={refreshing}
      aria-label={t.nodeRefresh}
      title={t.nodeRefresh}
    >
      <svg
        className={refreshing ? 'spin' : ''}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
      </svg>
    </button>
  )

  // ── Strip dashboard — per-tab KPIs ────────────────────────────────────────
  const orderStats = useMemo(() => {
    const open = orders.filter((o) => o.status !== 'cancelled')
    const totalDemand = open.reduce((s, o) => s + o.channelCapacityCkb, 0)
    const avgApy = open.length
      ? Math.round(open.reduce((s, o) => s + o.annualYieldBps, 0) / open.length)
      : 0
    const avgDwell = open.length
      ? open.reduce((s, o) => s + dwellHours(o.createdAtMs ?? 0), 0) / open.length
      : 0
    return { totalDemand, avgApy, pending: open.length, avgDwell }
  }, [orders])

  const matchStats = useMemo(() => {
    const active = matches.filter((m) => !matchLife(m).isExhausted)
    const totalDeposit = matches.reduce((s, m) => s + m.depositCkb, 0)
    const avgRate = active.length
      ? Math.round(active.reduce((s, m) => s + m.annualYieldBps, 0) / active.length)
      : 0
    const avgRemaining = matches.length
      ? Math.round(matches.reduce((s, m) => s + matchLife(m).pct, 0) / matches.length)
      : 0
    return { active: active.length, totalDeposit, avgRate, avgRemaining }
  }, [matches])

  // Every CKB tx write resolves only once confirmed on-chain; the modal walks
  // the user through the wait, prints the tx hash, and reloads when it lands.
  const { ckbTxState, runCkbTx, closeCkbTx } = useCkbTx(reload)

  const handlePublish = async (v: PublishValues) => {
    if (!nodeReady) return
    setBuyOpen(false)
    await runCkbTx(t.lmPublishOrder, async () => {
      const res = await liquidity.publishOrder({
        capacityShannons: Math.round(v.capacityCkb * 1e8),
        shannonsPerBlock: v.shannonsPerBlock,
        rentCapacityShannons: Math.round(v.depositCkb * 1e8),
        rentalDays: v.rentalDays,
        fiberAddress: v.fiberAddress || undefined,
      })
      setToast(t.lmOrderPublished)
      return res
    })
  }

  const handleAdjust = async (match: LiquidityMatch, mode: AdjustMode, amount: number) => {
    if (!nodeReady) return
    setAdjust(null)
    const shannons = Math.round(amount * 1e8)
    await runCkbTx(t.lmAdjustTitle, async () => {
      const res =
        mode === 'inject'
          ? await liquidity.injectDeposit(match.outpoint, shannons)
          : await liquidity.withdrawDeposit(match.outpoint, shannons)
      // Optimistically apply the delta after confirmation.
      setMatches((prev) =>
        prev.map((m) => {
          if (m.outpoint !== match.outpoint) return m
          const delta = mode === 'inject' ? amount : -amount
          return {
            ...m,
            depositCkb: Math.max(0, m.depositCkb + delta),
            withdrawableCkb: Math.max(0, m.withdrawableCkb + delta),
          }
        }),
      )
      setToast(t.lmDepositAdjusted)
      return res
    })
  }

  const handleCancelOrder = async () => {
    if (!cancelTarget || !nodeReady) return
    const outpoint = cancelTarget.outpoint
    try {
      await runCkbTx(t.lmCancelOrderTitle, async () => {
        const res = await liquidity.cancelOrder(outpoint)
        setOrders((prev) =>
          prev.map((o) => (o.outpoint === outpoint ? { ...o, status: 'cancelled' as const } : o)),
        )
        setToast(t.lmOrderCancelled)
        return res
      })
    } finally {
      // Release the selection so the cell is de-highlighted, its persistent
      // tooltip closes, and every other cell becomes clickable again.
      setCancelTarget(null)
      setActive(null)
    }
  }

  const handleExtract = async () => {
    if (!extractTarget || !nodeReady) return
    const outpoint = extractTarget.outpoint
    let returned = extractTarget.depositCkb
    setExtractTarget(null)
    await runCkbTx(t.lmExtractDeleteTitle, async () => {
      const res = await liquidity.extractSpentMatch(outpoint)
      returned = res.returnedCkb
      setMatches((prev) => prev.filter((m) => m.outpoint !== outpoint))
      setActive((prev) => (prev?.kind === 'match' && prev.item.outpoint === outpoint ? null : prev))
      setToast(t.lmExtractDeleted.replace('{amount}', formatCkb(returned)))
      return res
    })
  }

  return (
    <div className="page-wide">
      <div className="lm-layout">
        {/* Left — top strip (per-tab dashboard) + floating cell pool */}
        <div className={`lm-main is-${poolTab}`}>
          <section className="lm-strip" aria-label={t.liquidityMarket}>
            <div className="lm-switch" role="tablist" aria-label={t.liquidityMarket}>
              <button
                type="button"
                id="pool-tab-orders"
                role="tab"
                aria-selected={poolTab === 'orders'}
                aria-controls="pool-panel"
                className={poolTab === 'orders' ? 'lm-switch-btn is-active' : 'lm-switch-btn'}
                onClick={() => {
                  setPoolTab('orders')
                  setActive(null)
                }}
              >
                {t.mgOrderTag}
                <span className="lm-switch-count">{orderStats.pending}</span>
              </button>
              <button
                type="button"
                id="pool-tab-matches"
                role="tab"
                aria-selected={poolTab === 'matches'}
                aria-controls="pool-panel"
                className={poolTab === 'matches' ? 'lm-switch-btn is-active' : 'lm-switch-btn'}
                onClick={() => {
                  setPoolTab('matches')
                  setActive(null)
                }}
              >
                {t.mgMatchTag}
                <span className="lm-switch-count">{matchStats.active}</span>
              </button>
            </div>

            <div className="lm-strip-kpis" key={poolTab}>
              {poolTab === 'orders' ? (
                <>
                  <div className="lm-kpi">
                    <span className="lm-kpi-label">{t.lmTotalDemand}</span>
                    <span className="lm-kpi-value">
                      {formatCkb(orderStats.totalDemand)} <small>CKB</small>
                    </span>
                  </div>
                  <div className="lm-kpi">
                    <span className="lm-kpi-label">{t.lmAvgApy}</span>
                    <span className="lm-kpi-value">{formatBpsValue(orderStats.avgApy)}</span>
                  </div>
                  <div className="lm-kpi">
                    <span className="lm-kpi-label">{t.lmPendingOrders}</span>
                    <span className="lm-kpi-value">{orderStats.pending}</span>
                  </div>
                  <div className="lm-kpi">
                    <span className="lm-kpi-label">{t.lmAvgDwell}</span>
                    <span className="lm-kpi-value">
                      {Math.round(orderStats.avgDwell)}<small>h</small>
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="lm-kpi">
                    <span className="lm-kpi-label">{t.lmActiveMatches}</span>
                    <span className="lm-kpi-value">{matchStats.active}</span>
                  </div>
                  <div className="lm-kpi">
                    <span className="lm-kpi-label">{t.lmTotalDeposit}</span>
                    <span className="lm-kpi-value">
                      {formatCkb(matchStats.totalDeposit)} <small>CKB</small>
                    </span>
                  </div>
                  <div className="lm-kpi">
                    <span className="lm-kpi-label">{t.lmAvgRate}</span>
                    <span className="lm-kpi-value">{formatBpsValue(matchStats.avgRate)}</span>
                  </div>
                  <div className="lm-kpi">
                    <span className="lm-kpi-label">{t.lmAvgRemaining}</span>
                    <span className="lm-kpi-value">{matchStats.avgRemaining}%</span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Square floating-cell pool */}
          <LiquidityCellField
            orders={orders}
            matches={matches}
            mode={poolTab}
            selected={active ? active.item.outpoint : null}
            onSelect={setActive}
            refreshButton={refreshButton}
            disabled={walletLocked}
          />
        </div>

        {/* Right — market dashboard, or the selected cell's detail drawer */}
        <aside className="lm-aside">
          {active ? (
            <LiquiditySheet
              target={active}
              orders={orders}
              matches={matches}
              disabled={!nodeReady}
              onClose={() => setActive(null)}
              onCancelOrder={setCancelTarget}
              onInject={(m) => setAdjust({ match: m, mode: 'inject' })}
              onWithdraw={(m) => setAdjust({ match: m, mode: 'withdraw' })}
              onExtract={setExtractTarget}
            />
          ) : (
            <>
          <section className="panel lm-dash">
            <div className="section-head">
              <h2 className="lm-title">{t.lmMarketOverview}</h2>
              <span className={`lm-net-badge net-${chain}`}>
                {chain === 'mainnet' ? t.networkMainnet : t.networkTestnet}
              </span>
            </div>

            {/* Hero — global order demand (whole-chain) */}
            <div className="lm-dash-figure">
              <span className="stat-label">{t.lmGlobalOrderDemand}</span>
              <div className="lm-dash-value">
                {dashboard ? formatCkb(dashboard.totalOrdersCapacityCkb) : '—'}
                <span className="lm-dash-unit">{t.unitCkb}</span>
              </div>
            </div>

            {/* 2×2 KPI grid — global chain-wide numbers */}
            <div className="kpi-grid kpi-grid-2 conn-kpis lm-dash-kpis">
              <div className="kpi">
                <div className="kpi-label">{t.lmTotalOrders}</div>
                <div className="kpi-value">{dashboard ? dashboard.totalOrders.toLocaleString() : '—'}</div>
                <div className="kpi-sub">{t.lmOrdersUnit}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">{t.lmLockedCapacity}</div>
                <div className="kpi-value">{dashboard ? formatCkb(dashboard.totalCapacityLockedCkb) : '—'}</div>
                <div className="kpi-sub">{t.unitCkb}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">{t.lmAvgApy}</div>
                <div className="kpi-value">{dashboard ? formatBpsNum(dashboard.avgAnnualYieldBps) : '—'}</div>
                <div className="kpi-sub">%</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">{t.lmAvgRate}</div>
                <div className="kpi-value">{dashboard ? dashboard.avgShannonsPerBlock.toLocaleString() : '—'}</div>
                <div className="kpi-sub">{t.shannonsPerBlock}</div>
              </div>
            </div>

            {/* Yield distribution mini histogram */}
            <div className="lm-yield">
              <div className="lm-yield-head">
                <span className="stat-label">{t.lmYieldDistribution}</span>
              </div>
              {dashboard?.hasYieldData ? (
                <div className="lm-yield-bars">
                  {dashboard.yieldBuckets.map((b) => (
                    <div
                      key={`${b.lowBps}-${b.highBps}`}
                      className="lm-yield-row"
                      title={`${formatYieldRange(b)} · ${b.count} ${t.mgOrderTag} · ${formatCkb(b.capacityCkb)} ${t.unitCkb}`}
                    >
                      <span className="lm-yield-row-label">{formatYieldRange(b)}</span>
                      <div className="lm-yield-track">
                        <div className="lm-yield-fill" style={{ width: `${Math.round(b.share * 100)}%` }} />
                      </div>
                      <span className="lm-yield-row-count">{b.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="lm-yield-empty">{t.lmNoYieldData}</div>
              )}
            </div>

            <button
              type="button"
              className="btn-primary lm-buy-btn"
              disabled={!nodeReady}
              title={nodeReady ? undefined : t.nodeNotRunning}
              onClick={() => setBuyOpen(true)}
            >
              + {t.lmBuyLiquidity}
            </button>
            {!nodeReady && <span className="lm-node-hint">{t.nodeNotRunning}</span>}
          </section>
            </>
          )}
        </aside>
      </div>

      <BuyOrderModal
        open={buyOpen}
        disabled={!nodeReady}
        onClose={() => setBuyOpen(false)}
        onPublish={handlePublish}
      />
      <AdjustDepositModal
        open={adjust !== null}
        disabled={!nodeReady}
        mode={adjust?.mode ?? 'inject'}
        match={adjust?.match ?? null}
        onClose={() => setAdjust(null)}
        onConfirm={handleAdjust}
      />
      <ConfirmModal
        open={cancelTarget !== null}
        title={t.lmCancelOrderTitle}
        body={t.lmCancelOrderBody}
        confirmLabel={t.lmCancelOrder}
        cancelLabel={t.nodeDeleteCancel}
        onCancel={() => setCancelTarget(null)}
        onConfirm={handleCancelOrder}
      />
      <ConfirmModal
        open={extractTarget !== null}
        title={t.lmExtractDeleteTitle}
        body={t.lmExtractDeleteBody}
        confirmLabel={t.lmExtractDelete}
        cancelLabel={t.nodeDeleteCancel}
        danger
        onCancel={() => setExtractTarget(null)}
        onConfirm={handleExtract}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
      <CkbTxModal state={ckbTxState} onClose={closeCkbTx} />
    </div>
  )
}
