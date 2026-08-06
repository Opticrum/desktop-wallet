import { useState, type KeyboardEvent } from 'react'
import { CopyableText } from './CopyableText'
import { useLocale } from '../i18n/LocaleContext'
import { networkTopology } from '../mock/network'
import { connectedNodes } from '../mock/channels'
import { nodeRuntime } from '../mock/node'

function formatCapacity(ckb: number) {
  const fmt = (n: number) => (n % 1 === 0 ? `${n}` : `${n.toFixed(1)}`)
  if (ckb >= 1_000_000) return `${fmt(ckb / 1_000_000)}M`
  if (ckb >= 1_000) return `${fmt(ckb / 1_000)}K`
  return `${Math.round(ckb)}`
}

type Props = {
  /** Fired when the user clicks "connect" on an unconnected hub. */
  onConnectNode: (alias: string, addr: string) => void
}

export function NodeNetworkSidebar({ onConnectNode }: Props) {
  const { t } = useLocale()
  const { totalNodes, totalPublicChannels, totalCapacityCkb, hubs } = networkTopology
  // Accordion: at most one hub row is expanded at a time.
  const [expandedHub, setExpandedHub] = useState<string | null>(null)
  const capacityM = `${(totalCapacityCkb / 1_000_000).toFixed(1)}M`

  const toggle = (pubkey: string) => {
    setExpandedHub((cur) => (cur === pubkey ? null : pubkey))
  }

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>, pubkey: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle(pubkey)
    }
  }

  return (
    <aside className="node-aside">
      {/* Network topology stats — aggregated from get_network_graph */}
      <section className="panel">
        <div className="section-head">
          <h2 className="node-section-title">{t.networkTopology}</h2>
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
          <h2 className="node-section-title">
            {t.topHubs}
            <span className="section-head-suffix">Top 10</span>
          </h2>
        </div>
        <ol className="topo-hub-list">
          {hubs.map((hub) => {
            const isExpanded = expandedHub === hub.pubkey
            const isConnected = connectedNodes.some((n) => n.alias === hub.nodeName)
            const isLocal = hub.nodeName === nodeRuntime.nodeAlias
            const canConnect = !isConnected && !isLocal
            const connectLabel = isLocal
              ? t.hubLocal
              : isConnected
                ? t.hubConnected
                : t.hubConnect
            return (
              <li key={hub.pubkey} className={`topo-hub-item${isExpanded ? ' open' : ''}`}>
                <div
                  className="topo-hub-row"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? t.nodeCollapse : t.nodeExpand} ${hub.nodeName}`}
                  onClick={() => toggle(hub.pubkey)}
                  onKeyDown={(e) => onRowKeyDown(e, hub.pubkey)}
                >
                  <span className="topo-hub-rank">{hub.rank}</span>
                  <span className="topo-hub-name" title={hub.pubkey}>
                    {hub.nodeName}
                  </span>
                  <span className="topo-hub-capacity">{formatCapacity(hub.capacityCkb)}</span>
                  <svg
                    className="topo-hub-chevron"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="topo-hub-detail">
                    <div className="topo-hub-detail-row">
                      <span className="topo-hub-detail-label">{t.fiberPubkey}</span>
                      <span className="topo-hub-detail-value">
                        <CopyableText value={hub.pubkey} />
                      </span>
                    </div>
                    <div className="topo-hub-detail-row">
                      <span className="topo-hub-detail-label">{t.capacity}</span>
                      <span className="topo-hub-detail-value">
                        {formatCapacity(hub.capacityCkb)} CKB
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-primary btn-sm topo-hub-connect"
                      disabled={!canConnect}
                      onClick={() => onConnectNode(hub.nodeName, hub.addr)}
                    >
                      {connectLabel}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </aside>
  )
}
