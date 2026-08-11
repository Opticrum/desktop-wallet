import { useLocale } from '../i18n/LocaleContext'
import type { NodeLog } from '../api/types'
import { formatLogTime } from '../lib/node'

/**
 * Terminal-window log viewer with macOS-style chrome (traffic-light dots +
 * title bar). Shared by the node page's console and the full logs page.
 * `scrollable` pins the chrome and scrolls the body, for embedded consoles.
 */
export function LogViewer({ lines, scrollable }: { lines: NodeLog[]; scrollable?: boolean }) {
  const { t, locale } = useLocale()

  return (
    <div className={`log-viewer${scrollable ? ' lv-scroll' : ''}`}>
      <div className="lv-chrome">
        <span className="lv-dots">
          <span className="lv-dot lv-dot-red" />
          <span className="lv-dot lv-dot-yellow" />
          <span className="lv-dot lv-dot-green" />
        </span>
        <span className="lv-title">{t.logConsoleTitle}</span>
      </div>
      <div className="lv-body">
        {lines.map((line, idx) => (
          <div key={idx} className="log-line">
            <span className="log-time">{formatLogTime(line.tsMs, locale)}</span>
            <span className={`log-level log-level-${line.level.toLowerCase()}`}>
              [{line.level}]
            </span>{' '}
            {line.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
