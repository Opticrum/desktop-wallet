import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'
import { wallet } from '../mock/wallet'
import { QrModal, QrPlaceholder } from './QrModal'
import { SendDetail } from '../pages/SendDetail'
import { TransactionTable } from './TransactionTable'

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
 */
export function WalletModule() {
  const { t } = useLocale()
  const [sendOpen, setSendOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  const [whole, frac] = wallet.availableCkb.toFixed(2).split('.')
  const fiatUsd = (wallet.availableCkb / wallet.totalCkb) * wallet.fiatUsd

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
          <QrPlaceholder value={wallet.address} />
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
            {Number(whole).toLocaleString()}
            <span className="frac">.{frac}</span> <span className="unit">CKB</span>
          </span>
          <span className="wallet-fiat">
            ≈ ${fiatUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
          </span>
          <span className="wallet-send-hint">
            <IconArrowUpRight />
            {t.clickToSend}
          </span>
        </button>
      </div>

      {/* Recent transactions — the module's primary content, one line each */}
      <div className="wallet-recent">
        <TransactionTable transactions={wallet.txs.slice(0, 4)} compact />
        {wallet.txs.length > 4 && (
          <Link to="/node/wallet/activity" className="wallet-more-txs">
            <span className="wallet-more-txs-remaining">
              {t.txMoreRemaining.replace('{n}', String(wallet.txs.length - 4))}
            </span>
            <span className="wallet-more-txs-action">{t.viewAll} →</span>
          </Link>
        )}
      </div>

      <SendDetail open={sendOpen} onClose={() => setSendOpen(false)} />
      <QrModal open={qrOpen} onClose={() => setQrOpen(false)} address={wallet.address} />
    </section>
  )
}
