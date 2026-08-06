import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmModal } from './ConfirmModal'
import { CopyableText } from './CopyableText'
import { NodeConfigModal } from './config/NodeConfigModal'
import { useLocale } from '../i18n/LocaleContext'
import { useNode } from '../node/NodeContext'
import { nodeRuntime, nodeWatchtower, type WatchtowerConfig } from '../mock/node'

type Props = {
  onToast: (msg: string) => void
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

export function NodeControlPanel({ onToast }: Props) {
  const { t, locale } = useLocale()
  const { chain } = useNode()
  const [running, setRunning] = useState(true)
  const [stopOpen, setStopOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [watchtower, setWatchtower] = useState<WatchtowerConfig>(nodeWatchtower)

  const handleStop = () => {
    setStopOpen(false)
    setRunning(false)
    onToast(t.nodeStoppedToast)
  }

  const handleStart = () => {
    setRunning(true)
    onToast(t.nodeStartedToast)
  }

  return (
    <section className="panel node-control-panel">
      {/* ── Status header row ─────────────────────────────────────────── */}
      <div className="ncp-status-bar">
        <div className="ncp-status-left">
          {running ? (
            <span className="pulse-dot" />
          ) : (
            <span className="dot-static" />
          )}
          <span className={`ncp-status-badge${running ? '' : ' stopped'}`}>
            {running ? t.nodeRunning : t.nodeStopped}
          </span>
          <span className="ncp-meta-line">
            {nodeRuntime.nodeAlias}
            <span className="ncp-meta-sep">·</span>
            {chain}
            <span className="ncp-meta-sep">·</span>
            {nodeRuntime.uptimeHours}h
            <span className="ncp-meta-sep">·</span>
            <Link to="/node/logs" className="ncp-logs-link">
              {t.viewNodeLogs} →
            </Link>
          </span>
        </div>
        <div className="ncp-actions">
          {running ? (
            <button type="button" className="btn-danger btn-icon" onClick={() => setStopOpen(true)}>
              <IconStop />
              <span>{t.nodeStop}</span>
            </button>
          ) : (
            <button type="button" className="btn-primary btn-icon" onClick={handleStart}>
              <IconPlay />
              <span>{t.nodeStart}</span>
            </button>
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

      {/* ── Detail rows ──────────────────────────────────────────────── */}
      <div className="ncp-detail-rows">
        <div className="ncp-detail-row">
          <span className="ncp-label">{t.fiberPubkey}</span>
          <span className="ncp-value mono ncp-pubkey">
            <CopyableText value={nodeRuntime.fiberPubkey} />
          </span>
        </div>
        <div className="ncp-detail-row">
          <span className="ncp-label">{t.fiberAddr}</span>
          <span className="ncp-value mono">
            <CopyableText value={nodeRuntime.fiberAddr} />
          </span>
        </div>
      </div>

      {/* ── Watchtower — set at startup, displayed as local / remote + URL ── */}
      <div className="ncp-watchtower">
        <div className="ncp-wt-head">
          <span className="ncp-wt-title">
            <IconShield />
            {t.watchtower}
          </span>
          <div className="ncp-wt-value">
            <span className={`wt-badge wt-${watchtower.mode}`}>
              {watchtower.mode === 'local' ? t.watchtowerLocal : t.watchtowerRemote}
            </span>
            {watchtower.mode === 'remote' && watchtower.endpoint && (
              <span className="wt-url mono">{watchtower.endpoint}</span>
            )}
          </div>
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
        watchtower={watchtower}
        onWatchtowerChange={setWatchtower}
      />
      <span style={{ display: 'none' }}>{locale}</span>
    </section>
  )
}
