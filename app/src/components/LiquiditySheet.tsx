import { useEffect, useRef, type CSSProperties } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { CopyableText } from './CopyableText'
import { MatchHealthBadge } from './MatchHealthBadge'
import {
  daysLeft,
  dwellHours,
  dwellTierColor,
  extractionProgress,
  formatApyShort,
  formatBps,
  formatCkb,
  formatCkbPerBlock,
  formatDurationHm,
  formatTimestamp,
  hesitationRemainingMs,
  lifeColor,
  lifeTierColor,
  matchLife,
  matchPhase,
  rentalDaysForMatch,
  truncateOutpointNoIndex,
  truncatePubkey,
  type LiquidityMatch,
  type LiquidityOrder,
  type SheetTarget,
} from '../lib/liquidity'

export type { SheetTarget } from '../lib/liquidity'

type LiquiditySheetProps = {
  target: SheetTarget | null
  orders: LiquidityOrder[]
  matches: LiquidityMatch[]
  /** Node is down/starting — all on-chain actions are inert. */
  disabled?: boolean
  /** The current fiber node's identity pubkey — a cell whose embedded pubkey
   *  differs was created under an older/different node identity. */
  nodeFiberPubkey?: string
  onClose: () => void
  onCancelOrder: (o: LiquidityOrder) => void
  onInject: (m: LiquidityMatch) => void
  onExtract: (m: LiquidityMatch) => void
  /** Buyer abandons the order during the hesitation window (full rent dump). */
  onAbandon: (m: LiquidityMatch) => void
}

