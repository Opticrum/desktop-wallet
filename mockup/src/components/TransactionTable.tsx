import { useLocale } from '../i18n/LocaleContext'
import type { Tx } from '../mock/wallet'

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

function txLabel(type: Tx['type'], t: ReturnType<typeof useLocale>['t']) {
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

export function TransactionTable({ transactions }: { transactions: Tx[] }) {
  const { t, locale } = useLocale()

  return (
    <div className="activity">
      {transactions.map((tx) => (
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
                <span className="mono">{shortHash(tx.txHash)}</span>
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
  )
}
