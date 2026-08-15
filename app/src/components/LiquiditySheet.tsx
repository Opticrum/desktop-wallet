import { useEffect, useRef, type CSSProperties } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { CopyableText } from './CopyableText'
import { MatchHealthBadge } from './MatchHealthBadge'
import {
  daysLeft,
  dwellHours,
  dwellTierColor,
  formatApyShort,
  formatBps,
  formatCkb,
  formatCkbPerBlock,
  formatTimestamp,
  lifeColor,
  lifeTierColor,
  matchLife,
  rentalDaysForMatch,
  truncateOutpointNoIndex,
  type LiquidityMatch,
  type LiquidityOrder,
  type SheetTarget,
} from '../lib/liquidity'

export type { SheetTarget } from '../lib/liquidity'

type LiquiditySheetProps = {
  target: SheetTarget | null
  orders: LiquidityOrder[]
  matches: LiquidityMatch[]
  onClose: () => void
  onCancelOrder: (o: LiquidityOrder) => void
  onInject: (m: LiquidityMatch) => void
  onWithdraw: (m: LiquidityMatch) => void
  onExtract: (m: LiquidityMatch) => void
}

export function LiquiditySheet({
  target,
  orders,
  matches,
  onClose,
  onCancelOrder,
  onInject,
  onWithdraw,
  onExtract,
}: LiquiditySheetProps) {
  const { t } = useLocale()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [target, onClose])

  if (!target) return null

  // ── Order sheet ──────────────────────────────────────────────────────────
  if (target.kind === 'order') {
    // Resolve to the live record so the sheet reflects cancel/adjust state.
    const order = orders.find((o) => o.outpoint === target.item.outpoint) ?? target.item
    const dwellH = dwellHours(order.createdAtMs ?? 0)
    // The sheet takes its accent from the order's dwell freshness tier, tying
    // it to the cell it was opened from.
    const tier = dwellTierColor(dwellH)
    return (
      <div className="lm-drawer lm-drawer-order" aria-label={t.mgDetails} style={{ '--tier': tier } as CSSProperties}>
        <div className="section-head lm-drawer-head">
          <button ref={closeRef} type="button" className="lm-drawer-back" aria-label={t.lmBack} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <span className="lm-drawer-status">
            {order.status === 'cancelled' ? (
              <span className="mg-pill muted">{t.lmStatusCancelled}</span>
            ) : (
              <span className="mg-pill wait">
                <i className="mg-dot" />
                {t.meAwaitingMatch}
              </span>
            )}
          </span>
        </div>

        <div className="lm-dash-figure lm-drawer-figure">
          <span className="stat-label">{t.lmInboundDemand}</span>
          <div className="lm-drawer-value">
            {formatCkb(order.channelCapacityCkb)} <span className="lm-dash-unit">{t.unitCkb}</span>
          </div>
        </div>

        {/* APY / rent flow / rent / rental term — 2×2 kpi grid, each with a unit. */}
        <div className="kpi-grid kpi-grid-2 lm-drawer-kpis">
          <div className="kpi lm-drawer-kpi">
            <div className="kpi-label">{t.lmApyLabel}</div>
            <div className="kpi-value">{formatApyShort(order.annualYieldBps)}</div>
            <div className="kpi-sub">%</div>
          </div>
          <div className="kpi lm-drawer-kpi">
            <div className="kpi-label">{t.lmRentFlow}</div>
            <div className="kpi-value">{formatCkbPerBlock(order.shannonsPerBlock)}</div>
            <div className="kpi-sub">{t.lmCkbPerBlock}</div>
          </div>
          <div className="kpi lm-drawer-kpi">
            <div className="kpi-label">{t.lmRent}</div>
            <div className="kpi-value">{formatCkb(order.depositCkb)}</div>
            <div className="kpi-sub">{t.unitCkb}</div>
          </div>
          <div className="kpi lm-drawer-kpi">
            <div className="kpi-label">{t.lmRentalTerm}</div>
            <div className="kpi-value">{order.rentalDays ?? '—'}</div>
            <div className="kpi-sub">{t.lmDaysUnit}</div>
          </div>
        </div>

        <div className="lm-drawer-details">
          <div className="ms-detail">
            <span className="ms-detail-label">{t.mgOrderTx}</span>
            <CopyableText
              value={order.outpoint}
              display={truncateOutpointNoIndex(order.outpoint)}
              className="ms-detail-value mono lm-drawer-tx"
              iconPosition="leading"
            />
          </div>
          <div className="ms-detail">
            <span className="ms-detail-label">{t.lmDwellSince}</span>
            <span className="ms-detail-value ms-detail-dwell">
              {t.lmDwellHoursFull.replace('{hours}', String(Math.round(dwellH)))}
            </span>
          </div>
          <div className="ms-detail">
            <span className="ms-detail-label">{t.mgCreatedAt}</span>
            <span className="ms-detail-value">{formatTimestamp(order.createdAtMs ?? 0)}</span>
          </div>
        </div>

        <div className="lm-drawer-actions">
          {order.status === 'open' && (
            <button type="button" className="btn-danger lm-buy-btn" onClick={() => onCancelOrder(order)}>
              {t.lmRevokeOrder}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Match sheet ──────────────────────────────────────────────────────────
  // Resolve to the live record so the sheet reflects adjust/deposit state.
  const match = matches.find((m) => m.outpoint === target.item.outpoint) ?? target.item
  const life = matchLife(match)
  return (
    <div className="lm-drawer" aria-label={t.mgDetails} style={{ '--tier': lifeTierColor(life.pct) } as CSSProperties}>
      <div className="section-head lm-drawer-head">
        <button ref={closeRef} type="button" className="btn-icon lm-drawer-back" aria-label={t.lmBack} onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 2.5 4 7l5.5 4.5" />
          </svg>
        </button>
        <span className="lm-drawer-status">
          <MatchHealthBadge health={life.label} />
        </span>
      </div>

      <div className="lm-dash-figure lm-drawer-figure">
        <span className="stat-label">{t.lmRemainingRent}</span>
        <div className="lm-drawer-value">{life.isExhausted ? '0%' : `${life.pct}%`}</div>
      </div>

      <div className="kpi-grid kpi-grid-2 lm-drawer-kpis">
        <div className="kpi lm-drawer-kpi">
          <div className="kpi-label">{t.matchCapacity}</div>
          <div className="kpi-value">{formatCkb(match.channelCapacityCkb)}</div>
          <div className="kpi-sub">{t.unitCkb}</div>
        </div>
        <div className="kpi lm-drawer-kpi">
          <div className="kpi-label">{t.lmWithdrawable}</div>
          <div className="kpi-value">{formatCkb(match.withdrawableCkb)}</div>
          <div className="kpi-sub">{t.unitCkb}</div>
        </div>
      </div>

      <div className="lm-drawer-details">
        <div className="ms-detail">
          <span className="ms-detail-label">{t.mgChannelTx}</span>
          <CopyableText
            value={match.channelOutpoint}
            display={truncateOutpointNoIndex(match.channelOutpoint)}
            className="ms-detail-value mono lm-drawer-tx"
            iconPosition="leading"
          />
        </div>
        <div className="ms-detail">
          <span className="ms-detail-label">{t.mgMatchTx}</span>
          <CopyableText
            value={match.outpoint}
            display={truncateOutpointNoIndex(match.outpoint)}
            className="ms-detail-value mono lm-drawer-tx"
            iconPosition="leading"
          />
        </div>
        <div className="ms-detail">
          <span className="ms-detail-label">{t.matchRate}</span>
          <span className="ms-detail-value">
            {formatBps(match.annualYieldBps)} · {match.shannonsPerBlock.toLocaleString()} {t.shannonsPerBlock}
          </span>
        </div>
        <div className="ms-detail">
          <span className="ms-detail-label">{t.lmDeposit}</span>
          <span className="ms-detail-value">{formatCkb(match.depositCkb)} {t.unitCkb}</span>
        </div>
        <div className="ms-detail">
          <span className="ms-detail-label">{t.lmRentalTerm}</span>
          <span className="ms-detail-value">{t.lmRentalDays.replace('{days}', String(rentalDaysForMatch(match)))}</span>
        </div>
        <div className="ms-detail">
          <span className="ms-detail-label">{t.mgCreatedAt}</span>
          <span className="ms-detail-value">{formatTimestamp(match.createdAtMs)}</span>
        </div>
      </div>

      <div className="mg-life ms-life">
        <span className="mg-life-track">
          <span className="mg-life-fill" style={{ width: `${life.pct}%`, background: lifeColor(life.pct) }} />
        </span>
        <span className="mg-life-text">
          <span className="ms-life-remaining">
            {life.isExhausted ? t.healthExhausted : `${life.pct}% · ${t.mgRemainingDays.replace('{days}', String(daysLeft(match)))}`}
          </span>
          <span className="ms-life-expiry">{formatTimestamp(match.expiresAtMs)}</span>
        </span>
      </div>

      <div className="lm-drawer-actions">
        {life.isExhausted ? (
          <button type="button" className="btn-danger lm-buy-btn" onClick={() => onExtract(match)}>
            {t.lmExtractDelete}
          </button>
        ) : (
          <>
            <button type="button" className="btn-danger lm-buy-btn" onClick={() => onWithdraw(match)}>
              {t.lmWithdraw}
            </button>
            <button type="button" className="btn-primary lm-buy-btn" onClick={() => onInject(match)}>
              {t.lmInject}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
