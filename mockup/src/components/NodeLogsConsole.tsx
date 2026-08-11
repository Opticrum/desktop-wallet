import { useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { logs } from '../mock/node'
import { BottomDrawer } from './BottomDrawer'
import { LogViewer } from './LogViewer'

type LogLevel = (typeof logs)[number]['level']

const LOG_LEVELS: LogLevel[] = ['INFO', 'WARN', 'ERROR']

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
 * Collapsed: an overview bar with per-level counts and a button that opens
 * the full log viewer in a bottom-up drawer. Expanded: the latest 5 entries
 * as a terminal console.
 */
export function NodeLogsConsole() {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [activeLevels, setActiveLevels] = useState<Record<LogLevel, boolean>>({
    INFO: true,
    WARN: true,
    ERROR: true,
  })

  const stats = { INFO: 0, WARN: 0, ERROR: 0 }
  for (const line of logs) stats[line.level] += 1

  const visibleLogs = logs.filter((line) => activeLevels[line.level])

  const toggleLevel = (level: LogLevel) =>
    setActiveLevels((prev) => ({ ...prev, [level]: !prev[level] }))

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

        <button
          type="button"
          className="nlc-full-btn"
          aria-label={t.viewAllLogs}
          title={t.viewAllLogs}
          onClick={() => setLogsOpen(true)}
        >
          <ExpandIcon />
        </button>
      </div>

      {expanded && (
        <div className="nlc-viewer">
          <LogViewer lines={logs.slice(0, 5)} scrollable />
        </div>
      )}

      <BottomDrawer
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        ariaLabel={t.recentLogs}
      >
        <div className="drawer-filter" role="group" aria-label={t.logFilterLabel}>
          {LOG_LEVELS.map((level) => {
            const active = activeLevels[level]
            return (
              <button
                key={level}
                type="button"
                className={`filter-chip${active ? ` active-${level.toLowerCase()}` : ''}`}
                aria-pressed={active}
                disabled={stats[level] === 0}
                onClick={() => toggleLevel(level)}
              >
                {level}
                <span className="filter-chip-count">{stats[level]}</span>
              </button>
            )
          })}
        </div>
        {visibleLogs.length > 0 ? (
          <LogViewer lines={visibleLogs} />
        ) : (
          <div className="filter-empty">{t.logFilterEmpty}</div>
        )}
      </BottomDrawer>
    </section>
  )
}
