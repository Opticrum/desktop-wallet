import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { channels } from '../api/client'
import type { ChannelList } from '../api/types'

/**
 * Node connection KPIs — a compact 2×2 grid shown above the wallet module
 * in the node sidebar (outbound/inbound balance + node/channel counts).
 * Data comes from `channels.list`; the sums are frontend formulas.
 */
export function NodeKpiGrid() {
  const { t } = useLocale()
  const [data, setData] = useState<ChannelList | null>(null)

  useEffect(() => {
    let alive = true
    channels
      .list()
      .then((c) => {
        if (alive) setData(c)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const nodes = data?.nodes ?? []
  const all = nodes.flatMap((n) => n.channels)
  const outboundCkb = all.reduce((sum, c) => sum + c.localBalanceCkb, 0)
  const inboundCkb = all.reduce((sum, c) => sum + c.remoteBalanceCkb, 0)

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
          <div className="kpi-value">{nodes.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.nodeKpiChannels}</div>
          <div className="kpi-value">{all.length}</div>
        </div>
      </div>
    </section>
  )
}
