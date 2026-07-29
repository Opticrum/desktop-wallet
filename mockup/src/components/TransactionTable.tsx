import { useLocale } from '../i18n/LocaleContext'
import type { Tx } from '../mock/wallet'

function shortHash(hash: string) {
  return `${hash.slice(0, 7)}…${hash.slice(-5)}`
}

export function TransactionTable({ transactions }: { transactions: Tx[] }) {
  const { t, locale } = useLocale()

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>{t.txType}</th>
          <th className="num">{t.amount}</th>
          <th>{t.time}</th>
          <th>{t.transaction}</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => (
          <tr key={tx.id}>
            <td>
              <span className={`badge ${tx.type}`}>{tx.type}</span>
            </td>
            <td className={`num ${tx.amountCkb >= 0 ? 'positive' : 'negative'}`}>
              {tx.amountCkb >= 0 ? '+' : ''}
              {tx.amountCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })} CKB
            </td>
            <td className="text-secondary">
              {new Date(tx.timestamp).toLocaleString(
                locale === 'zh' ? 'zh-CN' : 'en-US',
              )}
            </td>
            <td className="mono text-tertiary" style={{ fontSize: 12 }}>{shortHash(tx.txHash)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
