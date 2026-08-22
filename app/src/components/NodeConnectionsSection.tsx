import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { CkbTxModal, useCkbTx } from './CkbTxModal'
import { CopyableText } from './CopyableText'
import { useLocale } from '../i18n/LocaleContext'
import { channels } from '../api/client'
import { toCommandError } from '../api/types'
import { useNode } from '../node/NodeContext'
import type { ChannelNode } from '../api/types'
import { stateToBucket } from '../lib/node'
import { shortHash } from '../lib/wallet'

type Props = {
  onToast: (msg: string) => void
  /** Also refresh the node overview (control panel runtime) on toolbar refresh. */
  onRefresh?: () => void
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Pause bars — shown on the "operations frozen" notice while the node stops. */
function IconPause() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.3" />
      <rect x="14" y="5" width="4" height="14" rx="1.3" />
    </svg>
  )
}

/** Truncate a long hex/pubkey in the middle: `02ab91f4c5d…e3a9f8b6c1d2`. */
const midTruncate = (s: string, max: number) => {
  if (s.length <= max) return s
  const head = Math.floor((max - 1) / 2)
  const tail = max - 1 - head
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

/** Brief dwell so the "broadcast" step is legible before the confirm step. */
const CHANNEL_STEP_DWELL_MS = 400

/**
 * The fiber node builds + broadcasts the channel's funding tx internally, so the
 * app can only observe the channel lifecycle. Poll `channels.list` until the
 * peer's channel reaches `ChannelReady` (funding tx confirmed on-chain); returns
 * the funding tx hash when available. Throws on timeout so the modal surfaces it.
 */
async function waitForChannelReady(peerId: string, timeoutMs = 120_000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const list = await channels.list()
      const ready = list.nodes
        .find((n) => n.peer.id === peerId)
        ?.channels.find((c) => c.state === 'ChannelReady')
      if (ready) return ready.txHash || null
    } catch {
      /* transient — keep polling */
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('timeout waiting for the channel to open')
}

/** Poll `channels.list` until the channel leaves the list or is `Closed`. */
async function waitForChannelClosed(channelId: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const list = await channels.list()
      const ch = list.nodes.flatMap((n) => n.channels).find((c) => c.channelId === channelId)
      if (!ch || ch.state === 'Closed') return
    } catch {
      /* transient — keep polling */
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('timeout waiting for the channel to close')
}

export function NodeConnectionsSection({ onToast, onRefresh }: Props) {
  const { t } = useLocale()
  // Runtime/frozen gating comes from the shared NodeContext (it polls
  // `node.get_runtime`). The channel list itself refreshes only on demand — an
  // interval refresh re-runs the default-expand and pops collapsed peers open.
  const { running, targetId } = useNode()
  const [nodes, setNodes] = useState<ChannelNode[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [refreshingNode, setRefreshingNode] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [connectOpen, setConnectOpen] = useState(false)
  const [connectAlias, setConnectAlias] = useState('')
  const [connectAddr, setConnectAddr] = useState('')
  const [channelFormOpen, setChannelFormOpen] = useState<string | null>(null)
  const [channelCapacity, setChannelCapacity] = useState('1000')
  const [channelBaseFee, setChannelBaseFee] = useState('1000')
  const [channelFeeRate, setChannelFeeRate] = useState('100')
  const [pendingCloseId, setPendingCloseId] = useState<{ channelId: string; force: boolean } | null>(null)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

  const frozen = !running

  // The instant the node stops, dismiss in-flight forms/confirmations so no
  // half-open action lingers in the frozen state.
  useEffect(() => {
    if (!frozen) return
    setConnectOpen(false)
    setChannelFormOpen(null)
    setPendingCloseId(null)
    setPendingRemoveId(null)
  }, [frozen])

  // Auto-expand the first channel-bearing peer exactly once, on the first load
  // — a later refresh must never re-run this and pop a collapsed peer open.
  const initialExpandDone = useRef(false)
  const load = useCallback(async () => {
    try {
      const c = await channels.list()
      setNodes(c.nodes)
      if (!initialExpandDone.current) {
        initialExpandDone.current = true
        const first = c.nodes.find((n) => n.channels.length > 0)
        if (first) setExpanded(new Set([first.peer.id]))
      }
    } catch {
      /* best-effort */
    }
  }, [])

  // Channel open/close runs behind the 3-step confirmation modal; `load` (the
  // channel list refresh) fires once the operation settles.
  const { ckbTxState, runCkbTx, closeCkbTx } = useCkbTx(load)

  useEffect(() => {
    initialExpandDone.current = false
    load()
  }, [load, targetId])

  // When the node restarts, `channels.list` isn't re-fetched on its own — reload
  // peers immediately and a few times after, so peers that reconnect a beat
  // later show up without a manual Refresh click.
  const wasRunning = useRef(running)
  const runningRef = useRef(running)
  const restartRetries = useRef<number[]>([])
  useEffect(() => {
    const prev = wasRunning.current
    wasRunning.current = running
    runningRef.current = running
    if (!running || prev) return
    load()
    restartRetries.current.forEach((id) => window.clearTimeout(id))
    restartRetries.current = [2000, 5000, 10000].map((ms) =>
      window.setTimeout(() => {
        if (!runningRef.current) return // node stopped again — skip
        load()
      }, ms),
    )
  }, [running, load])
  useEffect(
    () => () => restartRetries.current.forEach((id) => window.clearTimeout(id)),
    [],
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    onRefresh?.()
    onToast(t.nodeRefreshToast)
    window.setTimeout(() => setRefreshing(false), 600)
  }

  /** Re-fetch channels and update just this node's card (per-peer refresh). */
  const refreshNode = async (nodeId: string) => {
    setRefreshingNode(nodeId)
    try {
      const c = await channels.list()
      const updated = c.nodes.find((n) => n.peer.id === nodeId)
      if (updated) {
        setNodes((prev) => prev.map((n) => (n.peer.id === nodeId ? updated : n)))
      } else {
        // The node vanished from the list — fall back to a full reload.
        await load()
      }
      onToast(t.nodeRefreshToast)
    } catch {
      onToast(t.nodeRefreshFailed)
    } finally {
      // Keep the spinner up for the whole RPC round-trip.
      setRefreshingNode((cur) => (cur === nodeId ? null : cur))
    }
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
      await runCkbTx(t.channelOpenLabel, async ({ advance }) => {
        await channels.openChannel(
          peerId,
          Math.round(capacityCkb * 1e8),
          Number(channelBaseFee) || undefined,
          Number(channelFeeRate) || undefined,
        )
        // The fiber node builds + broadcasts the funding tx internally — the app
        // observes only the channel lifecycle, so steps 1-2 advance on the RPC
        // returning and step 3 waits for the funding tx to confirm (ChannelReady).
        advance('broadcasting')
        await new Promise((r) => setTimeout(r, CHANNEL_STEP_DWELL_MS))
        advance('confirming')
        const fundingHash = await waitForChannelReady(peerId)
        return fundingHash ? { txHash: fundingHash } : null
      })
      await load()
      onToast(t.nodeCreateToast)
    } catch {
      /* best-effort — the 3-step modal surfaces the failure */
    }
  }

  const handleCloseChannel = async (id: string, force: boolean) => {
    setPendingCloseId(null)
    try {
      await runCkbTx(t.channelCloseLabel, async ({ advance }) => {
        await channels.closeChannel(id, force)
        advance('broadcasting')
        await new Promise((r) => setTimeout(r, CHANNEL_STEP_DWELL_MS))
        advance('confirming')
        await waitForChannelClosed(id)
        return null
      })
      await load()
      onToast(t.nodeDeleteToast)
    } catch {
      /* best-effort — the 3-step modal surfaces the failure */
    }
  }

  const handleDisconnect = async (id: string) => {
    setPendingRemoveId(null)
    try {
      await channels.disconnectPeer(id)
      await load()
      onToast(t.nodeDeleteToast)
    } catch (e) {
      onToast(`${t.nodeDeleteFailed}${toCommandError(e).message}`)
    }
  }

  return (
    <div className={`conn-section${frozen ? ' is-frozen' : ''}`}>
      {/* Toolbar: refresh + new-connection actions */}
      <div className="node-tabbar">
        <button
          type="button"
          className="node-refresh-btn"
          onClick={handleRefresh}
          aria-label={t.nodeRefresh}
          title={frozen ? t.connFrozen : t.nodeRefresh}
          disabled={frozen}
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
          disabled={frozen}
          title={frozen ? t.connFrozen : undefined}
        >
          {connectOpen ? t.nodeFormCancel : `+ ${t.nodeNewConnection}`}
        </button>
      </div>

      {/* Node-stopped notice — peer/channel operations freeze until it runs */}
      {frozen && (
        <div className="conn-frozen" role="status">
          <IconPause />
          <div className="conn-frozen-text">
            <span className="conn-frozen-title">{t.connFrozen}</span>
            <span className="conn-frozen-hint">{t.connFrozenHint}</span>
          </div>
        </div>
      )}

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
            <button className="btn-primary" onClick={handleConnect} disabled={frozen}>
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
          const nodeAliasDisplay = midTruncate(nodeAlias, 18)
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
                  <span className="conn-alias">{nodeAliasDisplay}</span>
                  {node.peer.version && <span className="conn-version">v{node.peer.version}</span>}
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
                    onClick={() => refreshNode(node.peer.id)}
                    aria-label={t.nodeRefresh}
                    title={frozen ? t.connFrozen : t.nodeRefresh}
                    disabled={frozen}
                  >
                    <svg
                      className={refreshingNode === node.peer.id ? 'spin' : ''}
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
                    className="row-action-btn"
                    onClick={() => setPendingRemoveId(node.peer.id)}
                    aria-label={t.nodeRemovePeer}
                    title={frozen ? t.connFrozen : t.nodeRemovePeer}
                    disabled={frozen}
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
                    <div className="conn-panel-meta">
                      <div className="conn-panel-pubkey">
                        <span className="conn-panel-label">{t.nodePeerPubkey}</span>
                        <CopyableText value={node.peer.id} />
                      </div>
                      <div className="conn-panel-addr">
                        <span className="conn-panel-label">{t.nodePeerAddr}</span>
                        <CopyableText value={node.peer.addr ?? ''} />
                      </div>
                    </div>
                  </div>

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
                                <CopyableText
                                  value={ch.txHash}
                                  display={ch.txHash.length > 20 ? shortHash(ch.txHash) : ch.txHash}
                                  className="conn-txhash mono"
                                />
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
                                  onClick={() =>
                                    setPendingCloseId({
                                      channelId: ch.channelId,
                                      // A channel already closing needs a force close to finish.
                                      force: stateToBucket(ch.state) === 'closing',
                                    })
                                  }
                                  aria-label={t.nodeCloseChannel}
                                  title={frozen ? t.connFrozen : t.nodeCloseChannel}
                                  disabled={frozen}
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

                  <div className="conn-panel-actions">
                    <button
                      type="button"
                      className="btn-secondary conn-new-channel"
                      onClick={() => openChannelForm(node)}
                      disabled={frozen}
                      title={frozen ? t.connFrozen : undefined}
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
                        <div className="form-label-line">
                          <label className="form-label">{t.nodeFormBaseFee}</label>
                          <span className="field-help">
                            <button type="button" className="field-help-btn" aria-label={t.walletHelp}>
                              ?
                            </button>
                            <span className="field-help-tip" role="tooltip">
                              {t.nodeFormBaseFeeHelp}
                            </span>
                          </span>
                        </div>
                        <input
                          className="form-input"
                          placeholder="1000"
                          inputMode="numeric"
                          value={channelBaseFee}
                          onChange={(e) => setChannelBaseFee(e.target.value)}
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-label-line">
                          <label className="form-label">{t.nodeFormFeeRate}</label>
                          <span className="field-help">
                            <button type="button" className="field-help-btn" aria-label={t.walletHelp}>
                              ?
                            </button>
                            <span className="field-help-tip" role="tooltip">
                              {t.nodeFormFeeRateHelp}
                            </span>
                          </span>
                        </div>
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
                          disabled={frozen}
                        >
                          {t.nodeFormCreate}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Close channel confirm */}
      {/* Close channel confirm — force close when the channel is already closing */}
      <ConfirmModal
        open={pendingCloseId !== null}
        title={pendingCloseId?.force ? t.nodeForceCloseTitle : t.nodeConfirmDeleteTitle}
        body={pendingCloseId?.force ? t.nodeForceCloseBody : t.nodeConfirmDeleteChannelBody}
        confirmLabel={t.nodeDeleteConfirm}
        cancelLabel={t.nodeDeleteCancel}
        danger
        onCancel={() => setPendingCloseId(null)}
        onConfirm={() =>
          pendingCloseId && handleCloseChannel(pendingCloseId.channelId, pendingCloseId.force)
        }
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
      <CkbTxModal state={ckbTxState} onClose={closeCkbTx} />
    </div>
  )
}
