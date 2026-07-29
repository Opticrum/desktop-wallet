import { BackLink } from '../components/BackLink'
import { useLocale } from '../i18n/LocaleContext'
import { hdAccounts } from '../mock/wallet'

export function HdWalletDetail() {
  const { t, locale } = useLocale()

  return (
    <div className="page">
      <BackLink to="/balance" />
      <div className="page-kicker">{t.wallet}</div>
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
            <div>
              <div className="hd-account-name">
                {locale === 'zh' ? acc.nameZh : acc.nameEn}
              </div>
              <div className="hd-account-path">{acc.path}</div>
            </div>
            <div>
              <div className="hd-account-addr">{acc.addressShort}</div>
              <div className="hd-account-balance">
                {acc.balanceCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })} CKB
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
