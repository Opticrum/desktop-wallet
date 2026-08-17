import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { wallet } from '../api/client'
import type { WalletStatus, WalletSummary, WalletTx, WalletTxKind } from '../api/types'
import { toCommandError } from '../api/types'
import { addressShort, typeCounts, TX_TYPE_ORDER } from '../lib/wallet'
import { commandErrorText } from '../lib/errors'
import { BottomDrawer } from './BottomDrawer'
import { QrIcon, QrModal } from './QrModal'
import { SendDetail } from '../pages/SendDetail'
import { TransactionTable, txLabel } from './TransactionTable'

type TxType = WalletTxKind

const TX_TYPES: TxType[] = [...TX_TYPE_ORDER]

function IconArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

/**
 * The wallet, embedded as a module in the node page's sidebar. A single
 * wallet address (always present). Transaction records take the emphasis;
 * the balance (click to send) and a QR thumbnail form a compact footer.
 *
 * Data comes from `wallet.get_summary` + `wallet.get_transactions` over IPC.
 */
export function WalletModule({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useLocale()
  const [sendOpen, setSendOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  const [summary, setSummary] = useState<WalletSummary | null>(null)
  // Fast wallet state (no chain query) — gates the unlock form so the password
  // field appears immediately, independent of the slower balance/tx trace-back.
  const [status, setStatus] = useState<WalletStatus | null>(null)
  const [txs, setTxs] = useState<WalletTx[]>([])
  // wallet-unlock state (wallet exists but locked)
  const [unlockPw, setUnlockPw] = useState('')
  const [unlockBusy, setUnlockBusy] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  // Refreshing veil — shown only when a refresh actually takes a moment
  // (never unmount/clear the module on refresh).
  const [refreshing, setRefreshing] = useState(false)
  const refreshTimer = useRef<number | null>(null)

  const refresh = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    // Only show the refreshing veil once a refresh actually stalls (no response
    // within 3s) — fast refreshes shouldn't flash anything.
    refreshTimer.current = window.setTimeout(() => setRefreshing(true), 3000)
    // Summary and transactions resolve independently — the unlock gate only waits
    // on the (fail-fast) summary, so the password field appears without waiting
    // for the slower tx trace-back.
    const summary = wallet.getSummary().then(setSummary).catch(() => {})
    const txs = wallet.getTransactions().then(setTxs).catch(() => {})
    Promise.all([summary, txs]).finally(() => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
      setRefreshing(false)
    })
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 15_000)
    return () => window.clearInterval(id)
  }, [refresh, refreshKey])

  // Fast status poll (5s) — reflects lock/unlock without waiting for the balance.
  useEffect(() => {
    let alive = true
    const poll = () =>
      wallet
        .getStatus()
        .then((s) => {
          if (alive) setStatus(s)
        })
        .catch(() => {})
    poll()
    const id = window.setInterval(poll, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const unlockWallet = async () => {
    if (!unlockPw) {
      setUnlockError(t.walletPasswordRequired)
      return
    }
    setUnlockBusy(true)
    setUnlockError(null)
    try {
      await wallet.unlock(unlockPw)
      wallet.getStatus().then(setStatus).catch(() => {})
      refresh()
    } catch (e) {
      setUnlockError(commandErrorText(t, toCommandError(e)))
    }
    setUnlockBusy(false)
  }

  const [activeTypes, setActiveTypes] = useState<Record<TxType, boolean>>({
    receive: true,
    send: true,
    channel_open: true,
    channel_close: true,
  })

  // ── wallet gate (fast status — no chain query, so it renders immediately) ──
  if (!status) {
    return (
      <section className="panel wallet-module">
        <div className="section-head">
          <h2 className="node-section-title">{t.walletCkb}</h2>
        </div>
        <p className="text-secondary" style={{ padding: '16px' }}>
          …
        </p>
      </section>
    )
  }
  if (!status.hasWallet) {
    return (
      <section className="panel wallet-module">
        <div className="section-head">
          <h2 className="node-section-title">{t.walletCkb}</h2>
        </div>
        <div className="wallet-none">
          <div className="wallet-none-badge">{t.walletNone}</div>
          <p className="text-secondary">{t.walletNoneHint}</p>
        </div>
      </section>
    )
  }
  if (!status.unlocked) {
    return (
      <section className="panel wallet-module">
        <div className="section-head">
          <h2 className="node-section-title">{t.walletCkb}</h2>
        </div>
        <div className="wallet-gate">
          <div className="wallet-gate-field">
            <label className="send-form-label">{t.walletPassword}</label>
            <input
              className="search-input"
              type="password"
              value={unlockPw}
              onChange={(e) => setUnlockPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && unlockWallet()}
              placeholder="••••••••"
            />
          </div>
          {unlockError && <p className="text-error">{unlockError}</p>}
          <button type="button" className="btn-primary" disabled={unlockBusy} onClick={unlockWallet}>
            {t.walletUnlockAction}
          </button>
        </div>
      </section>
    )
  }

  const availableCkb = summary?.availableCkb ?? 0
  const [whole, frac] = availableCkb.toFixed(2).split('.')
  const fiatUsd =
    summary && summary.fiatUsd != null && summary.totalCkb > 0
      ? (summary.availableCkb / summary.totalCkb) * summary.fiatUsd
      : null

  const typeCountsMap = typeCounts(txs)
  const visibleTxs = txs.filter((tx) => activeTypes[tx.kind])

  const toggleType = (type: TxType) =>
    setActiveTypes((prev) => ({ ...prev, [type]: !prev[type] }))

  return (
    <section className="panel wallet-module">
      <div className="section-head">
        <h2 className="node-section-title">{t.walletCkb}</h2>
        <button
          type="button"
          className="wallet-qr-thumb"
          onClick={() => setQrOpen(true)}
          aria-label={t.zoomQr}
          title={t.zoomQr}
        >
          <QrIcon />
        </button>
      </div>

      {/* Wallet info — balance (click to send) */}
      <div className="wallet-info">
        <button
          type="button"
          className="wallet-figure-btn"
          onClick={() => setSendOpen(true)}
          title={t.clickToSend}
        >
          <span className="wallet-figure">
            {summary ? (
              <>
                {Number(whole).toLocaleString()}
                <span className="frac">.{frac}</span> <span className="unit">CKB</span>
              </>
            ) : (
              <span className="frac">…</span>
            )}
          </span>
          {fiatUsd != null && (
            <span className="wallet-fiat">
              ≈ ${fiatUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
            </span>
          )}
          <span className="wallet-send-hint">
            <IconArrowUpRight />
            {t.clickToSend}
          </span>
        </button>
      </div>

      {/* Recent transactions — the module's primary content, one line each */}
      <div className="wallet-recent">
        <TransactionTable transactions={txs.slice(0, 4)} compact />
        {txs.length > 4 && (
          <button
            type="button"
            className="wallet-more-txs"
            onClick={() => setActivityOpen(true)}
          >
            <span className="wallet-more-txs-remaining">
              {t.txMoreRemaining.replace('{n}', String(txs.length - 4))}
            </span>
            <span className="wallet-more-txs-action">{t.viewAll} →</span>
          </button>
        )}
      </div>

      <BottomDrawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        ariaLabel={t.txHistory}
      >
        <div className="drawer-filter" role="group" aria-label={t.txFilterLabel}>
          {TX_TYPES.map((type) => {
            const active = activeTypes[type]
            return (
              <button
                key={type}
                type="button"
                className={`filter-chip${active ? ` active-${type.replace('_', '-')}` : ''}`}
                aria-pressed={active}
                disabled={typeCountsMap[type] === 0}
                onClick={() => toggleType(type)}
              >
                {txLabel(type, t)}
                <span className="filter-chip-count">{typeCountsMap[type]}</span>
              </button>
            )
          })}
        </div>
        {txs.length === 0 ? (
          <TransactionTable transactions={[]} fullHash />
        ) : visibleTxs.length > 0 ? (
          <TransactionTable transactions={visibleTxs} fullHash />
        ) : (
          <div className="filter-empty">{t.txFilterEmpty}</div>
        )}
      </BottomDrawer>

      <SendDetail
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        addressShort={addressShort(summary?.address ?? '')}
      />
      <QrModal open={qrOpen} onClose={() => setQrOpen(false)} address={summary?.address ?? ''} />
      {refreshing && (
        <div className="wallet-refreshing" role="status">
          <span className="btn-spin" aria-hidden />
          <span className="wallet-refreshing-label">{t.walletRefreshing}</span>
        </div>
      )}
    </section>
  )
}
