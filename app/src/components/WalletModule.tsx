import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { wallet } from '../api/client'
import type { WalletStatus, WalletSummary, WalletTx, WalletTxKind } from '../api/types'
import { addressShort, typeCounts, TX_TYPE_ORDER } from '../lib/wallet'
import { CkbTxModal, useCkbTx } from './CkbTxModal'
import { CopyableText } from './CopyableText'
import { QrModal } from './QrModal'
import { SendDetail } from '../pages/SendDetail'
import { TransactionTable, txLabel } from './TransactionTable'

type TxType = WalletTxKind

const TX_TYPES: TxType[] = [...TX_TYPE_ORDER]

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

function IconReceive() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M17 7 7 17" />
      <path d="M7 8v9h9" />
    </svg>
  )
}

function addrDisplay(address: string): string {
  if (address.length <= 22) return address
  return `${address.slice(0, 10)}…${address.slice(-8)}`
}

function WalletPageHead({ address }: { address?: string }) {
  const { t } = useLocale()
  return (
    <header className="wallet-page-head">
      <div className="wallet-page-head-main">
        <h1 className="wallet-page-title">{t.walletCkb}</h1>
        {address ? (
          <CopyableText
            className="wallet-page-addr mono"
            value={address}
            display={addrDisplay(address)}
          />
        ) : null}
      </div>
    </header>
  )
}

/**
 * Local CKB wallet as a page inside the node-page bottom drawer — header,
 * balance hero with explicit send/receive, then the full transaction list.
 */
export function WalletModule({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useLocale()
  const [sendOpen, setSendOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [status, setStatus] = useState<WalletStatus | null>(null)
  const [txs, setTxs] = useState<WalletTx[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const refreshTimer = useRef<number | null>(null)

  const refresh = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => setRefreshing(true), 3000)
    const summary = wallet.getSummary().then(setSummary).catch(() => {})
    const txs = wallet.getTransactions().then(setTxs).catch(() => {})
    Promise.all([summary, txs]).finally(() => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
      setRefreshing(false)
    })
  }, [])

  const { ckbTxState, runCkbTx, closeCkbTx } = useCkbTx(refresh)

  const handleSend = useCallback(
    async (address: string, amountCkb: number) => {
      setSendOpen(false)
      await runCkbTx(t.send, async ({ channel }) => {
        const res = await wallet.sendCkb(address, Math.round(amountCkb * 1e8), channel)
        return res
      })
    },
    [runCkbTx, t.send],
  )

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 15_000)
    return () => window.clearInterval(id)
  }, [refresh, refreshKey])

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
  }, [refreshKey])

  const [activeTypes, setActiveTypes] = useState<Record<TxType, boolean>>({
    receive: true,
    send: true,
    channel_open: true,
    channel_close: true,
    rent_pledge: true,
    rent_extract: true,
  })

  if (!status) {
    return (
      <article className="wallet-page">
        <WalletPageHead />
        <p className="wallet-page-placeholder">{t.walletRefreshing}</p>
      </article>
    )
  }

  if (!status.hasWallet) {
    return (
      <article className="wallet-page">
        <WalletPageHead />
        <div className="wallet-page-empty">
          <div className="wallet-none-badge">{t.walletNone}</div>
          <p className="text-secondary">{t.walletNoneHint}</p>
        </div>
      </article>
    )
  }

  if (!status.unlocked) {
    return (
      <article className="wallet-page">
        <WalletPageHead address={status.address} />
        <p className="wallet-page-placeholder">{t.walletRefreshing}</p>
      </article>
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
    <article className="wallet-page">
      <WalletPageHead address={status.address || summary?.address} />

      <section className="wallet-page-hero" aria-label={t.availableCkb}>
        <p className="wallet-page-kicker">{t.availableCkb}</p>
        <p className="wallet-page-balance">
          {summary ? (
            <>
              {Number(whole).toLocaleString()}
              <span className="frac">.{frac}</span>
              <span className="unit">CKB</span>
            </>
          ) : (
            <span className="frac">…</span>
          )}
        </p>
        {fiatUsd != null && (
          <p className="wallet-page-fiat">
            ≈ ${fiatUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
          </p>
        )}
        <div className="wallet-page-actions">
          <button type="button" className="btn-primary btn-icon" onClick={() => setSendOpen(true)}>
            <IconSend />
            <span>{t.send}</span>
          </button>
          <button type="button" className="btn-secondary btn-icon" onClick={() => setQrOpen(true)}>
            <IconReceive />
            <span>{t.walletReceive}</span>
          </button>
        </div>
      </section>

      <section className="wallet-page-txs" aria-label={t.recentTxs}>
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
      </section>

      <SendDetail
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        addressShort={addressShort(summary?.address ?? '')}
        availableCkb={availableCkb}
        busy={ckbTxState.status !== 'idle'}
        onSubmit={handleSend}
      />
      <CkbTxModal state={ckbTxState} onClose={closeCkbTx} />
      <QrModal open={qrOpen} onClose={() => setQrOpen(false)} address={summary?.address ?? ''} />
      {refreshing && (
        <div className="wallet-refreshing" role="status">
          <span className="btn-spin" aria-hidden />
          <span className="wallet-refreshing-label">{t.walletRefreshing}</span>
        </div>
      )}
    </article>
  )
}
