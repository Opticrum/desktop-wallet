import { useEffect, useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { CopyableText } from './CopyableText'
import { NodeConfigModal } from './config/NodeConfigModal'
import { useLocale } from '../i18n/LocaleContext'
import { useNode } from '../node/NodeContext'
import { useWalletNetwork } from '../wallet/WalletNetworkContext'
import { node } from '../api/client'
import { toCommandError } from '../api/types'
import type { NodeConfig, NodeRuntime, WatchtowerConfig } from '../api/types'
import { fiberRpcUrl, withHttpScheme } from '../lib/node'

type Props = {
  onToast: (msg: string) => void
  /** Bumped by the page's refresh control to re-fetch the runtime. */
  refreshKey?: number
  /** Open the local CKB wallet drawer (unlock / create). */
  onRequestWallet?: () => void
  /** Open the external-node edit dialog for the currently selected target. */
  onEditConnection?: () => void
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z" />
    </svg>
  )
}

function IconStop() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IconTerminal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 17 6-6-6-6" />
      <path d="M12 19h8" />
    </svg>
  )
}

/** Watchtower mode badge label — wire modes (builtin | standalone | disabled). */
function watchtowerLabel(mode: WatchtowerConfig['mode'], t: ReturnType<typeof useLocale>['t']): string {
  if (mode === 'builtin') return t.wtBuiltin
  if (mode === 'standalone') return t.wtStandalone
  return t.wtDisabled
}

