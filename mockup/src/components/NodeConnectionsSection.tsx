import { useEffect, useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { CopyableText } from './CopyableText'
import { useLocale } from '../i18n/LocaleContext'
import { connectedNodes, type ConnectedNode } from '../mock/channels'

type Props = {
  onToast: (msg: string) => void
  /** Set by the sidebar's top-hub "connect" — opens the form pre-filled. */
  connectRequest: { alias: string; addr: string } | null
  onConnectHandled: () => void
}

// Seed the default expansion with the first node that already has channels,
// so the nested layout is visible without collapsing the whole list.
const firstWithChannelsId = connectedNodes.find((n) => n.channels.length > 0)?.id

const round1 = (n: number) => Math.round(n * 10) / 10

export function NodeConnectionsSection({ onToast, connectRequest, onConnectHandled }: Props) {
  const { t } = useLocale()
  // Channel data lives in state so the refresh button can re-drive the
  // KPI row, per-node liquidity and the channel tables together.
  const [nodes, setNodes] = useState<ConnectedNode[]>(connectedNodes)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(firstWithChannelsId ? [firstWithChannelsId] : []),
  )
  const [connectOpen, setConnectOpen] = useState(false)
  const [connectAlias, setConnectAlias] = useState('')
  const [connectAddr, setConnectAddr] = useState('')
  const [channelFormOpen, setChannelFormOpen] = useState<string | null>(null)
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

  // A top-hub "connect" from the sidebar opens the form and pre-fills it.
  useEffect(() => {
    if (!connectRequest) return
    setConnectAlias(connectRequest.alias)
    setConnectAddr(connectRequest.addr)
    setConnectOpen(true)
    onConnectHandled()
  }, [connectRequest, onConnectHandled])

  const nodeChannels = nodes.flatMap((n) => n.channels)
  const outboundCkb = nodeChannels.reduce((sum, c) => sum + c.localBalanceCkb, 0)
  const inboundCkb = nodeChannels.reduce((sum, c) => sum + c.remoteBalanceCkb, 0)

  const handleRefresh = () => {
    setRefreshing(true)
    // Simulate a re-fetch: nudge each channel's local/remote split.
    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        channels: node.channels.map((ch) => {
          const drift = (Math.random() - 0.5) * ch.capacityCkb * 0.08
          const local = round1(Math.max(0, Math.min(ch.capacityCkb, ch.localBalanceCkb + drift)))
          return { ...ch, localBalanceCkb: local, remoteBalanceCkb: round1(ch.capacityCkb - local) }
        }),
      })),
    )
    onToast(t.nodeRefreshToast)
    window.setTimeout(() => setRefreshing(false), 600)
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const openChannelForm = (node: ConnectedNode) => {
    // Opening a channel on a collapsed node expands it first.
    setExpanded((prev) => new Set(prev).add(node.id))
    setChannelFormOpen(node.id)
  }

  return (
    <>
      {/* KPI row: node-wide out/in balances + node/channel counts */}
      <div className="kpi-grid conn-kpis">
        <div className="kpi">
          <div className="kpi-label">
            {t.nodeOutboundBalance} <span className="kpi-label-unit">CKB</span>
          </div>
          <div className="kpi-value">{outboundCkb.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            {t.nodeInboundBalance} <span className="kpi-label-unit">CKB</span>
          </div>
          <div className="kpi-value">{inboundCkb.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.nodeKpiNodes}</div>
          <div className="kpi-value">{nodes.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.nodeKpiChannels}</div>
          <div className="kpi-value">{nodeChannels.length}</div>
        </div>
      </div>

      {/* Toolbar: refresh + new-connection actions */}
      <div className="node-tabbar">
        <button
          type="button"
          className="node-refresh-btn"
          onClick={handleRefresh}
          aria-label={t.nodeRefresh}
          title={t.nodeRefresh}
        >
          <svg
            className={refreshing ? 'spin' : ''}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
          </svg>
        </button>
        <button
          type="button"
          className={`node-tabbar-action${connectOpen ? ' btn-secondary' : ' btn-primary'}`}
          aria-expanded={connectOpen}
          onClick={() => setConnectOpen((o) => !o)}
        >
          {connectOpen ? t.nodeFormCancel : `+ ${t.nodeNewConnection}`}
        </button>
      </div>

      {/* Create node connection form */}
      {connectOpen && (
        <div className="panel inline-form">
          <div className="form-row">
            <label className="form-label">{t.nodeFormPeerAlias}</label>
            <input
              className="form-input"
              placeholder="merchant-node"
              value={connectAlias}
              onChange={(e) => setConnectAlias(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">{t.nodeFormPeerAddr}</label>
            <input
              className="form-input"
              placeholder="/ip4/1.2.3.4/tcp/8115"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
              value={connectAddr}
              onChange={(e) => setConnectAddr(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setConnectOpen(false)}>
              {t.nodeFormCancel}
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setConnectOpen(false)
                onToast(t.nodeCreateToast)
              }}
            >
              {t.nodeFormCreate}
            </button>
          </div>
        </div>
      )}

      {/* Node list — each node expands to its nested channels */}
      <div className="conn-list">
        {nodes.map((node) => {
          const isOpen = expanded.has(node.id)
          const nodeOutboundCkb = node.channels.reduce((sum, c) => sum + c.localBalanceCkb, 0)
          const nodeInboundCkb = node.channels.reduce((sum, c) => sum + c.remoteBalanceCkb, 0)
          return (
            <div key={node.id} className={`conn-card${isOpen ? ' open' : ''}`}>
              <div className="conn-card-head">
                <button
                  type="button"
                  className="conn-card-main"
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? t.nodeCollapse : t.nodeExpand} ${node.alias}`}
                  onClick={() => toggle(node.id)}
                >
                  <span className="conn-expander" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                  <span className="peer-dot connected" />
                  <span className="conn-alias">{node.alias}</span>
                  <span className="conn-count">
                    {node.channels.length} {t.nodeChannelCount}
                  </span>
                  <span className="conn-liq">
                    <span className="conn-liq-out">
                      {t.nodeOutbound} {nodeOutboundCkb.toLocaleString()}
                    </span>
                    <span className="conn-liq-sep">·</span>
                    <span className="conn-liq-in">
                      {t.nodeInbound} {nodeInboundCkb.toLocaleString()}
                    </span>
                    <span className="conn-liq-unit">CKB</span>
                  </span>
                </button>

                <div className="conn-actions">
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setPendingRemoveId(node.id)}
                    aria-label={t.nodeRemovePeer}
                    title={t.nodeRemovePeer}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="conn-panel">
                  <div className="conn-panel-head">
                    <span className="conn-panel-addr">
                      <CopyableText value={node.addr} />
                    </span>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => openChannelForm(node)}
                    >
                      + {t.nodeNewChannel}
                    </button>
                  </div>

                  {channelFormOpen === node.id && (
                    <div className="panel inline-form conn-form">
                      <div className="form-row">
                        <label className="form-label">{t.nodeFormCapacity}</label>
                        <input className="form-input" placeholder="1000" inputMode="decimal" />
                      </div>
                      <div className="form-row">
                        <label className="form-label">{t.nodeFormBaseFee}</label>
                        <input className="form-input" placeholder="1000" inputMode="numeric" />
                      </div>
                      <div className="form-row">
                        <label className="form-label">{t.nodeFormFeeRate}</label>
                        <input className="form-input" placeholder="100" inputMode="numeric" />
                      </div>
                      <div className="form-actions">
                        <button className="btn-secondary" onClick={() => setChannelFormOpen(null)}>
                          {t.nodeFormCancel}
                        </button>
                        <button
                          className="btn-primary"
                          onClick={() => {
                            setChannelFormOpen(null)
                            onToast(t.nodeCreateToast)
                          }}
                        >
                          {t.nodeFormCreate}
                        </button>
                      </div>
                    </div>
                  )}

                  {node.channels.length === 0 && channelFormOpen !== node.id && (
                    <div className="conn-empty">{t.nodeNoChannels}</div>
                  )}

                  {node.channels.length > 0 && (
                    <table className="data-table data-table-sm conn-ch-table">
                      <thead>
                        <tr>
                          <th>{t.nodeOnchainTx}</th>
                          <th>{t.capacity}</th>
                          <th>{t.local}</th>
                          <th>{t.remote}</th>
                          <th>{t.state}</th>
                          <th className="row-action" aria-label={t.nodeCloseChannel} />
                        </tr>
                      </thead>
                      <tbody>
                        {node.channels.map((ch) => {
                          const localPct =
                            ch.capacityCkb > 0
                              ? Math.round((ch.localBalanceCkb / ch.capacityCkb) * 100)
                              : 0
                          const remotePct = 100 - localPct
                          return (
                            <tr key={ch.id}>
                              <td>
                                <span className="conn-txhash mono">{ch.txHash}</span>
                              </td>
                              <td>
                                <div className="ch-capacity-val">
                                  {ch.capacityCkb.toLocaleString()} CKB
                                </div>
                                <div className="ch-capacity-bar">
                                  <div
                                    className="ch-capacity-bar-local"
                                    style={{ width: `${localPct}%` }}
                                  />
                                  <div
                                    className="ch-capacity-bar-remote"
                                    style={{ width: `${remotePct}%` }}
                                  />
                                </div>
                              </td>
                              <td className="ch-balance-local">
                                {ch.localBalanceCkb.toLocaleString()} CKB
                              </td>
                              <td>{ch.remoteBalanceCkb.toLocaleString()} CKB</td>
                              <td>
                                <span className={`badge ${ch.state}`}>{ch.state}</span>
                              </td>
                              <td className="row-action">
                                <button
                                  className="row-action-btn"
                                  onClick={() => setPendingCloseId(ch.id)}
                                  aria-label={t.nodeCloseChannel}
                                  title={t.nodeCloseChannel}
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Close channel confirm */}
      <ConfirmModal
        open={!!pendingCloseId}
        title={t.nodeConfirmDeleteTitle}
        body={t.nodeConfirmDeleteChannelBody}
        confirmLabel={t.nodeDeleteConfirm}
        cancelLabel={t.nodeDeleteCancel}
        danger
        onCancel={() => setPendingCloseId(null)}
        onConfirm={() => {
          setPendingCloseId(null)
          onToast(t.nodeDeleteToast)
        }}
      />

      {/* Disconnect node confirm */}
      <ConfirmModal
        open={!!pendingRemoveId}
        title={t.nodeConfirmDeleteTitle}
        body={t.nodeConfirmDeletePeerBody}
        confirmLabel={t.nodeDeleteConfirm}
        cancelLabel={t.nodeDeleteCancel}
        danger
        onCancel={() => setPendingRemoveId(null)}
        onConfirm={() => {
          setPendingRemoveId(null)
          onToast(t.nodeDeleteToast)
        }}
      />
    </>
  )
}
