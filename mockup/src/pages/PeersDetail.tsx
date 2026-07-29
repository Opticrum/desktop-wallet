import { BackLink } from '../components/BackLink'
import { useLocale } from '../i18n/LocaleContext'
import { peers } from '../mock/node'
import { nodeRuntime } from '../mock/node'

export function PeersDetail() {
  const { t } = useLocale()

  const total = nodeRuntime.peers
  const connected = peers.length
  const avgLatency = Math.round(
    peers.reduce((sum, p) => sum + p.latencyMs, 0) / Math.max(peers.length, 1),
  )

  return (
    <div className="page">
      <BackLink to="/node" />
      <div className="page-kicker">{t.nodeLabel}</div>
      <h1 className="page-title">{t.peerList}</h1>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">{t.peers}</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.connectedPeers}</div>
          <div className="stat-value">{connected}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.averageLatency}</div>
          <div className="stat-value">{avgLatency} ms</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.peerList}</th>
              <th>{t.peerAddr}</th>
              <th className="num">{t.latency}</th>
            </tr>
          </thead>
          <tbody>
            {peers.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.alias}</td>
                <td className="mono text-secondary" style={{ fontSize: 12 }}>{p.addr}</td>
                <td className="num">{p.latencyMs} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