/** Live uptime text — minute granularity: "0h 0m" / "0h 5m" / "1h 23m". */
function formatUptime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m}m`
}

export function NodeControlPanel({
  onToast,
  refreshKey = 0,
  onRequestWallet,
  onEditConnection,
}: Props) {
  const { t, locale } = useLocale()
  const { chain, kind, running: ctxRunning, starting: ctxStarting, applyRuntime } = useNode()
  const { chain: walletChain, status: walletStatus } = useWalletNetwork()
  const [runtime, setRuntime] = useState<NodeRuntime | null>(null)
  // Live-uptime ticker anchor — bumped every second while the node is up so
  // the "运行时长" counts up smoothly between the 5s runtime polls.
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [stopOpen, setStopOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [watchtower, setWatchtower] = useState<WatchtowerConfig>({ mode: 'builtin', endpoint: null })
  // Embedded node cold start takes a while — show a clear starting state.
  const [startRequested, setStartRequested] = useState(false)
  // Persisted node config — `rpc.listening_addr` feeds the Fiber 端口 row and
  // the fnn-cli launch URL. Refetched when the config modal closes.
  const [config, setConfig] = useState<NodeConfig | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const [installUrl, setInstallUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const poll = () =>
      node
        .getRuntime()
        .then((r) => {
          if (!alive) return
          setRuntime(r)
          setWatchtower(r.watchtower)
          // Keep NodeContext (side-menu mismatch `!`, KPI gates) in sync with
          // this panel's poll — especially after switching to an external.
          applyRuntime(r)
        })
        .catch(() => {})
    poll()
    // Poll so the pubkey/address reflect the running node once it's up, and
    // re-fetch immediately when the page's refresh control bumps `refreshKey`.
    const id = window.setInterval(poll, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [refreshKey, kind, applyRuntime])

  // 1s ticker for the live uptime readout — runs only while the node reports a
  // start anchor (startedAtMs), so a stopped node doesn't re-render every second.
  useEffect(() => {
    if (runtime?.startedAtMs == null) return
    setNowMs(Date.now())
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [runtime?.startedAtMs])

  const refetchConfig = () =>
    node
      .getConfig()
      .then(setConfig)
      .catch(() => {})

  useEffect(() => {
    refetchConfig()
  }, [])

  const running = runtime?.running ?? ctxRunning
  // "Starting" survives page switches: the backend reports it on the runtime,
  // and the local `startRequested` covers the window while the IPC call flies.
  const starting = startRequested || (runtime?.starting ?? ctxStarting)
  const alias = runtime?.alias ?? '—'
  // Prefer the just-polled runtime chain (external `chain_hash` / stored probe)
  // over a possibly stale NodeContext value from the previous target.
  const nodeChain = runtime?.chain ?? chain
  // Uptime anchored by the backend's `startedAtMs`; the 1s ticker counts it up
  // live, so it reads "0h 0m → 0h 5m → 1h 23m" instead of whole hours.
  const startedAtMs = runtime?.startedAtMs ?? null
  const uptimeText = startedAtMs != null ? formatUptime(Math.max(0, nowMs - startedAtMs)) : '0h 0m'
  const fiberPubkey = runtime?.fiberPubkey || '—'
  const fiberAddr = runtime?.fiberAddr || '—'
  const walletGate = {
    hasWallet: walletStatus?.hasWallet ?? true,
    unlocked: walletStatus?.unlocked ?? false,
  }
  const startDisabled = !walletGate.hasWallet || !walletGate.unlocked
  const isExternal = kind === 'external'
  // External: show mismatch whenever chains differ (persisted probe survives a
  // brief RPC blip). Builtin: only while up — a stopped process has no live peer.
  const networkMismatch =
    walletChain !== nodeChain && (isExternal ? !starting : running && !starting)

  const handleStop = async () => {
    setStopOpen(false)
    try {
      await node.stop()
      setRuntime((r) => (r ? { ...r, running: false, startedAtMs: null } : r))
    } catch {
      /* mock — best-effort */
    }
    onToast(t.nodeStoppedToast)
  }

  const handleStart = async () => {
    setStartRequested(true)
    try {
      const r = await node.start()
      setRuntime(r)
      setWatchtower(r.watchtower)
      onToast(t.nodeStartedToast)
    } catch (e) {
      onToast(`${t.nodeStartFailed}${toCommandError(e).message}`)
    } finally {
      setStartRequested(false)
    }
  }

  // fnn-cli drives the node's RPC. Builtin: only once the process is up (the
  // local listen addr isn't answering while stopped/booting). External: the
  // creation URL is always known, so the trigger stays available.
  const nodeReady = running && !starting
  const rpcUrl = isExternal
    ? runtime?.rpcUrl
      ? withHttpScheme(runtime.rpcUrl)
      : null
    : config && nodeReady
      ? fiberRpcUrl(config)
      : null

  const handleOpenFnnCli = async () => {
    if (!rpcUrl) return
    try {
      const status = await node.fnnCliStatus()
      if (status.installed) {
        await node.openFnnCli(rpcUrl)
      } else {
        setInstallUrl(status.installUrl)
        setInstallOpen(true)
      }
    } catch (e) {
      onToast(`${t.fnnCliOpenFailed}${toCommandError(e).message}`)
    }
  }

  return (
    <section className="panel node-control-panel">
      {/* ── Status header row ─────────────────────────────────────────── */}
      <div className="ncp-status-bar">
        <div className="ncp-status-left">
          <span className={starting ? 'pulse-dot starting' : running ? 'pulse-dot' : 'dot-static'} />
          <span className={`ncp-status-badge${running ? '' : starting ? ' starting' : ' stopped'}`}>
            {isExternal
              ? running
                ? t.nodeReachable
                : t.nodeUnreachable
              : starting
                ? t.nodePreparing
                : running
                  ? t.nodeRunning
                  : t.nodeStopped}
          </span>
          <span className="ncp-meta-line">
            {alias}
            {!isExternal && (
              <>
                <span className="ncp-meta-sep">·</span>
                {uptimeText}
              </>
            )}
          </span>
        </div>
        <div className="ncp-status-right">
          <span
            className={`ncp-net-badge net-${nodeChain}${networkMismatch ? ' is-mismatch' : ''}`}
            title={networkMismatch ? t.networkMismatchTip : undefined}
            aria-label={
              networkMismatch
                ? `${t.networkMismatchBadge}: ${
                    nodeChain === 'mainnet' ? t.networkMainnet : t.networkTestnet
                  }`
                : nodeChain === 'mainnet'
                  ? t.networkMainnet
                  : t.networkTestnet
            }
          >
            {nodeChain === 'mainnet' ? t.networkMainnet : t.networkTestnet}
            {networkMismatch ? <span className="ncp-net-mismatch-mark">!</span> : null}
          </span>
          <div className="ncp-actions">
            {isExternal ? (
              <button
                type="button"
                className="btn-secondary btn-icon"
                onClick={onEditConnection}
              >
                <IconGear />
                <span>{t.nodeEditConnection}</span>
              </button>
            ) : (
              <>
                {running ? (
                  <button type="button" className="btn-danger btn-icon" onClick={() => setStopOpen(true)}>
                    <IconStop />
                    <span>{t.nodeStop}</span>
                  </button>
                ) : (
                  <span className="ncp-start">
                    <button
                      type="button"
                      className="btn-primary btn-icon"
                      disabled={startDisabled || starting}
                      onClick={handleStart}
                    >
                      {starting ? <span className="btn-spin" aria-hidden /> : <IconPlay />}
                      <span>{starting ? t.nodeStarting : t.nodeStart}</span>
                    </button>
                    {startDisabled && !starting && (
                      <button
                        type="button"
                        className="ncp-start-tip"
                        onClick={onRequestWallet}
                      >
                        {!walletGate.hasWallet ? t.nodeStartNoWallet : t.nodeStartLocked}
                      </button>
                    )}
                  </span>
                )}
                <button
                  type="button"
                  className="btn-secondary btn-icon"
                  onClick={() => setConfigOpen(true)}
                >
                  <IconGear />
                  <span>{t.nodeConfig}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {networkMismatch && (
        <div className="ncp-mismatch" role="status">
          <span className="ncp-mismatch-mark" aria-hidden>
            !
          </span>
          <div className="ncp-mismatch-text">
            <span className="ncp-mismatch-title">{t.networkMismatchTitle}</span>
            <span className="ncp-mismatch-hint">{t.networkMismatchTip}</span>
          </div>
        </div>
      )}

      {/* ── Detail rows ──────────────────────────────────────────────── */}
      <div className="ncp-detail-rows">
        <div className="ncp-detail-row">
          <span className="ncp-label">{t.fiberPubkey}</span>
          <span className="ncp-value mono ncp-pubkey">
            <CopyableText value={fiberPubkey} />
          </span>
        </div>
        <div className="ncp-detail-row">
          <span className="ncp-label">{t.fiberAddr}</span>
          <span className="ncp-value mono">
            <CopyableText value={fiberAddr} />
          </span>
        </div>
        <div className="ncp-detail-row">
          <span className="ncp-label">{t.fiberVersion}</span>
          <span className="ncp-value mono">{runtime?.version || '—'}</span>
        </div>
        <div className="ncp-detail-row">
          <span className="ncp-label">{t.fiberPort}</span>
          <span className="ncp-value mono ncp-pubkey">
            {rpcUrl ? (
              <span
                className="ncp-cli-trigger"
                role="button"
                tabIndex={0}
                aria-label={t.fnnCliOpen}
                onClick={handleOpenFnnCli}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleOpenFnnCli()
                  }
                }}
              >
                <span className="ncp-cli-trigger-text">{rpcUrl}</span>
                <span className="ncp-cli-trigger-hint" aria-hidden="true">
                  <IconTerminal />
                  {t.fnnCliOpen}
                </span>
              </span>
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>

      {!isExternal && (
      <div className="ncp-watchtower">
        <div className="ncp-wt-capsule">
          {watchtower.mode === 'standalone' && watchtower.endpoint && (
            <span className="wt-url mono">{watchtower.endpoint}</span>
          )}
          <span className={`wt-badge wt-${watchtower.mode}`}>
            {watchtowerLabel(watchtower.mode, t)}
          </span>
          <span className="ncp-wt-title">
            <IconShield />
            {t.watchtower}
          </span>
        </div>
      </div>
      )}

      <ConfirmModal
        open={stopOpen}
        title={t.stopNodeTitle}
        body={t.stopNodeBody}
        confirmLabel={t.nodeStop}
        cancelLabel={t.nodeDeleteCancel}
        danger
        onCancel={() => setStopOpen(false)}
        onConfirm={handleStop}
      />
      <ConfirmModal
        open={installOpen}
        title={t.fnnCliNotInstalledTitle}
        body={t.fnnCliNotInstalledBody}
        confirmLabel={t.fnnCliInstall}
        cancelLabel={t.nodeDeleteCancel}
        onCancel={() => setInstallOpen(false)}
        onConfirm={() => {
          setInstallOpen(false)
          if (installUrl) node.openUrl(installUrl).catch(() => {})
        }}
      />
      <NodeConfigModal
        open={configOpen}
        onClose={() => {
          setConfigOpen(false)
          refetchConfig()
        }}
        onToast={onToast}
        onWatchtowerChange={setWatchtower}
      />
      <span style={{ display: 'none' }}>{locale}</span>
    </section>
  )
}
