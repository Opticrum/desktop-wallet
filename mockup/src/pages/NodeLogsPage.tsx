import { BackLink } from '../components/BackLink'
import { LogViewer } from '../components/LogViewer'
import { useLocale } from '../i18n/LocaleContext'
import { logs, nodeRuntime } from '../mock/node'

export function NodeLogsPage() {
  const { t } = useLocale()

  return (
    <div className="page">
      <BackLink to="/node" />
      <h1 className="page-title">{t.recentLogs}</h1>
      <p className="page-lead">
        {t.tipHeight} #{nodeRuntime.tipHeight.toLocaleString()} ·{' '}
        {nodeRuntime.synced ? t.synced : '…'} · {t.uptime} {nodeRuntime.uptimeHours}h
      </p>

      <LogViewer lines={logs} />
    </div>
  )
}