export function LiquiditySheet({
  target,
  orders,
  matches,
  disabled,
  nodeFiberPubkey,
  onClose,
  onCancelOrder,
  onInject,
  onExtract,
  onAbandon,
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
    // Created under an older/different node identity than the current one.
    const fiberKeyMismatch = !!nodeFiberPubkey && order.fiberPubkey !== nodeFiberPubkey
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
          <div className="ms-detail">
            <span className="ms-detail-label">{t.fiberPubkey}</span>
            <CopyableText
              value={order.fiberPubkey}
              display={truncatePubkey(order.fiberPubkey)}
              className="ms-detail-value mono lm-drawer-tx"
              iconPosition="leading"
            />
          </div>
        </div>

        {fiberKeyMismatch && (
          <div className="lm-fiber-risk" role="note">
            <svg className="lm-fiber-risk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="lm-fiber-risk-text">
              <div className="lm-fiber-risk-title">{t.lmPubkeyMismatchTitle}</div>
              <div className="lm-fiber-risk-body">{t.lmPubkeyMismatchBody}</div>
            </div>
          </div>
        )}

        <div className="lm-drawer-actions">
          {disabled && <span className="lm-node-hint">{t.nodeNotRunning}</span>}
          {order.status === 'open' && (
            <button
              type="button"
              className="btn-danger lm-buy-btn"
              disabled={disabled}
              title={disabled ? t.nodeNotRunning : undefined}
              onClick={() => onCancelOrder(order)}
            >
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
  const phase = matchPhase(match)
  const hesitating = phase === 'hesitating'
  const hesitationLeft = hesitationRemainingMs(match)
  const extraction = extractionProgress(match)
  // Time until the service term expires, localized — `12天 3小时` / `3小时 45分`
  // / `45分钟` (the hero's "距服务到期还剩" figure).
  const timeLeftText = (ms: number) => {
    const totalMin = Math.max(0, Math.round(ms / 60_000))
    if (totalMin <= 0) return t.lmExpired
    const d = Math.floor(totalMin / 1440)
    const h = Math.floor((totalMin % 1440) / 60)
    const m = totalMin % 60
    if (d > 0) return `${d}${t.lmTimeDays} ${h}${t.lmTimeHours}`
    if (h > 0) return `${h}${t.lmTimeHours} ${m}${t.lmTimeMinutes}`
    return `${m}${t.lmTimeMinutes}`
  }
  // The match derives from an order created under an older/different node identity.
  const fiberKeyMismatch = !!nodeFiberPubkey && match.fiberPubkey !== nodeFiberPubkey
  return (
    <div className="lm-drawer" aria-label={t.mgDetails} style={{ '--tier': hesitating ? 'var(--violet)' : lifeTierColor(life.pct) } as CSSProperties}>
      <div className="section-head lm-drawer-head">
        <button ref={closeRef} type="button" className="btn-icon lm-drawer-back" aria-label={t.lmBack} onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 2.5 4 7l5.5 4.5" />
          </svg>
        </button>
        <span className="lm-drawer-status">
          {hesitating ? (
            <span className="mg-pill hesitate">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 2" />
              </svg>
              {t.lmHesitation} · {t.lmHesitationLeft.replace('{time}', formatDurationHm(hesitationLeft))}
            </span>
          ) : (
            <MatchHealthBadge health={life.label} />
          )}
        </span>
      </div>

      <div className="lm-dash-figure lm-drawer-figure">
        {hesitating ? (
          <>
            <span className="stat-label">{t.lmHesitation}</span>
            <div className="lm-drawer-value">{formatDurationHm(hesitationLeft)}</div>
          </>
        ) : (
          <>
            <span className="stat-label">{t.lmUntilExpiry}</span>
            {/* `shannonsPerBlock === 0` → never exhausts (`expiresAtMs` is
                `u64::MAX`) — the time-left figure has no meaning, show ∞. */}
            <div className="lm-drawer-value">
              {match.shannonsPerBlock === 0 ? '∞' : timeLeftText(match.expiresAtMs - Date.now())}
            </div>
          </>
        )}
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
        {hesitating && (
          <div className="ms-detail">
            <span className="ms-detail-label">{t.lmHesitationEndsAt}</span>
            <span className="ms-detail-value">{formatTimestamp(match.hesitationEndsAtMs)}</span>
          </div>
        )}
        <div className="ms-detail">
          <span className="ms-detail-label">{t.fiberPubkey}</span>
          <CopyableText
            value={match.fiberPubkey}
            display={truncatePubkey(match.fiberPubkey)}
            className="ms-detail-value mono lm-drawer-tx"
            iconPosition="leading"
          />
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

      {/* Rent-extraction progress — actual funds drained vs the original stake
          (the life bar above is the time-projected term; this is on-chain truth). */}
      {extraction.pct > 0 && (
        <div className="lm-extraction-progress">
          <div className="lm-extraction-head">
            <span className="stat-label">{t.lmExtractionProgress}</span>
            <span className="lm-extraction-pct">
              {t.lmExtractionPct.replace('{pct}', String(extraction.pct))}
            </span>
          </div>
          <div className="lm-extraction-track">
            <div className="lm-extraction-fill" style={{ width: `${extraction.pct}%` }} />
          </div>
          <div className="lm-extraction-cols">
            <div className="lm-extraction-col">
              <span className="lm-extraction-col-label">{t.lmOriginalStake}</span>
              <span className="lm-extraction-col-value">
                {formatCkb(extraction.originalCkb)} <small>{t.unitCkb}</small>
              </span>
            </div>
            <div className="lm-extraction-col">
              <span className="lm-extraction-col-label">{t.lmExtracted}</span>
              <span className="lm-extraction-col-value">
                {formatCkb(extraction.extractedCkb)} <small>{t.unitCkb}</small>
              </span>
            </div>
            <div className="lm-extraction-col">
              <span className="lm-extraction-col-label">{t.lmExtractionLeft}</span>
              <span className="lm-extraction-col-value">
                {formatCkb(extraction.remainingCkb)} <small>{t.unitCkb}</small>
              </span>
            </div>
          </div>
        </div>
      )}

      {fiberKeyMismatch && (
        <div className="lm-fiber-risk">
          <svg className="lm-fiber-risk-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 1.5 13 12.5H1L7 1.5Z" />
            <path d="M7 5.5v3" />
            <circle cx="7" cy="10.6" r="0.5" fill="currentColor" />
          </svg>
          <div className="lm-fiber-risk-text">
            <div className="lm-fiber-risk-title">{t.lmPubkeyMismatchTitle}</div>
            <div className="lm-fiber-risk-body">{t.lmPubkeyMismatchBody}</div>
          </div>
        </div>
      )}

      <div className="lm-drawer-actions">
        {disabled && <span className="lm-node-hint">{t.nodeNotRunning}</span>}
        {life.isExhausted ? (
          <button
            type="button"
            className="btn-danger lm-buy-btn"
            disabled={disabled}
            title={disabled ? t.nodeNotRunning : undefined}
            onClick={() => onExtract(match)}
          >
            {t.lmExtractDelete}
          </button>
        ) : match.role !== 'buyer' ? (
          <span className="lm-node-hint">{t.lmSellerActionsHint}</span>
        ) : hesitating ? (
          <>
            {/* Withdraw-all = abandon. During the window the buyer may ONLY
                withdraw all rent (never inject), so inject is not shown at all. */}
            <button
              type="button"
              className="btn-danger lm-buy-btn"
              disabled={disabled}
              title={disabled ? t.nodeNotRunning : undefined}
              onClick={() => onAbandon(match)}
            >
              {t.lmAbandonOrderFull}
            </button>
            <div className="lm-drawer-action-status">{t.lmHesitationInStatus}</div>
          </>
        ) : (
          <>
            {/* Window closed → withdrawal is forbidden; injection is the only
                buyer action, so withdraw is not shown at all. */}
            <button
              type="button"
              className="btn-primary lm-buy-btn"
              disabled={disabled}
              title={disabled ? t.nodeNotRunning : undefined}
              onClick={() => onInject(match)}
            >
              {t.lmInject}
            </button>
            <div className="lm-drawer-action-status">{t.lmHesitationOverStatus}</div>
          </>
        )}
      </div>
    </div>
  )
}
