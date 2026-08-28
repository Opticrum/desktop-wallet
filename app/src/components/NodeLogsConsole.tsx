import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { node } from '../api/client'
import type { LogLevel, NodeLog } from '../api/types'
import { logStats } from '../lib/node'
import { BottomDrawer } from './BottomDrawer'
import { LogViewer } from './LogViewer'

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
 *
 * Data comes from `node.get_logs` over IPC.
 */
export function NodeLogsConsole() {
  const { t } = useLocale()
  const consoleRef = useRef<HTMLElement>(null)
  const [logs, setLogs] = useState<NodeLog[]>([])
  const [expanded, setExpanded] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [activeLevels, setActiveLevels] = useState<Record<LogLevel, boolean>>({
    INFO: true,
    WARN: true,
    ERROR: true,
  })

  useEffect(() => {
    let alive = true
    const poll = () =>
      node
        .getLogs()
        .then((l) => {
          if (alive) setLogs(l)
        })
        .catch(() => {})
    poll()
    const id = window.setInterval(poll, 3000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  // Expanded console sits above the node page scroller / cell pool. Wheel
  // over it must stay in `.lv-body` — `overscroll-behavior` alone does not
  // cut the chain in the Tauri WebView when the body is not overflowing.
  useEffect(() => {
    if (!expanded) return
    const root = consoleRef.current
    if (!root) return
    const onWheel = (e: WheelEvent) => {
      const body = root.querySelector<HTMLElement>('.lv-body')
      if (body) {
        const max = body.scrollHeight - body.clientHeight
        if (max > 0) {
          const next = Math.min(max, Math.max(0, body.scrollTop + e.deltaY))
          if (next !== body.scrollTop) body.scrollTop = next
        }
      }
      e.preventDefault()
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [expanded])

  const stats = logStats(logs)
  const visibleLogs = logs.filter((line) => activeLevels[line.level])
  const latestLog = !expanded && logs.length > 0 ? logs[logs.length - 1] : null
  const latestPreview = latestLog?.msg.replace(/\s+/g, ' ').trim() ?? ''

  const toggleLevel = (level: LogLevel) =>
    setActiveLevels((prev) => ({ ...prev, [level]: !prev[level] }))

  return (
    <section ref={consoleRef} className="panel node-logs-console">
      <div className="nlc-bar">
        <button
          type="button"
          className="nlc-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((o) => !o)}
        >
          <ConsoleIcon />
          <span className="nlc-title">{t.nodeLogsSection}</span>
          {latestPreview ? (
            <span className="nlc-preview" title={latestLog?.msg}>
              {latestPreview}
            </span>
          ) : null}
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
          <LogViewer lines={logs.slice(-5)} scrollable />
        </div>
      )}

      <BottomDrawer
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        ariaLabel={t.recentLogs}
        wide
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
