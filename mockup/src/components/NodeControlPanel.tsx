import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { CopyableText } from './CopyableText'
import { useLocale } from '../i18n/LocaleContext'
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

function IconRestart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function NodeControlPanel({ onToast }: Props) {
  const { t, locale } = useLocale()
  const [running, setRunning] = useState(true)
  const [stopOpen, setStopOpen] = useState(false)
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

  const handleRestart = () => {
    onToast(t.nodeRestartToast)
  }

  const handleWatchtowerSwitch = () => {
    const next: WatchtowerConfig =
      watchtower.mode === 'local'
        ? {
            mode: 'remote',
            endpoint: '/ip4/45.77.65.221/tcp/8115',
            sessions: watchtower.sessions,
            latencyMs: 38,
          }
        : { mode: 'local', sessions: watchtower.sessions }
    setWatchtower(next)
    onToast(t.watchtowerSwitchedToast)
  }

  return (
    <section className="panel node-control-panel">
      <header className="ncp-header">
        <div className="ncp-id">
          <div className="ncp-status-row">
            <span className={`ncp-status-dot ${running ? 'running' : 'stopped'}`}>
              {running ? <span className="pulse-dot" /> : <span className="dot-static" />}
            </span>
            <span className="ncp-status-text">
              {running ? t.nodeRunning : t.nodeStopped}
            </span>
            <span className="ncp-divider">·</span>
            <span className="ncp-alias">{nodeRuntime.nodeAlias}</span>
            <span className="ncp-divider">·</span>
            <span className="ncp-chain">{nodeRuntime.chain}</span>
          </div>
        </div>
        <div className="ncp-actions">
          {running ? (
            <button
              type="button"
              className="btn-danger btn-icon"
              onClick={() => setStopOpen(true)}
            >
              <IconStop />
              <span>{t.nodeStop}</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary btn-icon"
              onClick={handleStart}
            >
              <IconPlay />
              <span>{t.nodeStart}</span>
            </button>
          )}
          <button
            type="button"
            className="btn-secondary btn-icon"
            onClick={handleRestart}
            disabled={!running}
          >
            <IconRestart />
            <span>{t.nodeRestart}</span>
          </button>
        </div>
      </header>

      <div className="ncp-grid">
        <div className="ncp-row" style={{ gridColumn: '1 / -1' }}>
          <span className="ncp-label">{t.fiberPubkey}</span>
          <span className="ncp-value mono ncp-pubkey">
            <CopyableText value={nodeRuntime.fiberPubkey} />
          </span>
        </div>
        <div className="ncp-row">
          <span className="ncp-label">{t.chain}</span>
          <span className="ncp-value">
            {nodeRuntime.chain}
            <span className="ncp-meta"> · #{nodeRuntime.tipHeight.toLocaleString()}</span>
            <span className="ncp-meta"> · {nodeRuntime.synced ? t.synced : '…'}</span>
          </span>
        </div>
        <div className="ncp-row">
          <span className="ncp-label">{t.uptime}</span>
          <span className="ncp-value">{nodeRuntime.uptimeHours}h</span>
        </div>
      </div>

      <div className="ncp-watchtower">
        <div className="ncp-wt-left">
          <div className="ncp-label">{t.watchtower}</div>
          <div className="ncp-wt-status">
            <span className={`wt-mode wt-${watchtower.mode}`}>
              {watchtower.mode === 'local' ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="4" y="3" width="16" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  {t.watchtowerLocal}
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                  {t.watchtowerRemote}
                </>
              )}
            </span>
            <span className="ncp-wt-detail">
              {watchtower.mode === 'remote' && watchtower.endpoint ? (
                <span className="mono">{watchtower.endpoint}</span>
              ) : null}
              <span className="ncp-meta">
                {' · '}{watchtower.sessions} {t.watchtowerSessions}
                {watchtower.mode === 'remote' && watchtower.latencyMs
                  ? ` · ${watchtower.latencyMs} ms`
                  : ''}
              </span>
            </span>
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary btn-with-chevron"
          onClick={handleWatchtowerSwitch}
        >
          <span>
            {watchtower.mode === 'local'
              ? t.watchtowerSwitchRemote
              : t.watchtowerSwitchLocal}
          </span>
          <IconChevron />
        </button>
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
      <span style={{ display: 'none' }}>{locale}</span>
    </section>
  )
}