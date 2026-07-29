import { BackLink } from '../components/BackLink'
import { TransactionTable } from '../components/TransactionTable'
import { useLocale } from '../i18n/LocaleContext'
import { wallet } from '../mock/wallet'

export function OnChainDetail() {
  const { t } = useLocale()

  return (
    <div className="page">
      <BackLink to="/balance" />
      <h2 className="page-title">{t.onchainAssets}</h2>
      <p className="text-secondary mb-4">{t.onchainDescription}</p>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">{t.available}</div>
          <div className="stat-value">
            {wallet.availableCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="stat-sub">CKB</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.locked}</div>
          <div className="stat-value">
            {wallet.lockedCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="stat-sub">CKB</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.transactionCount}</div>
          <div className="stat-value">{wallet.txs.length}</div>
        </div>
      </div>

      <h3 className="section-header">{t.asset}</h3>
      <div className="card mb-4">
        <div className="stat-label" style={{ marginBottom: 8 }}>{t.balance}</div>
        <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {wallet.totalCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })} CKB
        </div>
        <div className="text-secondary mt-2">≈ ${wallet.fiatUsd.toLocaleString()} USD</div>

        <div className="address-block" style={{ marginTop: 16, marginBottom: 0 }}>
          <div className="address-block-label">{t.address}</div>
          {wallet.address}
        </div>
      </div>

      <h3 className="section-header">{t.recentTxs}</h3>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <TransactionTable transactions={wallet.txs} />
      </div>
    </div>
  )
}
