import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/useScrollLock'
import { useLocale } from '../i18n/LocaleContext'
import { useNode } from '../node/NodeContext'
import { useWalletNetwork } from '../wallet/WalletNetworkContext'
import { liquidity } from '../api/client'
import { CkbTxModal, useCkbTx } from './CkbTxModal'
import {
  costAndDaysToRateShPerBlock,
  dwellHours,
  formatCkb,
  matchLife,
  sameFiberPubkey,
  shannonsPerBlockToApyBps,
  type LiquidityMatch,
  type LiquidityOrder,
  type SheetTarget,
} from '../lib/liquidity'
import { LiquidityCellField } from './LiquidityCellField'
import { LiquiditySheet } from './LiquiditySheet'
import { BottomDrawer } from './BottomDrawer'
import { ConfirmModal } from './ConfirmModal'
import { Toast } from './Toast'

// ── Helpers ───────────────────────────────────────────────────────────────

/** Background auto-refresh cadence for the market — same rhythm as the wallet. */
const AUTOREFRESH_MS = 15_000

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
  /** Node is down/starting / network mismatch — publishing is inert. */
  disabled?: boolean
  disabledTitle?: string
}

/**
 * Buy-order form — asks for what the user wants (liquidity, total cost,
 * duration); the per-block rate and APY are derived from those and shown as
 * hints, so the user never has to reason about `sh/block` directly.
 */
