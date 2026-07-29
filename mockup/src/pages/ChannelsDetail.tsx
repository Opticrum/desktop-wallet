import { BackLink } from '../components/BackLink'
import { useLocale } from '../i18n/LocaleContext'
import { channels, channelsSummary } from '../mock/channels'

export function ChannelsDetail() {
  const { t } = useLocale()

  return (
    <div className="page">
      <BackLink to="/node" />
      <div className="page-kicker">{t.nodeLabel}</div>
      <h1 className="page-title">{t.channelTable}</h1>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">{t.nodeLabel}</div>
          <div className="stat-value text-accent">
            {channelsSummary.online ? t.nodeOnline : t.nodeOffline}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.channelsActive}</div>
          <div className="stat-value">{channelsSummary.activeCount}</div>
          <div className="stat-sub">{t.pending}: {channelsSummary.pendingCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.localCapacity}</div>
          <div className="stat-value">{channelsSummary.localCapacityCkb.toLocaleString()}</div>
          <div className="stat-sub">CKB</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.peer}</th>
              <th className="num">{t.capacity}</th>
              <th className="num">{t.local}</th>
              <th className="num">{t.remote}</th>
              <th>{t.state}</th>
              <th>{t.fees}</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{ch.peerAlias}</div>
                  <div className="mono text-tertiary" style={{ fontSize: 11 }}>{ch.peerPubkeyShort}</div>
                </td>
                <td className="num">{ch.capacityCkb.toLocaleString()}</td>
                <td className="num">{ch.localBalanceCkb.toLocaleString()}</td>
                <td className="num">{ch.remoteBalanceCkb.toLocaleString()}</td>
                <td>
                  <span className={`badge ${ch.state}`}>{ch.state}</span>
                </td>
                <td className="text-secondary">
                  {ch.baseFeeMshannons} / {ch.feeRatePpm} ppm
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
