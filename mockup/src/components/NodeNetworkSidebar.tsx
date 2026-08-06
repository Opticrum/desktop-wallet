import { useLocale } from '../i18n/LocaleContext'
import { networkTopology } from '../mock/network'

function formatCapacity(ckb: number) {
  const fmt = (n: number) => (n % 1 === 0 ? `${n}` : `${n.toFixed(1)}`)
  if (ckb >= 1_000_000) return `${fmt(ckb / 1_000_000)}M`
  if (ckb >= 1_000) return `${fmt(ckb / 1_000)}K`
  return `${Math.round(ckb)}`
}

export function NodeNetworkSidebar() {
  const { t } = useLocale()
  const { totalNodes, totalPublicChannels, totalCapacityCkb, hubs } = networkTopology
  const capacityM = `${(totalCapacityCkb / 1_000_000).toFixed(1)}M`

  return (
    <aside className="node-aside">
      {/* Network topology stats — aggregated from get_network_graph */}
      <section className="panel">
        <div className="section-head">
          <h2>{t.networkTopology}</h2>
        </div>
        <div className="topo-stats">
          <div className="topo-stat">
            <div className="topo-stat-value">{totalNodes.toLocaleString()}</div>
            <div className="topo-stat-label">{t.networkNodes}</div>
          </div>
          <div className="topo-stat">
            <div className="topo-stat-value">{totalPublicChannels.toLocaleString()}</div>
            <div className="topo-stat-label">{t.publicChannels}</div>
          </div>
          <div className="topo-stat topo-stat-wide">
            <div className="topo-stat-value">{capacityM} CKB</div>
            <div className="topo-stat-label">{t.networkCapacity}</div>
          </div>
        </div>
      </section>

      {/* Highest-capacity hubs — ranked by summed channel capacity */}
      <section className="panel">
        <div className="section-head">
          <h2>
            {t.topHubs}
            <span className="section-head-suffix">Top 10</span>
          </h2>
        </div>
        <ol className="topo-hub-list">
          {hubs.map((hub) => (
            <li key={hub.pubkey} className="topo-hub-row">
              <span className="topo-hub-rank">{hub.rank}</span>
              <span className="topo-hub-name" title={hub.pubkey}>
                {hub.nodeName}
              </span>
              <span className="topo-hub-capacity">{formatCapacity(hub.capacityCkb)}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  )
}
