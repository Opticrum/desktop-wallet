import { useCallback, useEffect, useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { CopyableText } from './CopyableText'
import { useLocale } from '../i18n/LocaleContext'
import { channels } from '../api/client'
import type { ChannelNode } from '../api/types'
import { stateToBucket } from '../lib/node'

type Props = {
  onToast: (msg: string) => void
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function NodeConnectionsSection({ onToast }: Props) {
  const { t } = useLocale()
  const [nodes, setNodes] = useState<ChannelNode[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [connectOpen, setConnectOpen] = useState(false)
  const [connectAlias, setConnectAlias] = useState('')
  const [connectAddr, setConnectAddr] = useState('')
  const [channelFormOpen, setChannelFormOpen] = useState<string | null>(null)
  const [channelCapacity, setChannelCapacity] = useState('1000')
  const [channelBaseFee, setChannelBaseFee] = useState('1000')
  const [channelFeeRate, setChannelFeeRate] = useState('100')
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const c = await channels.list()
      setNodes(c.nodes)
      // Default-expand the first node that already has channels, so the nested
      // layout is visible without collapsing the whole list.
      setExpanded((prev) => {
        if (prev.size > 0) return prev
        const first = c.nodes.find((n) => n.channels.length > 0)
        return first ? new Set([first.peer.id]) : new Set()
      })
    } catch {
      /* mock — best-effort */
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    onToast(t.nodeRefreshToast)
    window.setTimeout(() => setRefreshing(false), 600)
  }

  const handleConnect = async () => {
    setConnectOpen(false)
    try {
      await channels.connectPeer(connectAddr, undefined, connectAlias || undefined)
    } catch {
      /* mock — best-effort */
    }
    setConnectAlias('')
    setConnectAddr('')
    await load()
    onToast(t.nodeCreateToast)
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

  const openChannelForm = (node: ChannelNode) => {
    // Opening a channel on a collapsed node expands it first.
    setExpanded((prev) => new Set(prev).add(node.peer.id))
    setChannelCapacity('1000')
    setChannelBaseFee('1000')
    setChannelFeeRate('100')
    setChannelFormOpen(node.peer.id)
  }

  const handleCreateChannel = async (peerId: string) => {
    setChannelFormOpen(null)
    const capacityCkb = Number(channelCapacity.replace(/,/g, '')) || 0
    try {
      await channels.openChannel(
        peerId,
        Math.round(capacityCkb * 1e8),
        Number(channelBaseFee) || undefined,
        Number(channelFeeRate) || undefined,
      )
    } catch {
      /* mock — best-effort */
    }
    await load()
    onToast(t.nodeCreateToast)
  }

  const handleCloseChannel = async (id: string) => {
    setPendingCloseId(null)
    try {
      await channels.closeChannel(id, false)
    } catch {
      /* mock — best-effort */
    }
    await load()
    onToast(t.nodeDeleteToast)
  }

  const handleDisconnect = async (id: string) => {
    setPendingRemoveId(null)
    try {
      await channels.disconnectPeer(id)
    } catch {
      /* mock — best-effort */
    }
    await load()
    onToast(t.nodeDeleteToast)
  }

  return (
    <>
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
            <button className="btn-primary" onClick={handleConnect}>
              {t.nodeFormCreate}
            </button>
          </div>
        </div>
      )}

      {/* Node list — each node expands to its nested channels */}
      <div className="conn-list">
        {nodes.map((node) => {
          const isOpen = expanded.has(node.peer.id)
          const nodeOutboundCkb = node.channels.reduce((sum, c) => sum + c.localBalanceCkb, 0)
          const nodeInboundCkb = node.channels.reduce((sum, c) => sum + c.remoteBalanceCkb, 0)
          const nodeAlias = node.peer.alias ?? node.peer.id
          return (
            <div key={node.peer.id} className={`conn-card${isOpen ? ' open' : ''}`}>
              <div className="conn-card-head">
                <button
                  type="button"
                  className="conn-card-main"
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? t.nodeCollapse : t.nodeExpand} ${nodeAlias}`}
                  onClick={() => toggle(node.peer.id)}
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
                  <span className="conn-alias">{nodeAlias}</span>
                  <span className="conn-count">
                    {node.channels.length} {t.nodeChannelCount}
                  </span>
                  <span className="conn-liq">
                    <span className="conn-liq-out">
                      {t.nodeOutbound} {round1(nodeOutboundCkb).toLocaleString()}
                    </span>
                    <span className="conn-liq-sep">·</span>
                    <span className="conn-liq-in">
                      {t.nodeInbound} {round1(nodeInboundCkb).toLocaleString()}
                    </span>
                    <span className="conn-liq-unit">CKB</span>
                  </span>
                </button>

                <div className="conn-actions">
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setPendingRemoveId(node.peer.id)}
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
                      <CopyableText value={node.peer.addr ?? ''} />
                    </span>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => openChannelForm(node)}
                    >
                      + {t.nodeNewChannel}
                    </button>
                  </div>

                  {channelFormOpen === node.peer.id && (
                    <div className="panel inline-form conn-form">
                      <div className="form-row">
                        <label className="form-label">{t.nodeFormCapacity}</label>
                        <input
                          className="form-input"
                          placeholder="1000"
                          inputMode="decimal"
                          value={channelCapacity}
                          onChange={(e) => setChannelCapacity(e.target.value)}
                        />
                      </div>
                      <div className="form-row">
                        <label className="form-label">{t.nodeFormBaseFee}</label>
                        <input
                          className="form-input"
                          placeholder="1000"
                          inputMode="numeric"
                          value={channelBaseFee}
                          onChange={(e) => setChannelBaseFee(e.target.value)}
                        />
                      </div>
                      <div className="form-row">
                        <label className="form-label">{t.nodeFormFeeRate}</label>
                        <input
                          className="form-input"
                          placeholder="100"
                          inputMode="numeric"
                          value={channelFeeRate}
                          onChange={(e) => setChannelFeeRate(e.target.value)}
                        />
                      </div>
                      <div className="form-actions">
                        <button className="btn-secondary" onClick={() => setChannelFormOpen(null)}>
                          {t.nodeFormCancel}
                        </button>
                        <button
                          className="btn-primary"
                          onClick={() => handleCreateChannel(node.peer.id)}
                        >
                          {t.nodeFormCreate}
                        </button>
                      </div>
                    </div>
                  )}

                  {node.channels.length === 0 && channelFormOpen !== node.peer.id && (
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
                          const bucket = stateToBucket(ch.state)
                          const localPct =
                            ch.capacityCkb > 0
                              ? Math.round((ch.localBalanceCkb / ch.capacityCkb) * 100)
                              : 0
                          const remotePct = 100 - localPct
                          return (
                            <tr key={ch.channelId}>
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
                                <span className={`badge ${bucket}`}>{bucket}</span>
                              </td>
                              <td className="row-action">
                                <button
                                  className="row-action-btn"
                                  onClick={() => setPendingCloseId(ch.channelId)}
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
        onConfirm={() => pendingCloseId && handleCloseChannel(pendingCloseId)}
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
        onConfirm={() => pendingRemoveId && handleDisconnect(pendingRemoveId)}
      />
    </>
  )
}
