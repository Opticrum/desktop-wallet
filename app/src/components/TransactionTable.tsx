import { useLocale } from '../i18n/LocaleContext'
import type { WalletTx, WalletTxKind } from '../api/types'
import { formatSignedCkb, shortHash, truncatedHash } from '../lib/wallet'

export function txLabel(type: WalletTxKind, t: ReturnType<typeof useLocale>['t']) {
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
  transactions: WalletTx[]
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
              <span className={`activity-dot ${tx.kind}`} aria-hidden />
              <span className="activity-compact-text">
                {txLabel(tx.kind, t)}
                <span className="activity-compact-date">
                  {new Date(tx.timestampMs).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
            </div>
            <div className={`activity-amount ${tx.amountCkb >= 0 ? 'positive' : 'negative'}`}>
              {formatSignedCkb(tx.amountCkb)}
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
            <span className={`activity-dot ${tx.kind}`} aria-hidden />
            <div>
              <div className="activity-title">{txLabel(tx.kind, t)}</div>
              <div className="activity-sub">
                {new Date(tx.timestampMs).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' · '}
                {fullHash ? (
                  <span className="mono activity-sub-hash" title={tx.txHash}>
                    {truncatedHash(tx.txHash)}
                  </span>
                ) : (
                  <span className="mono">{shortHash(tx.txHash)}</span>
                )}
              </div>
            </div>
          </div>
          <div className={`activity-amount ${tx.amountCkb >= 0 ? 'positive' : 'negative'}`}>
            {formatSignedCkb(tx.amountCkb)}
          </div>
        </div>
      ))}
    </div>
  )
}
