import { BackLink } from '../components/BackLink'
import { TransactionTable } from '../components/TransactionTable'
import { useLocale } from '../i18n/LocaleContext'
import { wallet } from '../mock/wallet'

export function OnChainDetail() {
  const { t } = useLocale()

  return (
    <div className="page">
      <BackLink to="/balance" />
      <div className="page-kicker">{t.wallet}</div>
      <h1 className="page-title">{t.onchainAssets}</h1>
      <p className="page-lead">{t.onchainDescription}</p>

      <div className="nav-bento-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-label">{t.available}</div>
          <div className="kpi-value">
            {wallet.availableCkb.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="kpi-sub">CKB</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.locked}</div>
          <div className="kpi-value">
            {wallet.lockedCkb.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="kpi-sub">CKB</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.transactionCount}</div>
          <div className="kpi-value">{wallet.txs.length}</div>
        </div>
      </div>

      <div className="section-head">
        <h2>{t.asset}</h2>
      </div>
      <div className="panel mb-4">
        <div className="kpi-label" style={{ marginBottom: 8 }}>
          {t.balance}
        </div>
        <div className="balance-figure" style={{ fontSize: 40 }}>
          {wallet.totalCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          <span className="unit">CKB</span>
        </div>
        <div className="balance-fiat">≈ ${wallet.fiatUsd.toLocaleString()} USD</div>
        <div className="address-chip" style={{ marginTop: 20 }}>
          <span className="label">{t.address}</span>
          <span className="break-all">{wallet.address}</span>
        </div>
      </div>

      <div className="section-head">
        <h2>{t.recentTxs}</h2>
      </div>
      <TransactionTable transactions={wallet.txs} />
    </div>
  )
}
