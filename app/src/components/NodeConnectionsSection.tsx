import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { CkbTxModal, useCkbTx } from './CkbTxModal'
import { ChannelListDrawer } from './ChannelListDrawer'
import { ChannelOpenModal, type ChannelOpenState } from './ChannelOpenModal'
import { CopyableText } from './CopyableText'
import { useLocale } from '../i18n/LocaleContext'
import { channels } from '../api/client'
import { toCommandError } from '../api/types'
import { useNode } from '../node/NodeContext'
import type { Channel, ChannelNode } from '../api/types'
import { stateToBucket } from '../lib/node'
import { formatTimestamp } from '../lib/liquidity'
import { commandErrorText } from '../lib/errors'
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

/** Refresh control — same arrow as the peer-card / toolbar refresh. */
function IconRefresh({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      className={spinning ? 'spin' : ''}
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
  )
}

/** Close-channel control — a vivid X so the destructive action is findable. */
function IconClose() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
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

/** Strip `0x` and lowercase so temp ids / pubkeys compare across encodings. */
const normHex = (s: string) => s.replace(/^0x/i, '').toLowerCase()

/**
 * Fiber lists a new channel as soon as negotiation starts — often still
 * pending, not `ChannelReady`. Poll until that row appears (new id, or the
 * `open_channel` temp id). Throws `channel_open_timeout` so the open modal
 * can localize it.
 */
