import { useMemo, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import {
  computeInboundSummary,
  dwellHours,
  matchLife,
  mockMyMatches,
  mockMyOrders,
  shannonsPerBlockToApyBps,
  type BuyOrder,
  type MyMatch,
} from '../mock/liquidity'
import { LiquidityCellField, type SheetTarget } from '../components/LiquidityCellField'
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

function randomTxid(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Buy order modal ───────────────────────────────────────────────────────

type BuyOrderModalProps = {
  open: boolean
  onClose: () => void
  onPublish: (order: BuyOrder) => void
}

function BuyOrderModal({ open, onClose, onPublish }: BuyOrderModalProps) {
  const { t } = useLocale()
  const [capacity, setCapacity] = useState('25,000')
  const [rate, setRate] = useState('60,000')
  const [deposit, setDeposit] = useState('250')
  const [fiberAddress, setFiberAddress] = useState('')

  if (!open) return null

  const capacityNum = Number(capacity.replace(/,/g, '')) || 0
  const rateNum = Number(rate.replace(/,/g, '')) || 0
  const depositNum = Number(deposit.replace(/,/g, '')) || 0
  const valid = capacityNum > 0 && rateNum > 0 && depositNum > 0
  const apyBps = shannonsPerBlockToApyBps(rateNum, capacityNum)

  const handlePublish = () => {
    if (!valid) return
    onPublish({
      outpoint: `${randomTxid()}:0`,
      channelCapacityCkb: capacityNum,
      shannonsPerBlock: rateNum,
      annualYieldBps: apyBps,
      depositCkb: depositNum,
      rentalDays: 30,
      status: 'open',
      createdAt: new Date().toISOString(),
    })
    // Reset so the next "New buy order" opens with the defaults.
    setCapacity('25,000')
    setRate('60,000')
    setDeposit('250')
    setFiberAddress('')
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={t.lmNewOrder} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t.lmNewOrder}</div>
        <div className="modal-body">
          <div className="lm-form-field">
            <label>{t.lmChannelCapacity}</label>
            <input className="search-input" type="text" inputMode="decimal" value={capacity} onChange={(e) => setCapacity(e.target.value)} spellCheck={false} />
          </div>
          <div className="lm-form-field">
            <label>{t.lmRateShPerBlock}</label>
            <input className="search-input" type="text" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} spellCheck={false} />
            <div className="lm-form-hint">
              {t.lmEstimatedApy}{' '}
              <strong>{formatBpsValue(apyBps)}</strong>
            </div>
          </div>
          <div className="lm-form-field">
            <label>{t.lmDeposit}</label>
            <input className="search-input" type="text" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} spellCheck={false} />
          </div>
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
  match: MyMatch | null
  onClose: () => void
  onConfirm: (match: MyMatch, mode: AdjustMode, amount: number) => void
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

  const [orders, setOrders] = useState<BuyOrder[]>(mockMyOrders)
  const [matches, setMatches] = useState<MyMatch[]>(mockMyMatches)
  const [toast, setToast] = useState<string | null>(null)
  const [active, setActive] = useState<SheetTarget | null>(null)
  const [poolTab, setPoolTab] = useState<'orders' | 'matches'>('orders')

  const [buyOpen, setBuyOpen] = useState(false)
  const [adjust, setAdjust] = useState<{ match: MyMatch; mode: AdjustMode } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<BuyOrder | null>(null)
  const [extractTarget, setExtractTarget] = useState<MyMatch | null>(null)

  const summary = useMemo(() => computeInboundSummary(matches), [matches])

  // ── Strip dashboard — per-tab KPIs ────────────────────────────────────────
  const orderStats = useMemo(() => {
    const open = orders.filter((o) => o.status !== 'cancelled')
    const totalDemand = open.reduce((s, o) => s + o.channelCapacityCkb, 0)
    const avgApy = open.length
      ? Math.round(open.reduce((s, o) => s + o.annualYieldBps, 0) / open.length)
      : 0
    const avgDwell = open.length
      ? open.reduce((s, o) => s + dwellHours(o.createdAt), 0) / open.length
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

  const handlePublish = (order: BuyOrder) => {
    setOrders((prev) => [order, ...prev])
    setBuyOpen(false)
    setToast(t.lmOrderPublished)
  }

  const handleAdjust = (match: MyMatch, mode: AdjustMode, amount: number) => {
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
    setAdjust(null)
    setToast(t.lmDepositAdjusted)
  }

  const handleCancelOrder = () => {
    if (!cancelTarget) return
    setOrders((prev) =>
      prev.map((o) => (o.outpoint === cancelTarget.outpoint ? { ...o, status: 'cancelled' as const } : o)),
    )
    setCancelTarget(null)
    setToast(t.lmOrderCancelled)
  }

  const handleExtract = () => {
    if (!extractTarget) return
    const returned = extractTarget.depositCkb
    setMatches((prev) => prev.filter((m) => m.outpoint !== extractTarget.outpoint))
    setExtractTarget(null)
    setActive((prev) => (prev?.kind === 'match' && prev.item.outpoint === extractTarget.outpoint ? null : prev))
    setToast(t.lmExtractDeleted.replace('{amount}', formatCkb(returned)))
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
              <span className="lm-net-badge net-mainnet">{t.networkMainnet}</span>
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
    </div>
  )
}
