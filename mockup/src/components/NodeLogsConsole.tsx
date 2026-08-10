import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'
import { logs } from '../mock/node'
import { LogViewer } from './LogViewer'

function ConsoleIcon() {
  return (
    <svg
      className="nlc-console-icon"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3" />
      <path d="M12 15h5" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg
      className="nlc-chevron"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg
      className="nlc-full-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

/**
 * Collapsible node running-log console, shown below the node control panel.
 * Collapsed: an overview bar with per-level counts and a link to the full
 * log viewer. Expanded: the latest 5 entries as a terminal console.
 */
export function NodeLogsConsole() {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)

  const stats = { INFO: 0, WARN: 0, ERROR: 0 }
  for (const line of logs) stats[line.level] += 1

  return (
    <section className="panel node-logs-console">
      <div className="nlc-bar">
        <button
          type="button"
          className="nlc-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((o) => !o)}
        >
          <ConsoleIcon />
          <span className="nlc-title">{t.nodeLogsSection}</span>
          <span className="nlc-stats">
            <span className="nlc-stat nlc-stat-info">INFO {stats.INFO}</span>
            <span className="nlc-stat nlc-stat-warn">WARN {stats.WARN}</span>
            <span className="nlc-stat nlc-stat-error">ERROR {stats.ERROR}</span>
          </span>
          <ChevronIcon />
        </button>

        <Link
          to="/node/logs"
          className="nlc-full-btn"
          aria-label={t.viewAllLogs}
          title={t.viewAllLogs}
        >
          <ExpandIcon />
        </Link>
      </div>

      {expanded && (
        <div className="nlc-viewer">
          <LogViewer lines={logs.slice(0, 5)} scrollable />
        </div>
      )}
    </section>
  )
}
