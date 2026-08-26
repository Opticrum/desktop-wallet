import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { useNode } from '../node/NodeContext'
import { useWalletNetwork } from '../wallet/WalletNetworkContext'
import { channels } from '../api/client'
import type { ChannelList } from '../api/types'
import { FiberSendModal } from './FiberSendModal'
import { FiberInvoiceModal } from './FiberInvoiceModal'

function IconSendOut() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

function IconRecvIn() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M17 7 7 17" />
      <path d="M16 17H7V8" />
    </svg>
  )
}

/**
 * Node connection KPIs — a compact 2×2 cluster beside the control panel
 * (outbound/inbound balance + node/channel counts).
 * Data comes from `channels.list`; the sums are frontend formulas.
 *
 * 出金/入金 are action cards: clicking opens a send-Fiber-transfer /
 * generate-invoice dialog, each capped at its own capacity.
 */
export function NodeKpiGrid({
  refreshKey = 0,
  onToast = () => {},
}: {
  refreshKey?: number
  onToast?: (msg: string) => void
}) {
  const { t } = useLocale()
  const { running, chain, targetId } = useNode()
  const { chain: walletChain } = useWalletNetwork()
  const networkMatched = !running || walletChain === chain
  const actionsReady = running && networkMatched
  const [data, setData] = useState<ChannelList | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)

  // Stable callbacks — the dialogs reset their state when `open` flips and
  // key their reset effect on `onClose`; a fresh arrow on every parent render
  // (e.g. after a toast) would wipe the generated invoice mid-flow.
  const closeSend = useCallback(() => setSendOpen(false), [])
  const closeInvoice = useCallback(() => setInvoiceOpen(false), [])

  const loadSeq = useRef(0)
  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    if (!running) {
      setData({ nodes: [] })
      return
    }
    try {
      const c = await channels.list()
      if (seq !== loadSeq.current) return
      setData(c)
    } catch {
      if (seq !== loadSeq.current) return
      setData({ nodes: [] })
    }
  }, [running])

  // Target / reachability: never keep another node's counts. Toolbar refresh
  // (refreshKey) re-fetches in place so the KPIs don't flash to zero.
  const seenTarget = useRef(targetId)
  useEffect(() => {
    const switched = seenTarget.current !== targetId
    seenTarget.current = targetId
    if (switched || !running) setData({ nodes: [] })
    if (!running) return
    void load()
    return () => {
      loadSeq.current += 1
    }
  }, [load, refreshKey, targetId])

  // The Fiber node starts/restarts independently of this component — watch the
  // runtime from NodeContext and re-fetch the overview on the stopped→running
  // transition so the node/channel KPIs catch up to the reconnected peers
  // (mirrors the peers list). `running` also disables 出金/入金 while down.
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

  const nodes = data?.nodes ?? []
  const all = nodes.flatMap((n) => n.channels)
  const outboundCkb = all.reduce((sum, c) => sum + c.localBalanceCkb, 0)
  const inboundCkb = all.reduce((sum, c) => sum + c.remoteBalanceCkb, 0)

  return (
    <section className="node-kpi-grid node-kpi-strip">
      <div className="kpi-grid conn-kpis">
        <button
          type="button"
          className="kpi kpi-btn kpi-outbound"
          onClick={() => setSendOpen(true)}
          disabled={!actionsReady}
          title={
            !running
              ? t.nodeNotRunning
              : !networkMatched
                ? t.networkMismatchBlocked
                : t.clickToSend
          }
        >
          <span className="kpi-role-icon" aria-hidden>
            <IconSendOut />
          </span>
          <div className="kpi-label">{t.nodeOutboundBalance}</div>
          <div className="kpi-metric">
            <div className="kpi-value">{outboundCkb.toLocaleString()}</div>
            <div className="kpi-sub">{t.unitCkb}</div>
          </div>
          <span className="kpi-hint">
            {actionsReady ? (
              <>
                <IconSendOut />
                {t.clickToSend}
              </>
            ) : !running ? (
              t.nodeNotRunning
            ) : (
              t.networkMismatchBadge
            )}
          </span>
        </button>
        <button
          type="button"
          className="kpi kpi-btn kpi-inbound"
          onClick={() => setInvoiceOpen(true)}
          disabled={!actionsReady}
          title={
            !running
              ? t.nodeNotRunning
              : !networkMatched
                ? t.networkMismatchBlocked
                : t.fiberInvoiceHint
          }
        >
          <span className="kpi-role-icon" aria-hidden>
            <IconRecvIn />
          </span>
          <div className="kpi-label">{t.nodeInboundBalance}</div>
          <div className="kpi-metric">
            <div className="kpi-value">{inboundCkb.toLocaleString()}</div>
            <div className="kpi-sub">{t.unitCkb}</div>
          </div>
          <span className="kpi-hint">
            {actionsReady ? (
              <>
                <IconRecvIn />
                {t.fiberInvoiceHint}
              </>
            ) : !running ? (
              t.nodeNotRunning
            ) : (
              t.networkMismatchBadge
            )}
          </span>
        </button>
        <div className="kpi">
          <div className="kpi-label">{t.nodeKpiNodes}</div>
          <div className="kpi-metric">
            <div className="kpi-value">{nodes.length}</div>
            <div className="kpi-sub">{t.nodeKpiNodesUnit}</div>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.nodeKpiChannels}</div>
          <div className="kpi-metric">
            <div className="kpi-value">{all.length}</div>
            <div className="kpi-sub">{t.nodeKpiChannelsUnit}</div>
          </div>
        </div>
      </div>

      <FiberSendModal
        open={sendOpen}
        onClose={closeSend}
        capCkb={outboundCkb}
        onToast={onToast}
      />
      <FiberInvoiceModal
        open={invoiceOpen}
        onClose={closeInvoice}
        capCkb={inboundCkb}
        network={chain}
        onToast={onToast}
      />
    </section>
  )
}
