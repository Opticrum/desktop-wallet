import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { useNode } from '../node/NodeContext'
import { liquidity } from '../api/client'
import { CkbTxModal, useCkbTx } from '../components/CkbTxModal'
import {
  computeInboundSummary,
  costAndDaysToRateShPerBlock,
  dwellHours,
  matchLife,
  shannonsPerBlockToApyBps,
  type LiquidityMatch,
  type LiquidityOrder,
  type SheetTarget,
} from '../lib/liquidity'
import { LiquidityCellField } from '../components/LiquidityCellField'
import { LiquiditySheet } from '../components/LiquiditySheet'
import { ConfirmModal } from '../components/ConfirmModal'
import { Toast } from '../components/Toast'

// ── Helpers ───────────────────────────────────────────────────────────────

function formatCkb(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/** Value-only APY (no unit suffix) — for labels that already carry a unit. */
function formatBpsValue(bps: number): string {
  return (bps / 100).toFixed(2) + '%'
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
}

/**
 * Buy-order form — asks for what the user wants (liquidity, total cost,
 * duration); the per-block rate and APY are derived from those and shown as
 * hints, so the user never has to reason about `sh/block` directly.
 */
function BuyOrderModal({ open, onClose, onPublish }: BuyOrderModalProps) {
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
            <input className="search-input mono" type="text" value={fiberAddress} onChange={(e) => setFiberAddress(e.target.value)} placeholder="/ip4/…/tcp/8228" spellCheck={false} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>{t.close}</button>
          <button className="btn-primary" disabled={!valid} onClick={handlePublish}>{t.lmPublishOrder}</button>
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
  onClose: () => void
  onConfirm: (match: LiquidityMatch, mode: AdjustMode, amount: number) => void
}

function AdjustDepositModal({ open, mode, match, onClose, onConfirm }: AdjustDepositModalProps) {
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
          <button className="btn-primary" disabled={!valid} onClick={handleConfirm}>
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
  const { chain } = useNode()

  const [orders, setOrders] = useState<LiquidityOrder[]>([])
  const [matches, setMatches] = useState<LiquidityMatch[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [active, setActive] = useState<SheetTarget | null>(null)
  const [poolTab, setPoolTab] = useState<'orders' | 'matches'>('orders')

  const [buyOpen, setBuyOpen] = useState(false)
  const [adjust, setAdjust] = useState<{ match: LiquidityMatch; mode: AdjustMode } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<LiquidityOrder | null>(null)
  const [extractTarget, setExtractTarget] = useState<LiquidityMatch | null>(null)

  const reload = useCallback(async () => {
    try {
      const [o, m] = await Promise.all([liquidity.getOrders(), liquidity.getMatches()])
      setOrders(o)
      setMatches(m)
    } catch {
      /* mock — best-effort */
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const summary = useMemo(() => computeInboundSummary(matches), [matches])

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

  // ── Aside — order demand vs matched capacity split ───────────────────────
  const orderDemandTotal = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.channelCapacityCkb, 0),
    [orders],
  )
  const matchCapTotal = useMemo(
    () => matches.reduce((s, m) => s + m.channelCapacityCkb, 0),
    [matches],
  )
  const splitPct =
    orderDemandTotal + matchCapTotal > 0 ? orderDemandTotal / (orderDemandTotal + matchCapTotal) : 0.5

  // Every CKB tx write resolves only once confirmed on-chain; the modal walks
  // the user through the wait, prints the tx hash, and reloads when it lands.
  const { ckbTxState, runCkbTx, closeCkbTx } = useCkbTx(reload)

  const handlePublish = async (v: PublishValues) => {
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
    if (!cancelTarget) return
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
    if (!extractTarget) return
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
          />
        </div>

        {/* Right — market dashboard, or the selected cell's detail drawer */}
        <aside className="lm-aside">
          {active ? (
            <LiquiditySheet
              target={active}
              orders={orders}
              matches={matches}
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
            <div className="lm-dash-figure">
              <span className="stat-label">{t.lmInboundLiquidity}</span>
              <div className="lm-dash-value">
                {formatCkb(summary.totalInboundCkb)}
                <span className="lm-dash-unit">CKB</span>
              </div>
            </div>
            <div className="kpi-grid kpi-grid-2 conn-kpis lm-dash-kpis">
              <div className="kpi">
                <div className="kpi-label">{t.lmActiveMatches}</div>
                <div className="kpi-value">{summary.activeMatches}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">{t.lmTotalDeposit}</div>
                <div className="kpi-value">{formatCkb(summary.totalDepositCkb)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">{t.lmAvgRate}</div>
                <div className="kpi-value">{formatBpsValue(summary.avgRateBps)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">{t.lmPendingOrders}</div>
                <div className="kpi-value">{orderStats.pending}</div>
              </div>
            </div>
            <button type="button" className="btn-primary lm-buy-btn" onClick={() => setBuyOpen(true)}>
              + {t.lmBuyLiquidity}
            </button>
          </section>

          <section className="panel lm-split">
            <div className="section-head">
              <h2 className="lm-title">{t.lmOrderMatchSplit}</h2>
            </div>
            <div className="lm-split-row">
              <span className="lm-split-label">{t.lmOrderDemand}</span>
              <span className="lm-split-track">
                <span className="lm-split-fill is-order" style={{ width: `${splitPct * 100}%` }} />
              </span>
              <span className="lm-split-val">{formatCkb(orderDemandTotal)}</span>
            </div>
            <div className="lm-split-row">
              <span className="lm-split-label">{t.lmMatchCapacity}</span>
              <span className="lm-split-track">
                <span className="lm-split-fill is-match" style={{ width: `${(1 - splitPct) * 100}%` }} />
              </span>
              <span className="lm-split-val">{formatCkb(matchCapTotal)}</span>
            </div>
          </section>
            </>
          )}
        </aside>
      </div>

      <BuyOrderModal open={buyOpen} onClose={() => setBuyOpen(false)} onPublish={handlePublish} />
      <AdjustDepositModal
        open={adjust !== null}
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
