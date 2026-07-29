import { Link } from 'react-router-dom'
import { TransactionTable } from '../components/TransactionTable'
import { useLocale } from '../i18n/LocaleContext'
import { wallet } from '../mock/wallet'

export function BalanceDetail() {
  const { t } = useLocale()

  return (
    <div className="page">
      <h2 className="page-title">{t.walletOverview}</h2>

      <div className="balance-hero">
        <div>
          <div className="stat-label" style={{ marginBottom: 4 }}>{t.balance}</div>
          <div className="balance-primary">
            {wallet.totalCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })} CKB
          </div>
          <div className="balance-fiat">
            ≈ ${wallet.fiatUsd.toLocaleString()} USD
          </div>
        </div>
        <div className="balance-secondary">
          <div className="balance-secondary-item">
            <div className="balance-secondary-value">
              {wallet.availableCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="balance-secondary-label">{t.available}</div>
          </div>
          <div className="balance-secondary-item">
            <div className="balance-secondary-value">
              {wallet.lockedCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="balance-secondary-label">{t.locked}</div>
          </div>
        </div>
      </div>

      <div className="address-block">
        <div className="address-block-label">{t.address}</div>
        {wallet.address}
      </div>

      <div className="nav-strip nav-strip-2">
        <Link to="/wallet/hd" className="nav-card">
          <div className="nav-card-label">{t.hdWallet}</div>
          <div className="nav-card-desc">{t.hdWalletDescription}</div>
          <span className="nav-card-link">→ {t.walletAccounts}</span>
        </Link>
        <Link to="/wallet/onchain" className="nav-card">
          <div className="nav-card-label">{t.onchainAssets}</div>
          <div className="nav-card-desc">{t.onchainDescription}</div>
          <span className="nav-card-link">→ {t.recentTxs}</span>
        </Link>
      </div>

      <h3 className="section-header">{t.recentTxs}</h3>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <TransactionTable transactions={wallet.txs.slice(0, 4)} />
      </div>
      <Link
        to="/wallet/onchain"
        className="text-accent"
        style={{ display: 'inline-block', marginTop: 12, fontSize: 13 }}
      >
        → {t.onchainAssets}
      </Link>
    </div>
  )
}
