import { useLocale } from '../i18n/LocaleContext'
import type { WalletTx, WalletTxKind } from '../api/types'
import { formatSignedCkb, shortHash, truncatedHash } from '../lib/wallet'
import { CopyableText } from './CopyableText'

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
    case 'rent_pledge':
      return t.txRentPledge
    case 'rent_extract':
      return t.txRentExtract
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

  if (transactions.length === 0) {
    return <div className="activity-empty">{t.txEmpty}</div>
  }

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
                  <CopyableText
                    value={tx.txHash}
                    display={truncatedHash(tx.txHash)}
                    className="mono activity-sub-hash"
                  />
                ) : (
                  <CopyableText value={tx.txHash} display={shortHash(tx.txHash)} className="mono" />
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
