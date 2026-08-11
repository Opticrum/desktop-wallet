import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { wallet } from '../api/client'
import type { WalletSummary, WalletTx, WalletTxKind } from '../api/types'
import { addressShort, typeCounts, TX_TYPE_ORDER } from '../lib/wallet'
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
export function WalletModule() {
  const { t } = useLocale()
  const [sendOpen, setSendOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [txs, setTxs] = useState<WalletTx[]>([])

  useEffect(() => {
    let alive = true
    Promise.all([wallet.getSummary(), wallet.getTransactions()])
      .then(([s, t]) => {
        if (!alive) return
        setSummary(s)
        setTxs(t)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const [activeTypes, setActiveTypes] = useState<Record<TxType, boolean>>({
    receive: true,
    send: true,
    channel_open: true,
    channel_close: true,
  })

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
        <h2 className="node-section-title">{t.wallet}</h2>
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
        {visibleTxs.length > 0 ? (
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
    </section>
  )
}
