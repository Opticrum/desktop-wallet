import { BackLink } from '../components/BackLink'
import { CopyableText } from '../components/CopyableText'
import { useLocale } from '../i18n/LocaleContext'
import { hdAccounts } from '../mock/wallet'

// NOTE: This page is kept only as a deep-link target. The HD wallet UI is now
// embedded directly under the total balance card on /balance — see
// BalanceDetail.tsx's <section className="hd-section">. The route /wallet/hd
// still resolves in App.tsx for direct navigation, but no in-app link points
// here anymore.

export function HdWalletDetail() {
  const { t, locale } = useLocale()

  return (
    <div className="page">
      <BackLink to="/balance" />
      <h1 className="page-title">{t.hdWallet}</h1>
      <p className="page-lead">{t.hdWalletDescription}</p>

      <div className="hd-toolbar">
        <button type="button" className="btn-primary">
          {t.hdCreateWallet}
        </button>
        <button type="button" className="btn-secondary">
          {t.walletAccounts}
        </button>
        <button type="button" className="btn-secondary">
          {t.derivationPath}
        </button>
      </div>

      <div className="section-head">
        <h2>{t.walletAccounts}</h2>
      </div>
      <div className="panel">
        {hdAccounts.map((acc) => (
          <div key={acc.id} className="hd-account-row">
            <div className="hd-account-top">
              <div className="hd-account-info">
                <div className="hd-account-name">
                  {locale === 'zh' ? acc.nameZh : acc.nameEn}
                </div>
                <div className="hd-account-path">{acc.path}</div>
              </div>
              <div className="hd-account-balance">
                {acc.balanceCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })} CKB
              </div>
            </div>
            <div className="hd-account-address">
              <CopyableText value={acc.address} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
