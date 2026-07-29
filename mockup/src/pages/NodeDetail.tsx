import { Link } from 'react-router-dom'
import { NetworkOverview } from '../components/NetworkOverview'
import { useLocale } from '../i18n/LocaleContext'
import { channelsSummary } from '../mock/channels'
import { nodeRuntime } from '../mock/node'

export function NodeDetail() {
  const { t } = useLocale()

  return (
    <div className="page-wide">
      <div className="page-kicker">{t.nodeLabel}</div>
      <h1 className="page-title">{t.nodeOverview}</h1>
      <p className="page-lead">
        {nodeRuntime.synced ? t.synced : '…'} · {t.uptime} {nodeRuntime.uptimeHours}h
      </p>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">{t.tipHeight}</div>
          <div className="kpi-value">#{nodeRuntime.tipHeight.toLocaleString()}</div>
          <div className={`kpi-sub${nodeRuntime.synced ? ' ok' : ''}`}>
            {nodeRuntime.synced ? t.synced : '…'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.channelsActive}</div>
          <div className="kpi-value">{channelsSummary.activeCount}</div>
          <div className="kpi-sub">
            {t.localCapacity}: {channelsSummary.localCapacityCkb.toLocaleString()} CKB
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.peers}</div>
          <div className="kpi-value">{nodeRuntime.peers}</div>
          <div className="kpi-sub">{t.connectedPeers}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            {t.cpu} / {t.memory}
          </div>
          <div className="kpi-value">
            {nodeRuntime.cpuPercent}%
            <span style={{ color: 'var(--ink-4)', fontSize: '0.55em', fontWeight: 700 }}>
              {' '}
              / {nodeRuntime.memPercent}%
            </span>
          </div>
          <div className="kpi-sub">
            {t.uptime} {nodeRuntime.uptimeHours}h
          </div>
        </div>
      </div>

      <div className="section-head">
        <h2>{t.nodeRuntime}</h2>
      </div>
      <div className="nav-bento">
        <Link to="/channels" className="nav-tile">
          <div className="nav-tile-label">{t.nodeNavChannels}</div>
          <div className="nav-tile-value">{channelsSummary.activeCount}</div>
          <div className="nav-tile-desc">{t.channelsDescription}</div>
          <span className="nav-tile-cta">{t.channelTable} →</span>
        </Link>
        <Link to="/peers" className="nav-tile">
          <div className="nav-tile-label">{t.peerList}</div>
          <div className="nav-tile-value">{nodeRuntime.peers}</div>
          <div className="nav-tile-desc">{t.peersDescription}</div>
          <span className="nav-tile-cta">{t.peerList} →</span>
        </Link>
        <Link to="/runtime" className="nav-tile">
          <div className="nav-tile-label">{t.nodeRuntime}</div>
          <div className="nav-tile-value" style={{ fontSize: 28 }}>
            {nodeRuntime.synced ? t.synced : '…'}
          </div>
          <div className="nav-tile-desc">{t.runtimeDescription}</div>
          <span className="nav-tile-cta">{t.recentLogs} →</span>
        </Link>
      </div>

      <NetworkOverview />
    </div>
  )
}
