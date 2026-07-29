import { useLocale } from '../i18n/LocaleContext'
import { networkOverview } from '../mock/network'

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function NetworkOverview() {
  const { t } = useLocale()

  return (
    <section className="network-section">
      <h3 className="section-header">{t.networkOverview}</h3>
      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">{t.networkNodes}</div>
          <div className="stat-value">{fmt(networkOverview.nodes)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.networkChannels}</div>
          <div className="stat-value">{fmt(networkOverview.channels)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.networkCapacity}</div>
          <div className="stat-value">{(networkOverview.capacityCkb / 1_000_000).toFixed(2)}M</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t.settlements24h}</div>
          <div className="stat-value">{fmt(networkOverview.settlements24h)}</div>
        </div>
      </div>
    </section>
  )
}
