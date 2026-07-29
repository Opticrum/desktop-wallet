import { BackLink } from '../components/BackLink'
import { useLocale } from '../i18n/LocaleContext'
import { logs, nodeRuntime } from '../mock/node'

export function NodeLogsPage() {
  const { t, locale } = useLocale()

  return (
    <div className="page">
      <BackLink to="/node" />
      <h1 className="page-title">{t.recentLogs}</h1>
      <p className="page-lead">
        {t.tipHeight} #{nodeRuntime.tipHeight.toLocaleString()} ·{' '}
        {nodeRuntime.synced ? t.synced : '…'} · {t.uptime} {nodeRuntime.uptimeHours}h
      </p>

      <div className="log-viewer log-viewer-full">
        {logs.map((line, idx) => (
          <div key={idx} className="log-line">
            <span className="log-time">
              {new Date(line.ts).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
            <span className={`log-level-${line.level.toLowerCase()}`}>
              [{line.level}]
            </span>{' '}
            {line.msg}
          </div>
        ))}
      </div>
    </div>
  )
}