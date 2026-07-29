import { Link } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'
import { wallet } from '../mock/wallet'

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
      <path d="M16 12h5" />
      <circle cx="16.5" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconChain() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

function txLabel(
  type: (typeof wallet.txs)[number]['type'],
  t: ReturnType<typeof useLocale>['t'],
) {
  switch (type) {
    case 'receive':
      return t.txReceive
    case 'send':
      return t.txSend
    case 'channel_open':
      return t.txChannelOpen
    case 'channel_close':
      return t.txChannelClose
  }
}

export function BalanceDetail() {
  const { t, locale } = useLocale()
  const [whole, frac] = wallet.totalCkb.toFixed(2).split('.')

  return (
    <div className="page">
      <section className="balance-stage">
        <div className="page-kicker">{t.wallet}</div>
        <div className="page-title" style={{ marginBottom: 8 }}>
          {t.yourBalance}
        </div>
        <div className="balance-figure" aria-label={`${wallet.totalCkb} CKB`}>
          {Number(whole).toLocaleString()}
          <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>.{frac}</span>
          <span className="unit">CKB</span>
        </div>
        <div className="balance-fiat">≈ ${wallet.fiatUsd.toLocaleString()} USD</div>

        <div className="balance-split">
          <div className="balance-split-item">
            <div className="label">{t.available}</div>
            <div className="value">
              {wallet.availableCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="balance-split-item">
            <div className="label">{t.locked}</div>
            <div className="value">
              {wallet.lockedCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="address-chip">
          <span className="label">{t.address}</span>
          <span>{wallet.addressShort}</span>
        </div>
      </section>

      <div className="action-grid">
        <Link to="/wallet/onchain" className="action-tile">
          <div className="action-tile-icon">
            <IconArrow />
          </div>
          <div>
            <h3>{t.sendReceive}</h3>
            <p>{t.sendReceiveDesc}</p>
          </div>
        </Link>
        <Link to="/wallet/hd" className="action-tile">
          <div className="action-tile-icon">
            <IconWallet />
          </div>
          <div>
            <h3>{t.hdWallet}</h3>
            <p>{t.hdWalletDescription}</p>
          </div>
        </Link>
        <Link to="/wallet/onchain" className="action-tile">
          <div className="action-tile-icon">
            <IconChain />
          </div>
          <div>
            <h3>{t.onchainAssets}</h3>
            <p>{t.onchainDescription}</p>
          </div>
        </Link>
      </div>

      <div className="section-head">
        <h2>{t.activity}</h2>
        <Link to="/wallet/onchain">{t.viewAll} →</Link>
      </div>

      <div className="activity">
        {wallet.txs.slice(0, 5).map((tx) => (
          <div key={tx.id} className="activity-row">
            <div className="activity-main">
              <span className={`activity-dot ${tx.type}`} aria-hidden />
              <div>
                <div className="activity-title">{txLabel(tx.type, t)}</div>
                <div className="activity-sub">
                  {new Date(tx.timestamp).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {tx.txHash.slice(0, 10)}…
                </div>
              </div>
            </div>
            <div className={`activity-amount ${tx.amountCkb >= 0 ? 'positive' : 'negative'}`}>
              {tx.amountCkb >= 0 ? '+' : ''}
              {tx.amountCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })} CKB
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
