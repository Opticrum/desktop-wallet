import { useLocale } from '../i18n/LocaleContext'
import type { Tx } from '../mock/wallet'

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

/**
 * "Moderate" truncation — keep enough context on both ends to be identifiable
 * (12 prefix + 12 suffix = 24 visible hex chars + ellipsis) without spilling
 * onto multiple lines. The full hash is exposed via the native browser
 * tooltip (title attr) on hover.
 */
function truncatedHash(hash: string) {
  return `${hash.slice(0, 12)}…${hash.slice(-12)}`
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

export function TransactionTable({
  transactions,
  fullHash = false,
  compact = false,
}: {
  transactions: Tx[]
  fullHash?: boolean
  /** Single-line rows without the tx hash — used by the wallet module. */
  compact?: boolean
}) {
  const { t, locale } = useLocale()

  if (compact) {
    return (
      <div className="activity activity-compact">
        {transactions.map((tx) => (
          <div key={tx.id} className="activity-row">
            <div className="activity-main">
              <span className={`activity-dot ${tx.type}`} aria-hidden />
              <span className="activity-compact-text">
                {txLabel(tx.type, t)}
                <span className="activity-compact-date">
                  {new Date(tx.timestamp).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
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
                {fullHash ? (
                  <span
                    className="mono activity-sub-hash"
                    title={tx.txHash}
                  >
                    {truncatedHash(tx.txHash)}
                  </span>
                ) : (
                  <span className="mono">{shortHash(tx.txHash)}</span>
                )}
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
