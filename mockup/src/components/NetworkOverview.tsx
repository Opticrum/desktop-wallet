import { useLocale } from '../i18n/LocaleContext'
import { networkOverview } from '../mock/network'

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function NetworkOverview() {
  const { t } = useLocale()

  return (
    <section className="network-section">
      <div className="section-head">
        <h2>{t.networkOverview}</h2>
      </div>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">{t.networkNodes}</div>
          <div className="kpi-value">{fmt(networkOverview.nodes)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.networkChannels}</div>
          <div className="kpi-value">{fmt(networkOverview.channels)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.networkCapacity}</div>
          <div className="kpi-value">{(networkOverview.capacityCkb / 1_000_000).toFixed(1)}M</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.settlements24h}</div>
          <div className="kpi-value">{fmt(networkOverview.settlements24h)}</div>
        </div>
      </div>
    </section>
  )
}