function BuyOrderModal({ open, onClose, onPublish, disabled, disabledTitle }: BuyOrderModalProps) {
  const { t } = useLocale()
  const [capacity, setCapacity] = useState('25,000')
  const [cost, setCost] = useState('250')
  const [days, setDays] = useState('30')
  const [fiberAddress, setFiberAddress] = useState('')
  const { shown, entered, onExitEnd } = usePresence(open)

  useScrollLock(shown)

  if (!shown) return null

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
    <div
      className={`modal-backdrop${entered ? ' is-open' : ''}`}
      role="presentation"
      onTransitionEnd={onExitEnd}
    >
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
            title={disabled ? disabledTitle ?? t.nodeNotRunning : undefined}
            onClick={handlePublish}
          >
            {t.lmPublishOrder}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Adjust deposit modal (inject only — withdrawal is the buyer's full-dump
//    abandon during the hesitation window, handled by its own confirm flow) ──

type AdjustDepositModalProps = {
  open: boolean
  match: LiquidityMatch | null
  /** Node is down/starting / network mismatch — 注入 is inert. */
  disabled?: boolean
  disabledTitle?: string
  onClose: () => void
  onConfirm: (match: LiquidityMatch, amount: number) => void
}

function AdjustDepositModal({
  open,
  match,
  disabled,
  disabledTitle,
  onClose,
  onConfirm,
}: AdjustDepositModalProps) {
  const { t } = useLocale()
  const [amount, setAmount] = useState('')
  const { shown, entered, onExitEnd } = usePresence(open)
  // Keep the last match so the exit fade still has labels.
  const [displayMatch, setDisplayMatch] = useState(match)
  useEffect(() => {
    if (match) setDisplayMatch(match)
  }, [match])

  useScrollLock(shown)

  if (!shown || !displayMatch) return null

  const amountNum = Number(amount.replace(/,/g, '')) || 0
  const valid = amountNum > 0

  const handleConfirm = () => {
    if (!valid || !match) return
    onConfirm(match, amountNum)
  }

  return (
    <div
      className={`modal-backdrop${entered ? ' is-open' : ''}`}
      role="presentation"
      onTransitionEnd={onExitEnd}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={t.lmAdjustTitle} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          {t.lmAdjustTitle} · {t.lmInject}
        </div>
        <div className="modal-body">
          <div className="lm-form-field">
            <label>{t.lmAdjustAmount}</label>
            <input className="search-input" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} spellCheck={false} autoFocus />
          </div>
          <div className="lm-form-hint">
            {t.lmStakedHint.replace('{amount}', formatCkb(displayMatch.depositCkb))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>{t.close}</button>
          <button
            className="btn-primary"
            disabled={!valid || disabled}
            title={disabled ? disabledTitle ?? t.nodeNotRunning : undefined}
            onClick={handleConfirm}
          >
            {t.lmInject}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Inbound-liquidity pool for the currently selected node — the former
 * liquidity-page left column, scoped by that node's fiber pubkey.
 */
export function NodeLiquidityPanel({ visible = true }: { visible?: boolean }) {
  const { t } = useLocale()
  const { running, starting, fiberPubkey, targetId, chain: nodeChain } = useNode()
  const { chain: walletChain, status: walletStatus } = useWalletNetwork()

  // Every on-chain action (发布/撤销/注入/抽离/提取) needs the node up and
  // wallet CKB network matching the selected Fiber node.
  const networkMatched = walletChain === nodeChain
  const nodeReady = running && !starting && networkMatched
  const actionBlockedTitle = !running || starting
    ? t.nodeNotRunning
    : !networkMatched
      ? t.networkMismatchBlocked
      : undefined

  // Wallet lock gates the market — a locked wallet can't place trades, so the
  // cell pool freezes and shows an unlock hint.
  const walletLocked = !(walletStatus?.unlocked ?? false)

  const [orders, setOrders] = useState<LiquidityOrder[]>([])
  const [matches, setMatches] = useState<LiquidityMatch[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [active, setActive] = useState<SheetTarget | null>(null)
  const [poolTab, setPoolTab] = useState<'orders' | 'matches'>('orders')

  const [buyOpen, setBuyOpen] = useState(false)
  const [adjust, setAdjust] = useState<LiquidityMatch | null>(null)
  const [cancelTarget, setCancelTarget] = useState<LiquidityOrder | null>(null)
  const [extractTarget, setExtractTarget] = useState<LiquidityMatch | null>(null)
  // Buyer abandon during the hesitation window — withdraws ALL rent.
  const [abandonTarget, setAbandonTarget] = useState<LiquidityMatch | null>(null)

  // Shared market fetch. `rescan` re-scans personal orders from the chain (the
  // manual button + background auto-refresh) so a matched/cancelled order leaves
  // the pool; otherwise reads the local cache (mount + post-tx reload). While
  // the wallet is locked a chain re-scan would rewrite the personal-order cache
  // empty, so it falls back to the cache — which the backend safely returns
  // empty without touching.
  const fetchMarket = useCallback(
    async (rescan: boolean) => {
      try {
        const [o, m] = await Promise.all([
          walletLocked || !rescan ? liquidity.getOrders() : liquidity.refreshOrders(),
          liquidity.getMatches(),
        ])
        setOrders(o)
        setMatches(m)
      } catch {
        /* best-effort */
      }
    },
    [walletLocked],
  )

  const reload = useCallback(() => fetchMarket(false), [fetchMarket])

  useEffect(() => {
    if (!visible) return
    reload()
  }, [reload, visible])

  // Switching nodes (or losing the pubkey) drops the open sheet — the
  // previous cell no longer belongs to this view.
  useEffect(() => {
    setActive(null)
  }, [targetId, fiberPubkey])

  // Background auto-refresh — every tick re-scans personal orders from the chain
  // (cache reads would keep matched/cancelled orders ghosted) and refreshes
  // matches. A tick is skipped while a refresh is still in flight or the
  // window is hidden (minimized).
  const pollInFlightRef = useRef(false)
  useEffect(() => {
    if (!visible) return
    const poll = async () => {
      if (pollInFlightRef.current || document.hidden) return
      pollInFlightRef.current = true
      try {
        await fetchMarket(true)
      } catch {
        /* background — best-effort */
      } finally {
        pollInFlightRef.current = false
      }
    }
    const id = window.setInterval(poll, AUTOREFRESH_MS)
    return () => window.clearInterval(id)
  }, [fetchMarket, visible])

  // On the lock→unlock transition, re-fetch — while locked the backend returns
  // no orders, so fresh data arrives once the wallet can filter again.
  const prevLockedRef = useRef(false)
  useEffect(() => {
    const wasLocked = prevLockedRef.current
    prevLockedRef.current = walletLocked
    if (wasLocked && !walletLocked) reload()
  }, [walletLocked, reload])

  // Manual refresh — immediate chain re-scan with a spinning button (the
  // background auto-refresh re-scans on the same cadence, just silently).
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchMarket(true)
    } finally {
      setRefreshing(false)
    }
  }

  // Hold the last selected cell so the sheet stays painted while the drawer
  // slides out (clearing `active` would unmount it mid-transition).
  const sheetTargetRef = useRef<SheetTarget | null>(null)
  if (active) sheetTargetRef.current = active
  const sheetTarget = active ?? sheetTargetRef.current

  const nodeOrders = useMemo(
    () => orders.filter((o) => sameFiberPubkey(o.fiberPubkey, fiberPubkey)),
    [orders, fiberPubkey],
  )
  const nodeMatches = useMemo(
    () => matches.filter((m) => sameFiberPubkey(m.fiberPubkey, fiberPubkey)),
    [matches, fiberPubkey],
  )

  // ── Strip dashboard — per-tab KPIs, scoped to this node's cells ──────────
  const orderStats = useMemo(() => {
    const open = nodeOrders.filter((o) => o.status !== 'cancelled')
    const totalDemand = open.reduce((s, o) => s + o.channelCapacityCkb, 0)
    const avgApy = open.length
      ? Math.round(open.reduce((s, o) => s + o.annualYieldBps, 0) / open.length)
      : 0
    const avgDwell = open.length
      ? open.reduce((s, o) => s + dwellHours(o.createdAtMs ?? 0), 0) / open.length
      : 0
    return { totalDemand, avgApy, pending: open.length, avgDwell }
  }, [nodeOrders])

  const matchStats = useMemo(() => {
    const activeMatches = nodeMatches.filter((m) => !matchLife(m).isExhausted)
    const totalDeposit = nodeMatches.reduce((s, m) => s + m.depositCkb, 0)
    const avgRate = activeMatches.length
      ? Math.round(activeMatches.reduce((s, m) => s + m.annualYieldBps, 0) / activeMatches.length)
      : 0
    const avgRemaining = nodeMatches.length
      ? Math.round(nodeMatches.reduce((s, m) => s + matchLife(m).pct, 0) / nodeMatches.length)
      : 0
    return { active: activeMatches.length, totalDeposit, avgRate, avgRemaining }
  }, [nodeMatches])

  const emptyHint = fiberPubkey ? t.lmNoOrdersForNode : t.nodeNotRunning
  const poolEmpty =
    poolTab === 'orders' ? orderStats.pending === 0 : nodeMatches.length === 0

  // Every CKB tx write resolves only once confirmed on-chain; the modal walks
  // the user through the wait, prints the tx hash, and reloads when it lands.
  const { ckbTxState, runCkbTx, closeCkbTx } = useCkbTx(reload)

  const handlePublish = async (v: PublishValues) => {
    if (!nodeReady) return
    setBuyOpen(false)
    await runCkbTx(t.lmPublishOrder, async ({ channel }) => {
      const res = await liquidity.publishOrder(
        {
          capacityShannons: Math.round(v.capacityCkb * 1e8),
          shannonsPerBlock: v.shannonsPerBlock,
          rentCapacityShannons: Math.round(v.depositCkb * 1e8),
          rentalDays: v.rentalDays,
          fiberAddress: v.fiberAddress || undefined,
        },
        channel,
      )
      setToast(t.lmOrderPublished)
      return res
    })
  }

  const handleAdjust = async (match: LiquidityMatch, amount: number) => {
    if (!nodeReady) return
    setAdjust(null)
    const shannons = Math.round(amount * 1e8)
    await runCkbTx(t.lmAdjustTitle, async ({ channel }) => {
      const res = await liquidity.injectDeposit(match.outpoint, shannons, channel)
      // Optimistically apply the delta after confirmation (reload pulls truth).
      setMatches((prev) =>
        prev.map((m) =>
          m.outpoint === match.outpoint
            ? { ...m, depositCkb: Math.max(0, m.depositCkb + amount) }
            : m,
        ),
      )
      setToast(t.lmDepositAdjusted)
      return res
    })
  }

  // Buyer abandon during the hesitation window — withdraws ALL rent (a full
  // dump), which spends the match cell. The backend ignores the amount and
  // dumps everything; we pass the stake so the semantics stay explicit.
  const handleAbandon = async () => {
    if (!abandonTarget || !nodeReady) return
    const outpoint = abandonTarget.outpoint
    const amount = abandonTarget.depositCkb
    setAbandonTarget(null)
    await runCkbTx(t.lmAbandonOrderTitle, async ({ channel }) => {
      const res = await liquidity.withdrawDeposit(outpoint, Math.round(amount * 1e8), channel)
      // The full dump spends the match cell — it leaves the pool immediately.
      setMatches((prev) => prev.filter((m) => m.outpoint !== outpoint))
      setActive((prev) => (prev?.kind === 'match' && prev.item.outpoint === outpoint ? null : prev))
      setToast(t.lmOrderAbandoned.replace('{amount}', formatCkb(amount)))
      return res
    })
  }

  const handleCancelOrder = async () => {
    if (!cancelTarget || !nodeReady) return
    const outpoint = cancelTarget.outpoint
    // Close the confirm dialog immediately — the waiting modal takes over.
    setCancelTarget(null)
    try {
      await runCkbTx(t.lmCancelOrderTitle, async ({ channel }) => {
        const res = await liquidity.cancelOrder(outpoint, channel)
        setOrders((prev) =>
          prev.map((o) => (o.outpoint === outpoint ? { ...o, status: 'cancelled' as const } : o)),
        )
        setToast(t.lmOrderCancelled)
        return res
      })
    } finally {
      // Release the selection once the operation settles so the cell is
      // de-highlighted, its persistent tooltip closes, and every other cell
      // becomes clickable again.
      setActive(null)
    }
  }

  const handleExtract = async () => {
    if (!extractTarget || !nodeReady) return
    const outpoint = extractTarget.outpoint
    let returned = extractTarget.depositCkb
    setExtractTarget(null)
    await runCkbTx(t.lmExtractDeleteTitle, async ({ channel }) => {
      const res = await liquidity.extractSpentMatch(outpoint, channel)
      returned = res.returnedCkb
      setMatches((prev) => prev.filter((m) => m.outpoint !== outpoint))
      setActive((prev) => (prev?.kind === 'match' && prev.item.outpoint === outpoint ? null : prev))
      setToast(t.lmExtractDeleted.replace('{amount}', formatCkb(returned)))
      return res
    })
  }

  const sheetBusy =
    buyOpen || adjust !== null || cancelTarget !== null || abandonTarget !== null || extractTarget !== null

  return (
    <>
    <div className="node-tabbar">
      <button
        type="button"
        className="node-refresh-btn"
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
      <button
        type="button"
        className="node-tabbar-action btn-primary"
        disabled={!nodeReady}
        title={actionBlockedTitle}
        onClick={() => setBuyOpen(true)}
      >
        + {t.lmBuyLiquidity}
      </button>
    </div>
    <div className={`node-liq-panel lm-main is-${poolTab}`}>
      <LiquidityCellField
        orders={nodeOrders}
        matches={nodeMatches}
        mode={poolTab}
        selected={active ? active.item.outpoint : null}
        onSelect={setActive}
        disabled={walletLocked}
        nodeFiberPubkey={fiberPubkey}
        overlay={
          <>
            <section className="lm-strip lm-pool-hud" aria-label={t.liquidityMarket}>
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
            {poolEmpty && !walletLocked && (
              <p className="lm-node-hint" role="status">
                {emptyHint}
              </p>
            )}
          </>
        }
      />

      <BottomDrawer
        open={active !== null}
        onClose={() => setActive(null)}
        ariaLabel={t.mgDetails}
        side="right"
        dismissible={!sheetBusy}
      >
        <div className="node-liq-sheet">
          <LiquiditySheet
            target={sheetTarget}
            orders={nodeOrders}
            matches={nodeMatches}
            disabled={!nodeReady}
            nodeFiberPubkey={fiberPubkey}
            onCancelOrder={setCancelTarget}
            onInject={setAdjust}
            onExtract={setExtractTarget}
            onAbandon={setAbandonTarget}
          />
        </div>
      </BottomDrawer>

      <BuyOrderModal
        open={buyOpen}
        disabled={!nodeReady}
        disabledTitle={actionBlockedTitle}
        onClose={() => setBuyOpen(false)}
        onPublish={handlePublish}
      />
      <AdjustDepositModal
        open={adjust !== null}
        disabled={!nodeReady}
        disabledTitle={actionBlockedTitle}
        match={adjust ?? null}
        onClose={() => setAdjust(null)}
        onConfirm={handleAdjust}
      />
      <ConfirmModal
        open={cancelTarget !== null}
        title={t.lmCancelOrderTitle}
        body={t.lmCancelOrderBody}
        confirmLabel={t.lmCancelOrder}
        cancelLabel={t.nodeDeleteCancel}
        overDrawer
        onCancel={() => setCancelTarget(null)}
        onConfirm={handleCancelOrder}
      />
      <ConfirmModal
        open={abandonTarget !== null}
        title={t.lmAbandonOrderTitle}
        body={t.lmAbandonOrderBody.replace('{amount}', formatCkb(abandonTarget?.depositCkb ?? 0))}
        confirmLabel={t.lmAbandonOrder}
        cancelLabel={t.nodeDeleteCancel}
        danger
        overDrawer
        onCancel={() => setAbandonTarget(null)}
        onConfirm={handleAbandon}
      />
      <ConfirmModal
        open={extractTarget !== null}
        title={t.lmExtractDeleteTitle}
        body={t.lmExtractDeleteBody}
        confirmLabel={t.lmExtractDelete}
        cancelLabel={t.nodeDeleteCancel}
        danger
        overDrawer
        onCancel={() => setExtractTarget(null)}
        onConfirm={handleExtract}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
      <CkbTxModal state={ckbTxState} onClose={closeCkbTx} overDrawer />
    </div>
    </>
  )
}
