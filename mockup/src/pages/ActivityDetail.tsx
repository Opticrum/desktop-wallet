import { BackLink } from '../components/BackLink'
import { TransactionTable } from '../components/TransactionTable'
import { useLocale } from '../i18n/LocaleContext'
import { wallet } from '../mock/wallet'

export function ActivityDetail() {
  const { t } = useLocale()

  return (
    <div className="page">
      <BackLink to="/node" />
      <h1 className="page-title">{t.txHistory}</h1>
      <p className="page-lead">{t.sendReceiveDesc}</p>

      <TransactionTable transactions={wallet.txs} fullHash />
    </div>
  )
}