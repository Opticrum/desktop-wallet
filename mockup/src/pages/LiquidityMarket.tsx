import { useMemo, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { useNode } from '../node/NodeContext'
import {
  computeInboundSummary,
  connectionPresets,
  mockDashboardData,
  mockMyMatches,
  mockMyOrders,
  shannonsPerBlockToApyBps,
  type BuyOrder,
  type MatchHealth,
  type MyMatch,
} from '../mock/liquidity'
import { ConfirmModal } from '../components/ConfirmModal'
import { Toast } from '../components/Toast'

// ── Helpers ───────────────────────────────────────────────────────────────

function truncateOutpoint(outpoint: string): string {
  return outpoint.slice(0, 10) + '…' + outpoint.slice(-6)
}

function formatCkb(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatBps(bps: number): string {
  return (bps / 100).toFixed(2) + '% APY'
}

function formatTimestamp(iso: string): string {
  // '2026-08-03T10:14:52+08:00' → '08-03 10:14'
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`
}

function randomTxid(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Badges ────────────────────────────────────────────────────────────────

function MatchHealthBadge({ health }: { health: MatchHealth }) {
  const { t } = useLocale()
  const labelMap: Record<MatchHealth, string> = {
    Healthy: t.healthHealthy,
    Warning: t.healthWarning,
    Critical: t.healthCritical,
    Exhausted: t.healthExhausted,
  }
  return (
    <span className={`badge health-${health.toLowerCase()}`}>{labelMap[health]}</span>
  )
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
      status: 'open',
      createdAt: new Date().toISOString(),
    })
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
              {t.lmEstimatedApy}：<strong>{formatBps(apyBps)}</strong>
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
            质押：{formatCkb(match.depositCkb)} {t.unitCkb}
            {mode === 'withdraw' && ` · 可抽离：${formatCkb(match.withdrawableCkb)} ${t.unitCkb}`}
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

  const [orders, setOrders] = useState<BuyOrder[]>(mockMyOrders)
  const [matches, setMatches] = useState<MyMatch[]>(mockMyMatches)
  const [toast, setToast] = useState<string | null>(null)
  const [listTab, setListTab] = useState<'orders' | 'matches'>('orders')

  const [buyOpen, setBuyOpen] = useState(false)
  const [adjust, setAdjust] = useState<{ match: MyMatch; mode: AdjustMode } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<BuyOrder | null>(null)
  const [extractTarget, setExtractTarget] = useState<MyMatch | null>(null)

  const summary = useMemo(() => computeInboundSummary(matches), [matches])
  const preset = connectionPresets[chain]

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
    setToast(t.lmExtractDeleted.replace('{amount}', formatCkb(returned)))
  }

  return (
    <div className="page-wide">
      <div className="lm-layout">
        {/* ── Left main: my liquidity ─────────────────────────────────── */}
        <div className="lm-main">
          {/* Inbound liquidity hero */}
          <section className="panel lm-hero">
            <div className="lm-hero-head">
              <div>
                <div className="lm-hero-title">{t.lmInboundLiquidity}</div>
                <div className="lm-hero-desc">{t.lmInboundDesc}</div>
              </div>
              <button type="button" className="btn-primary" onClick={() => setBuyOpen(true)}>
                + {t.lmBuyLiquidity}
              </button>
            </div>
            <div className="lm-hero-body">
              <div className="lm-hero-primary">
                <span className="lm-hero-value">{formatCkb(summary.totalInboundCkb)}</span>
                <span className="lm-hero-unit">{t.unitCkb}</span>
              </div>
              <div className="lm-hero-metrics">
                <div className="lm-hero-metric">
                  <span className="stat-label">{t.lmActiveMatches}</span>
                  <span className="lm-hero-metric-value">{summary.activeMatches}</span>
                </div>
                <div className="lm-hero-metric">
                  <span className="stat-label">{t.lmTotalDeposit}</span>
                  <span className="lm-hero-metric-value">{formatCkb(summary.totalDepositCkb)} {t.unitCkb}</span>
                </div>
                <div className="lm-hero-metric">
                  <span className="stat-label">{t.lmAvgRate}</span>
                  <span className="lm-hero-metric-value">{formatBps(summary.avgRateBps)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* My purchase orders / matched liquidity — tabbed lists */}
          <section className="panel panel-flush">
            <div className="lm-tabs" role="tablist" aria-label={t.liquidityMarket}>
              <button
                type="button"
                role="tab"
                aria-selected={listTab === 'orders'}
                className={listTab === 'orders' ? 'lm-tab is-active' : 'lm-tab'}
                onClick={() => setListTab('orders')}
              >
                {t.lmMyOrders}
                <span className="lm-tab-count">{orders.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={listTab === 'matches'}
                className={listTab === 'matches' ? 'lm-tab is-active' : 'lm-tab'}
                onClick={() => setListTab('matches')}
              >
                {t.lmMyMatches}
                <span className="lm-tab-count">{matches.length}</span>
              </button>
            </div>

            {listTab === 'orders' ? (
              <table className="data-table lm-table">
                <colgroup>
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '19%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '17%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>{t.lmOrderOutpoint}</th>
                    <th className="num">{t.matchCapacity}</th>
                    <th className="num">{t.matchRate}</th>
                    <th className="num">{t.lmDeposit}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.outpoint}>
                      <td>
                        <div className="lm-cell-main mono" title={o.outpoint}>
                          {truncateOutpoint(o.outpoint)}
                        </div>
                        <div className="lm-cell-sub">{formatTimestamp(o.createdAt)}</div>
                      </td>
                      <td className="num">
                        {formatCkb(o.channelCapacityCkb)} <span className="lm-unit">{t.unitCkb}</span>
                      </td>
                      <td className="num">
                        <div className="lm-cell-main">{formatBps(o.annualYieldBps)}</div>
                        <div className="lm-cell-sub">
                          {o.shannonsPerBlock.toLocaleString()} {t.shannonsPerBlock}
                        </div>
                      </td>
                      <td className="num">
                        {formatCkb(o.depositCkb)} <span className="lm-unit">{t.unitCkb}</span>
                      </td>
                      <td className="lm-row-actions">
                        {o.status === 'open' && (
                          <button type="button" className="lm-link-btn" onClick={() => setCancelTarget(o)}>
                            {t.lmCancelOrder}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="data-table lm-table">
                <colgroup>
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>{t.matchOutpoint}</th>
                    <th className="num">{t.matchCapacity}</th>
                    <th className="num">{t.lmDeposit}</th>
                    <th className="num">{t.matchRate}</th>
                    <th>{t.matchHealth}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.outpoint}>
                      <td>
                        <div className="lm-cell-main mono" title={m.channelOutpoint}>
                          {truncateOutpoint(m.channelOutpoint)}
                        </div>
                        <div className="lm-cell-sub">{formatTimestamp(m.createdAt)}</div>
                      </td>
                      <td className="num">
                        {m.isExhausted ? (
                          <span className="text-secondary">—</span>
                        ) : (
                          <>
                            {formatCkb(m.channelCapacityCkb)} <span className="lm-unit">{t.unitCkb}</span>
                          </>
                        )}
                      </td>
                      <td className="num">
                        <div className="lm-cell-main">{formatCkb(m.depositCkb)}</div>
                        <div className="lm-cell-sub">
                          {t.lmWithdrawable} {formatCkb(m.withdrawableCkb)}
                        </div>
                      </td>
                      <td className="num">
                        <div className="lm-cell-main">{formatBps(m.annualYieldBps)}</div>
                        <div className="lm-cell-sub">
                          {m.shannonsPerBlock.toLocaleString()} {t.shannonsPerBlock}
                        </div>
                      </td>
                      <td>
                        <MatchHealthBadge health={m.health} />
                      </td>
                      <td className="lm-row-actions">
                        {m.isExhausted ? (
                          <button type="button" className="lm-danger-btn" onClick={() => setExtractTarget(m)}>
                            {t.lmExtractDelete}
                          </button>
                        ) : (
                          <>
                            <button type="button" className="lm-action-btn" onClick={() => setAdjust({ match: m, mode: 'inject' })}>
                              {t.lmInject}
                            </button>
                            <button type="button" className="lm-action-btn" onClick={() => setAdjust({ match: m, mode: 'withdraw' })}>
                              {t.lmWithdraw}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        {/* ── Right aside: network (read-only) + market overview ───────── */}
        <div className="lm-aside">
          {/* Network — driven by the node's config */}
          <section className="panel lm-network-panel">
            <h3 className="section-label">{t.networkLabel}</h3>
            <div className="lm-net-row">
              <span className="lm-net-label">{t.lmFollowsNode}</span>
              <span className={`lm-net-badge net-${chain}`}>
                {chain === 'mainnet' ? t.networkMainnet : t.networkTestnet}
              </span>
            </div>
            <div className="lm-net-row">
              <span className="lm-net-label">{t.rpcUrlLabel}</span>
              <span className="lm-net-url mono">{preset.rpcUrl}</span>
            </div>
            <div className="lm-net-row">
              <span className="lm-net-label">{t.indexerUrlLabel}</span>
              <span className="lm-net-url mono">{preset.indexerUrl}</span>
            </div>
          </section>

          {/* Yield distribution */}
          <section className="panel lm-yield-section">
            <h3 className="section-label">{t.yieldDistribution}</h3>
            <div className="lm-yield-bars">
              {mockDashboardData.yield_distribution.map((bucket) => {
                const pct =
                  mockDashboardData.total_orders > 0
                    ? (bucket.order_count / mockDashboardData.total_orders) * 100
                    : 0
                return (
                  <div className="lm-yield-bar-row" key={bucket.range_label}>
                    <span className="lm-yield-bar-label">{bucket.range_label}</span>
                    <div className="lm-yield-bar-track">
                      <div className="lm-yield-bar-fill" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className="lm-yield-bar-count">{bucket.order_count}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
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
