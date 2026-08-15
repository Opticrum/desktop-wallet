import { useEffect, useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { CopyableText } from './CopyableText'
import { NodeConfigModal } from './config/NodeConfigModal'
import { useLocale } from '../i18n/LocaleContext'
import { useNode } from '../node/NodeContext'
import { node, wallet } from '../api/client'
import { toCommandError } from '../api/types'
import type { NodeRuntime, WatchtowerConfig } from '../api/types'

type Props = {
  onToast: (msg: string) => void
  /** Bumped by the page's refresh control to re-fetch the runtime. */
  refreshKey?: number
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

/** Watchtower mode badge label — wire modes (builtin | standalone | disabled). */
function watchtowerLabel(mode: WatchtowerConfig['mode'], t: ReturnType<typeof useLocale>['t']): string {
  if (mode === 'builtin') return t.wtBuiltin
  if (mode === 'standalone') return t.wtStandalone
  return t.wtDisabled
}

export function NodeControlPanel({ onToast, refreshKey = 0 }: Props) {
  const { t, locale } = useLocale()
  const { chain } = useNode()
  const [runtime, setRuntime] = useState<NodeRuntime | null>(null)
  const [stopOpen, setStopOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [watchtower, setWatchtower] = useState<WatchtowerConfig>({ mode: 'builtin', endpoint: null })
  // Embedded node cold start takes a while — show a clear starting state.
  const [startRequested, setStartRequested] = useState(false)
  // Node start requires the wallet unlocked (Fiber links a single CKB wallet).
  // Conservative default: locked until the summary confirms otherwise.
  const [walletGate, setWalletGate] = useState<{ hasWallet: boolean; unlocked: boolean }>({
    hasWallet: true,
    unlocked: false,
  })

  useEffect(() => {
    let alive = true
    const poll = () =>
      node
        .getRuntime()
        .then((r) => {
          if (!alive) return
          setRuntime(r)
          setWatchtower(r.watchtower)
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
  }, [refreshKey])

  useEffect(() => {
    let alive = true
    const check = () =>
      wallet
        .getSummary()
        .then((s) => {
          if (alive) setWalletGate({ hasWallet: s.hasWallet, unlocked: s.unlocked })
        })
        .catch(() => {})
    check()
    const id = window.setInterval(check, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const running = runtime?.running ?? false
  // "Starting" survives page switches: the backend reports it on the runtime,
  // and the local `startRequested` covers the window while the IPC call flies.
  const starting = startRequested || (runtime?.starting ?? false)
  const alias = runtime?.alias ?? '—'
  const uptimeHours = runtime?.uptimeHours ?? 0
  const fiberPubkey = runtime?.fiberPubkey || '—'
  const fiberAddr = runtime?.fiberAddr || '—'
  const startDisabled = !walletGate.hasWallet || !walletGate.unlocked

  const handleStop = async () => {
    setStopOpen(false)
    try {
      await node.stop()
      setRuntime((r) => (r ? { ...r, running: false } : r))
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

  return (
    <section className="panel node-control-panel">
      {/* ── Status header row ─────────────────────────────────────────── */}
      <div className="ncp-status-bar">
        <div className="ncp-status-left">
          <span className={starting ? 'pulse-dot starting' : running ? 'pulse-dot' : 'dot-static'} />
          <span className={`ncp-status-badge${running ? '' : starting ? ' starting' : ' stopped'}`}>
            {starting ? t.nodePreparing : running ? t.nodeRunning : t.nodeStopped}
          </span>
          <span className="ncp-meta-line">
            {alias}
            <span className="ncp-meta-sep">·</span>
            {uptimeHours}h
          </span>
        </div>
        <div className="ncp-status-right">
          <span className={`ncp-net-badge net-${chain}`}>
            {chain === 'mainnet' ? t.networkMainnet : t.networkTestnet}
          </span>
          <div className="ncp-actions">
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
                  <span className="ncp-start-tip" role="tooltip">
                    {!walletGate.hasWallet ? t.nodeStartNoWallet : t.nodeStartLocked}
                  </span>
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
          </div>
        </div>
      </div>

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
      </div>

      {/* ── Watchtower — derived from config, displayed as a status capsule ── */}
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
      <NodeConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onToast={onToast}
        onWatchtowerChange={setWatchtower}
      />
      <span style={{ display: 'none' }}>{locale}</span>
    </section>
  )
}
