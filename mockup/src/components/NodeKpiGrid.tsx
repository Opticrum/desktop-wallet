import { useLocale } from '../i18n/LocaleContext'
import { connectedNodes } from '../mock/channels'

/**
 * Node connection KPIs — a compact 2×2 grid shown above the wallet module
 * in the node sidebar (outbound/inbound balance + node/channel counts).
 */
export function NodeKpiGrid() {
  const { t } = useLocale()
  const channels = connectedNodes.flatMap((n) => n.channels)
  const outboundCkb = channels.reduce((sum, c) => sum + c.localBalanceCkb, 0)
  const inboundCkb = channels.reduce((sum, c) => sum + c.remoteBalanceCkb, 0)

  return (
    <section className="panel node-kpi-grid">
      <div className="section-head">
        <h2 className="node-section-title">{t.nodeOverview}</h2>
      </div>
      <div className="kpi-grid conn-kpis">
        <div className="kpi">
          <div className="kpi-label">
            {t.nodeOutboundBalance} <span className="kpi-label-unit">CKB</span>
          </div>
          <div className="kpi-value">{outboundCkb.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            {t.nodeInboundBalance} <span className="kpi-label-unit">CKB</span>
          </div>
          <div className="kpi-value">{inboundCkb.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.nodeKpiNodes}</div>
          <div className="kpi-value">{connectedNodes.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.nodeKpiChannels}</div>
          <div className="kpi-value">{channels.length}</div>
        </div>
      </div>
    </section>
  )
}
