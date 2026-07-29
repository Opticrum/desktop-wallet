import { Link } from 'react-router-dom'
import { NetworkOverview } from '../components/NetworkOverview'
import { useLocale } from '../i18n/LocaleContext'
import { channelsSummary } from '../mock/channels'
import { nodeRuntime } from '../mock/node'

export function NodeDetail() {
  const { t } = useLocale()

  return (
    <div className="page">
      <h2 className="page-title">{t.nodeOverview}</h2>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">{t.tipHeight}</div>
          <div className="stat-value">#{nodeRuntime.tipHeight.toLocaleString()}</div>
          <div className="stat-sub text-accent">{nodeRuntime.synced ? t.synced : '…'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.channelsActive}</div>
          <div className="stat-value">{channelsSummary.activeCount}</div>
          <div className="stat-sub">{t.localCapacity}: {channelsSummary.localCapacityCkb.toLocaleString()} CKB</div>
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

      <h3 className="section-header">{t.nodeRuntime}</h3>
      <div className="nav-strip">
        <Link to="/channels" className="nav-card">
          <div className="nav-card-label">{t.nodeNavChannels}</div>
          <div className="nav-card-value">{channelsSummary.activeCount}</div>
          <div className="nav-card-desc">{t.channelsDescription}</div>
          <span className="nav-card-link">→ {t.channelTable}</span>
        </Link>
        <Link to="/peers" className="nav-card">
          <div className="nav-card-label">{t.peerList}</div>
          <div className="nav-card-value">{nodeRuntime.peers}</div>
          <div className="nav-card-desc">{t.peersDescription}</div>
          <span className="nav-card-link">→ {t.peerList}</span>
        </Link>
        <Link to="/runtime" className="nav-card">
          <div className="nav-card-label">{t.nodeRuntime}</div>
          <div className="nav-card-value">{nodeRuntime.synced ? t.synced : '…'}</div>
          <div className="nav-card-desc">{t.runtimeDescription}</div>
          <span className="nav-card-link">→ {t.recentLogs}</span>
        </Link>
      </div>

      <NetworkOverview />
    </div>
  )
}