async function waitForChannelListed(
  peerId: string,
  knownIds: Set<string>,
  tempId: string | null,
  onList: (nodes: ChannelNode[]) => void,
  timeoutMs = 60_000,
): Promise<string> {
  const peer = normHex(peerId)
  const temp = tempId ? normHex(tempId) : ''
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const list = await channels.list()
      onList(list.nodes)
      const found = (list.nodes.find((n) => normHex(n.peer.id) === peer)?.channels ?? []).find(
        (c) => {
          const id = normHex(c.channelId)
          return (temp && id === temp) || !knownIds.has(id)
        },
      )
      if (found) return found.channelId
    } catch {
      /* transient — keep polling */
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw Object.assign(new Error('timeout waiting for the node to list the channel'), {
    code: 'channel_open_timeout',
  })
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

function channelStateLabel(state: string, t: {
  nodeStateActive: string
  nodeStatePending: string
  nodeStateClosing: string
  nodeStateNegotiating: string
  nodeStateCollaborating: string
  nodeStateSigning: string
  nodeStateAwaitingSigs: string
  nodeStateAwaitingReady: string
  nodeStateStale: string
}) {
  switch (state) {
    case 'ChannelReady':
      return t.nodeStateActive
    case 'ShuttingDown':
    case 'Closed':
      return t.nodeStateClosing
    case 'NegotiatingFunding':
      return t.nodeStateNegotiating
    case 'CollaboratingFundingTx':
      return t.nodeStateCollaborating
    case 'SigningCommitment':
      return t.nodeStateSigning
    case 'AwaitingTxSignatures':
      return t.nodeStateAwaitingSigs
    case 'AwaitingChannelReady':
      return t.nodeStateAwaitingReady
    case 'Stale':
      return t.nodeStateStale
    default:
      return t.nodeStatePending
  }
}

function ChannelGauge({
  ch,
  frozen,
  refreshing,
  onRefresh,
  onClose,
}: {
  ch: Channel
  frozen: boolean
  refreshing: boolean
  onRefresh: () => void
  onClose: (channelId: string, force: boolean) => void
}) {
  const { t } = useLocale()
  const bucket = stateToBucket(ch.state)
  const localPct = ch.capacityCkb > 0 ? Math.round((ch.localBalanceCkb / ch.capacityCkb) * 100) : 0
  const remotePct = 100 - localPct

  return (
    <div className="conn-gauge">
      <div className="conn-gauge-top">
        <div className="conn-gauge-id">
          <span className="conn-gauge-id-k">{t.nodeChannelId}</span>
          <CopyableText value={ch.channelId} className="mono" />
        </div>
        <span
          className={`badge ${bucket}`}
          title={[ch.state, ch.stateFlags].filter(Boolean).join(' · ')}
        >
          {channelStateLabel(ch.state, t)}
        </span>
        <span className={`conn-pill${ch.isPublic ? ' is-public' : ''}`}>
          {ch.isPublic ? t.nodeChannelPublic : t.nodeChannelPrivate}
        </span>
        <div className="conn-gauge-actions">
          <button
            type="button"
            className="conn-gauge-refresh"
            onClick={onRefresh}
            title={frozen ? t.connFrozen : t.nodeRefresh}
            aria-label={frozen ? t.connFrozen : t.nodeRefresh}
            disabled={frozen}
          >
            <IconRefresh spinning={refreshing} />
          </button>
          <button
            type="button"
            className="conn-gauge-close"
            onClick={() => onClose(ch.channelId, bucket === 'closing')}
            title={frozen ? t.connFrozen : t.nodeCloseChannel}
            aria-label={frozen ? t.connFrozen : t.nodeCloseChannel}
            disabled={frozen}
          >
            <IconClose />
          </button>
        </div>
      </div>
      <div className="conn-gauge-io">
        <div className="conn-gauge-side is-local">
          <span className="conn-gauge-k">{t.nodeOutbound}</span>
          <span className="conn-gauge-v">
            <span className="conn-gauge-n">{ch.localBalanceCkb.toLocaleString()}</span>
            <span className="conn-gauge-unit">{t.unitCkb}</span>
          </span>
        </div>
        <div className="conn-gauge-side is-remote">
          <span className="conn-gauge-k">{t.nodeInbound}</span>
          <span className="conn-gauge-v">
            <span className="conn-gauge-n">{ch.remoteBalanceCkb.toLocaleString()}</span>
            <span className="conn-gauge-unit">{t.unitCkb}</span>
          </span>
        </div>
      </div>
      <div className="conn-gauge-track">
        <div className="ch-capacity-bar" aria-hidden="true">
          <div className="ch-capacity-bar-local" style={{ width: `${localPct}%` }} />
          <div className="ch-capacity-bar-remote" style={{ width: `${remotePct}%` }} />
        </div>
      </div>
      <div className="conn-gauge-meta">
        <span className="conn-gauge-meta-item">
          <span className="conn-gauge-meta-label">{t.nodeOnchainTx}</span>
          <CopyableText
            value={ch.txHash}
            display={shortHash(ch.txHash)}
            className="mono"
          />
        </span>
        <span className="conn-gauge-meta-item">
          <span className="conn-gauge-meta-label">{t.capacity}</span>
          <span className="conn-gauge-meta-value">
            {ch.capacityCkb.toLocaleString()} CKB
          </span>
        </span>
        <span className="conn-gauge-meta-item">
          <span className="conn-gauge-meta-label">{t.nodeFeeRateShort}</span>
          <span className="conn-gauge-meta-value">
            {ch.feeRatePpm != null ? `${ch.feeRatePpm.toLocaleString()} ppm` : '—'}
          </span>
        </span>
        <span className="conn-gauge-meta-item">
          <span className="conn-gauge-meta-label">{t.nodeChannelCreated}</span>
          <span className="conn-gauge-meta-value">{formatTimestamp(ch.createdAtMs)}</span>
        </span>
      </div>
    </div>
  )
}

export function NodeConnectionsSection({ onToast, onRefresh }: Props) {
  const { t } = useLocale()
  // Runtime/frozen gating comes from the shared NodeContext (it polls
  // `node.get_runtime`). The channel list itself refreshes only on demand.
  const { running, targetId } = useNode()
  const [nodes, setNodes] = useState<ChannelNode[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [refreshingNode, setRefreshingNode] = useState<string | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [connectAlias, setConnectAlias] = useState('')
  const [connectAddr, setConnectAddr] = useState('')
  const [channelListOpen, setChannelListOpen] = useState<string | null>(null)
  const [pendingCloseId, setPendingCloseId] = useState<{ channelId: string; force: boolean } | null>(
    null,
  )
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const [channelOpen, setChannelOpen] = useState<ChannelOpenState>({ status: 'idle' })
  const channelOpenRun = useRef(0)

  const frozen = !running

  // The instant the node stops, dismiss in-flight forms/confirmations so no
  // half-open action lingers in the frozen state.
  useEffect(() => {
    if (!frozen) return
    setConnectOpen(false)
    setChannelListOpen(null)
    setPendingCloseId(null)
    setPendingRemoveId(null)
    channelOpenRun.current++
    setChannelOpen({ status: 'idle' })
  }, [frozen])

  const load = useCallback(async () => {
    try {
      const c = await channels.list()
      setNodes(c.nodes)
    } catch {
      /* best-effort */
    }
  }, [])

  // Channel close runs behind the 3-step confirmation modal; `load` (the
  // channel list refresh) fires once the operation settles. Open uses a
  // separate node-list wait dialog — Fiber never surfaces the funding tx.
  const { ckbTxState, runCkbTx, closeCkbTx } = useCkbTx(load)

  useEffect(() => {
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

  const handleCreateChannel = async (peerId: string, capacity: string, baseFee: string, feeRate: string) => {
    const capacityCkb = Number(capacity.replace(/,/g, '')) || 0
    const runId = ++channelOpenRun.current
    setChannelOpen({ status: 'submitting' })
    try {
      const snapshot = await channels.list()
      if (runId !== channelOpenRun.current) return
      setNodes(snapshot.nodes)
      const knownIds = new Set(
        (snapshot.nodes.find((n) => normHex(n.peer.id) === normHex(peerId))?.channels ?? []).map(
          (c) => normHex(c.channelId),
        ),
      )
      const opened = await channels.openChannel(
        peerId,
        Math.round(capacityCkb * 1e8),
        Number(baseFee) || undefined,
        Number(feeRate) || undefined,
      )
      if (runId !== channelOpenRun.current) return
      setChannelOpen({ status: 'waiting' })
      const channelId = await waitForChannelListed(
        peerId,
        knownIds,
        opened.tempId || opened.channelId,
        (next) => {
          if (runId !== channelOpenRun.current) return
          setNodes(next)
        },
      )
      if (runId !== channelOpenRun.current) return
      setChannelOpen({ status: 'ready', channelId })
      onToast(t.nodeCreateToast)
    } catch (e) {
      if (runId !== channelOpenRun.current) return
      setChannelOpen({
        status: 'failed',
        error: commandErrorText(t, toCommandError(e)),
      })
    }
  }

  const handleCloseChannel = async (id: string, force: boolean) => {
    setPendingCloseId(null)
    setChannelListOpen(null)
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

  const listNode = channelListOpen
    ? (nodes.find((n) => n.peer.id === channelListOpen) ?? null)
    : null

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

      <div className="conn-list">
        {nodes.map((node) => {
          const nodeOutboundCkb = node.channels.reduce((sum, c) => sum + c.localBalanceCkb, 0)
          const nodeInboundCkb = node.channels.reduce((sum, c) => sum + c.remoteBalanceCkb, 0)
          const nodeCapacityCkb = nodeOutboundCkb + nodeInboundCkb
          const localPct =
            nodeCapacityCkb > 0 ? Math.round((nodeOutboundCkb / nodeCapacityCkb) * 100) : 0
          const nodeAlias = node.peer.alias ?? node.peer.id
          const nodeAliasDisplay = midTruncate(nodeAlias, 18)
          return (
            <div key={node.peer.id} className="conn-unit">
              <div className="conn-card">
                <div className="conn-card-head">
                <div className="conn-card-top">
                  <div className="conn-card-title">
                    <span className="peer-dot connected" />
                    <span className="conn-alias">{nodeAliasDisplay}</span>
                  </div>
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

                <div className="conn-card-sub">
                  {node.peer.version && <span className="conn-sub-item">v{node.peer.version}</span>}
                  <span className="conn-sub-item conn-liq-out">
                    {t.nodeOutbound} {round1(nodeOutboundCkb).toLocaleString()}
                  </span>
                  <span className="conn-sub-item conn-liq-in">
                    {t.nodeInbound} {round1(nodeInboundCkb).toLocaleString()}
                  </span>
                  <span className="conn-sub-item conn-liq-unit">{t.unitCkb}</span>
                </div>

                <div className="conn-card-endpoints">
                  <div className="conn-chip">
                    <span className="conn-chip-k">{t.nodePeerPubkey}</span>
                    <CopyableText value={node.peer.id} />
                  </div>
                  <div className="conn-chip">
                    <span className="conn-chip-k">{t.nodePeerAddr}</span>
                    {node.peer.addr ? (
                      <CopyableText value={node.peer.addr} />
                    ) : (
                      <span className="conn-chip-empty">—</span>
                    )}
                  </div>
                </div>
              </div>
              </div>

              <button
                type="button"
                className={`conn-card-foot${node.channels.length === 0 ? ' is-create' : ''}`}
                onClick={() => setChannelListOpen(node.peer.id)}
                disabled={frozen}
                title={frozen ? t.connFrozen : undefined}
              >
                {node.channels.length > 0 && (
                  <span
                    className="conn-card-foot-fill"
                    style={{ width: `${localPct}%` }}
                    aria-hidden="true"
                  />
                )}
                <span className="conn-card-foot-label">
                  {node.channels.length === 0
                    ? t.nodeNoChannels
                    : `${node.channels.length} ${t.nodeChannelCount}`}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      <ChannelListDrawer
        open={channelListOpen !== null}
        frozen={frozen}
        node={listNode}
        dismissible={pendingCloseId === null && channelOpen.status === 'idle'}
        onClose={() => setChannelListOpen(null)}
        onCreate={(capacity, baseFee, feeRate) => {
          if (channelListOpen) handleCreateChannel(channelListOpen, capacity, baseFee, feeRate)
        }}
      >
        <div className="conn-channels">
          {listNode
            ? listNode.channels.map((ch) => (
                <ChannelGauge
                  key={ch.channelId}
                  ch={ch}
                  frozen={frozen}
                  refreshing={refreshingNode === listNode.peer.id}
                  onRefresh={() => refreshNode(listNode.peer.id)}
                  onClose={(channelId, force) => setPendingCloseId({ channelId, force })}
                />
              ))
            : null}
        </div>
      </ChannelListDrawer>

      {/* Close channel confirm — force close when the channel is already closing */}
      <ConfirmModal
        open={pendingCloseId !== null}
        title={pendingCloseId?.force ? t.nodeForceCloseTitle : t.nodeConfirmDeleteTitle}
        body={pendingCloseId?.force ? t.nodeForceCloseBody : t.nodeConfirmDeleteChannelBody}
        confirmLabel={t.nodeDeleteConfirm}
        cancelLabel={t.nodeDeleteCancel}
        danger
        overDrawer
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
      <CkbTxModal
        state={ckbTxState}
        onClose={closeCkbTx}
        overDrawer={channelListOpen !== null}
      />
      <ChannelOpenModal
        state={channelOpen}
        onClose={() => {
          channelOpenRun.current++
          setChannelOpen({ status: 'idle' })
        }}
        overDrawer={channelListOpen !== null}
      />
    </div>
  )
}
