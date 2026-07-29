import { BackLink } from '../components/BackLink'
import { useLocale } from '../i18n/LocaleContext'
import { logs, nodeRuntime } from '../mock/node'

export function RuntimeDetail() {
  const { t, locale } = useLocale()

  return (
    <div className="page">
      <BackLink to="/node" />
      <div className="page-kicker">{t.nodeLabel}</div>
      <h1 className="page-title">{t.nodeRuntime}</h1>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">{t.tipHeight}</div>
          <div className="stat-value">#{nodeRuntime.tipHeight.toLocaleString()}</div>
          <div className="stat-sub text-accent">{nodeRuntime.synced ? t.synced : '…'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.peers}</div>
          <div className="stat-value">{nodeRuntime.peers}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.cpu} / {t.memory}</div>
          <div className="stat-value">{nodeRuntime.cpuPercent}% / {nodeRuntime.memPercent}%</div>
          <div className="stat-sub">{t.uptime} {nodeRuntime.uptimeHours}h</div>
        </div>
      </div>

      <h3 className="section-header">{t.recentLogs}</h3>
      <div className="log-viewer">
        {logs.map((line, idx) => (
          <div key={idx} className="log-line">
            <span className="log-time">
              {new Date(line.ts).toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US')}
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
