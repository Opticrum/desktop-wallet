import { useEffect, useMemo, useRef } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { dwellHours, matchLife, rentalDaysForMatch, type BuyOrder, type MyMatch } from '../mock/liquidity'
import {
  MatchHealthBadge,
  daysLeft,
  formatBps,
  formatCkb,
  formatTimestamp,
  lifeColor,
  truncateOutpoint,
  type SheetTarget,
} from './LiquidityCellField'

export type { SheetTarget } from './LiquidityCellField'

type LiquiditySheetProps = {
  target: SheetTarget | null
  orders: BuyOrder[]
  matches: MyMatch[]
  onClose: () => void
  onSwitch: (t: SheetTarget) => void
  onCancelOrder: (o: BuyOrder) => void
  onInject: (m: MyMatch) => void
  onWithdraw: (m: MyMatch) => void
  onExtract: (m: MyMatch) => void
}

export function LiquiditySheet({
  target,
  orders,
  matches,
  onClose,
  onSwitch,
  onCancelOrder,
  onInject,
  onWithdraw,
  onExtract,
}: LiquiditySheetProps) {
  const { t } = useLocale()
  const closeRef = useRef<HTMLButtonElement>(null)

  const matchByOrder = useMemo(
    () => new Map(matches.map((m) => [m.channelOutpoint, m])),
    [matches],
  )
  const orderByOutpoint = useMemo(
    () => new Map(orders.map((o) => [o.outpoint, o])),
    [orders],
  )

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
    const linkedMatch = matchByOrder.get(order.outpoint) ?? null
    const linkedLife = linkedMatch ? matchLife(linkedMatch) : null
    const statusText =
      order.status === 'cancelled'
        ? t.lmStatusCancelled
        : order.status === 'matched'
          ? t.lmStatusMatched
          : t.meAwaitingMatch
    return (
      <div className="ms-backdrop" onClick={onClose} role="presentation">
        <div className="ms-sheet" role="dialog" aria-modal="true" aria-label={t.mgDetails} onClick={(e) => e.stopPropagation()}>
          <header className="ms-head">
            <span className="mg-tag mg-tag-order">{t.mgOrderTag}</span>
            {order.status === 'cancelled' ? (
              <span className="mg-pill muted">{t.lmStatusCancelled}</span>
            ) : order.status === 'matched' ? (
              <span className="mg-pill ok">{t.lmStatusMatched}</span>
            ) : (
              <span className="mg-pill wait">
                <i className="mg-dot" />
                {t.meAwaitingMatch}
              </span>
            )}
            <span className="ms-outpoint mono" title={order.outpoint}>
              {truncateOutpoint(order.outpoint)}
            </span>
            <button ref={closeRef} type="button" className="btn-icon ms-close" aria-label={t.close} onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          </header>

          <div className="ms-body">
            <div className="ms-detail">
              <span className="ms-detail-label">{t.mgOrderTx}</span>
              <span className="ms-detail-value mono">{order.outpoint}</span>
            </div>
            <div className="ms-detail">
              <span className="ms-detail-label">{t.mgStatus}</span>
              <span className="ms-detail-value">{statusText}</span>
            </div>
            <div className="ms-detail">
              <span className="ms-detail-label">{t.matchCapacity}</span>
              <span className="ms-detail-value">
                {formatCkb(order.channelCapacityCkb)} {t.unitCkb}
              </span>
            </div>
            <div className="ms-detail">
              <span className="ms-detail-label">{t.matchRate}</span>
              <span className="ms-detail-value">
                {formatBps(order.annualYieldBps)} · {order.shannonsPerBlock.toLocaleString()} {t.shannonsPerBlock}
              </span>
            </div>
            <div className="ms-detail">
              <span className="ms-detail-label">{t.lmDeposit}</span>
              <span className="ms-detail-value">
                {formatCkb(order.depositCkb)} {t.unitCkb}
              </span>
            </div>
            <div className="ms-detail">
              <span className="ms-detail-label">{t.lmRentalTerm}</span>
              <span className="ms-detail-value">
                {t.lmRentalDays.replace('{days}', String(order.rentalDays))}
              </span>
            </div>
            <div className="ms-detail">
              <span className="ms-detail-label">{t.lmDwellSince}</span>
              <span className="ms-detail-value">
                {t.lmDwellHoursFull.replace('{hours}', String(Math.round(dwellHours(order.createdAt))))}
              </span>
            </div>
            <div className="ms-detail">
              <span className="ms-detail-label">{t.mgCreatedAt}</span>
              <span className="ms-detail-value">{formatTimestamp(order.createdAt)}</span>
            </div>

            {linkedMatch && linkedLife && (
              <button type="button" className="ms-linked" onClick={() => onSwitch({ kind: 'match', item: linkedMatch })}>
                <span className="ms-linked-label">{t.mgLinkedMatch}</span>
                <span className="ms-linked-val">
                  {truncateOutpoint(linkedMatch.channelOutpoint)} · {formatBps(linkedMatch.annualYieldBps)}
                </span>
                <span className="mg-life mg-life-mini ms-linked-life">
                  <span className="mg-life-track">
                    <span className="mg-life-fill" style={{ width: `${linkedLife.pct}%`, background: lifeColor(linkedLife.pct) }} />
                  </span>
                </span>
              </button>
            )}
          </div>

          <footer className="ms-foot">
            {order.status === 'open' && (
              <button type="button" className="btn-secondary" onClick={() => onCancelOrder(order)}>
                {t.lmCancelOrder}
              </button>
            )}
          </footer>
        </div>
      </div>
    )
  }

  // ── Match sheet ──────────────────────────────────────────────────────────
  // Resolve to the live record so the sheet reflects adjust/deposit state.
  const match = matches.find((m) => m.outpoint === target.item.outpoint) ?? target.item
  const life = matchLife(match)
  const healthText =
    life.label === 'Healthy'
      ? t.healthHealthy
      : life.label === 'Warning'
        ? t.healthWarning
        : life.label === 'Critical'
          ? t.healthCritical
          : t.healthExhausted
  const linkedOrder = orderByOutpoint.get(match.channelOutpoint) ?? null
  return (
    <div className="ms-backdrop" onClick={onClose} role="presentation">
      <div className="ms-sheet" role="dialog" aria-modal="true" aria-label={t.mgDetails} onClick={(e) => e.stopPropagation()}>
        <header className="ms-head">
          <span className="mg-tag mg-tag-match">{t.mgMatchTag}</span>
          <MatchHealthBadge health={life.label} />
          <span className="ms-outpoint mono" title={match.channelOutpoint}>
            {truncateOutpoint(match.channelOutpoint)}
          </span>
          <button ref={closeRef} type="button" className="btn-icon ms-close" aria-label={t.close} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </header>

        <div className="ms-body">
          <div className="ms-detail">
            <span className="ms-detail-label">{t.mgChannelTx}</span>
            <span className="ms-detail-value mono">{match.channelOutpoint}</span>
          </div>
          <div className="ms-detail">
            <span className="ms-detail-label">{t.mgStatus}</span>
            <span className="ms-detail-value">{healthText}</span>
          </div>
          <div className="ms-detail">
            <span className="ms-detail-label">{t.matchCapacity}</span>
            <span className="ms-detail-value">
              {life.isExhausted ? '—' : `${formatCkb(match.channelCapacityCkb)} ${t.unitCkb}`}
            </span>
          </div>
          <div className="ms-detail">
            <span className="ms-detail-label">{t.matchRate}</span>
            <span className="ms-detail-value">
              {formatBps(match.annualYieldBps)} · {match.shannonsPerBlock.toLocaleString()} {t.shannonsPerBlock}
            </span>
          </div>
          <div className="ms-detail">
            <span className="ms-detail-label">{t.lmDeposit}</span>
            <span className="ms-detail-value">
              {formatCkb(match.depositCkb)} {t.unitCkb}
            </span>
          </div>
          <div className="ms-detail">
            <span className="ms-detail-label">{t.lmWithdrawable}</span>
            <span className="ms-detail-value">
              {formatCkb(match.withdrawableCkb)} {t.unitCkb}
            </span>
          </div>
          <div className="ms-detail">
            <span className="ms-detail-label">{t.lmRentalTerm}</span>
            <span className="ms-detail-value">
              {t.lmRentalDays.replace('{days}', String(rentalDaysForMatch(match)))}
            </span>
          </div>
          <div className="ms-detail">
            <span className="ms-detail-label">{t.mgExpiresAt}</span>
            <span className="ms-detail-value">
              {formatTimestamp(match.expiresAt)}
              {life.isExhausted
                ? ` · ${t.healthExhausted}`
                : ` · ${t.mgRemainingDays.replace('{days}', String(daysLeft(match)))}`}
            </span>
          </div>
          <div className="ms-detail">
            <span className="ms-detail-label">{t.mgCreatedAt}</span>
            <span className="ms-detail-value">{formatTimestamp(match.createdAt)}</span>
          </div>

          <div className="mg-life ms-life">
            <span className="mg-life-track">
              <span className="mg-life-fill" style={{ width: `${life.pct}%`, background: lifeColor(life.pct) }} />
            </span>
            <span className="mg-life-text">
              {life.isExhausted
                ? t.healthExhausted
                : `${life.pct}% · ${t.mgRemainingDays.replace('{days}', String(daysLeft(match)))}`}
            </span>
          </div>

          {linkedOrder && (
            <button type="button" className="ms-linked" onClick={() => onSwitch({ kind: 'order', item: linkedOrder })}>
              <span className="ms-linked-label">{t.mgLinkedOrder}</span>
              <span className="ms-linked-val">
                {truncateOutpoint(linkedOrder.outpoint)} · {formatBps(linkedOrder.annualYieldBps)}
              </span>
            </button>
          )}
        </div>

        <footer className="ms-foot">
          {life.isExhausted ? (
            <button type="button" className="btn-danger" onClick={() => onExtract(match)}>
              {t.lmExtractDelete}
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={() => onWithdraw(match)}>
                {t.lmWithdraw}
              </button>
              <button type="button" className="btn-primary" onClick={() => onInject(match)}>
                {t.lmInject}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
