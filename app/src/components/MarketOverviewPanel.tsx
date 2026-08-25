import { useLocale } from '../i18n/LocaleContext'
import {
  formatBpsNum,
  formatCkb,
  formatYieldRange,
  type MappedDashboard,
} from '../lib/liquidity'

type Props = {
  dashboard: MappedDashboard | null
}

/** Hero demand + 2×2 KPIs + yield histogram — the `lm-dash` body. */
export function MarketOverviewPanel({ dashboard }: Props) {
  const { t } = useLocale()

  return (
    <>
      <div className="lm-dash-figure">
        <span className="stat-label">{t.lmGlobalOrderDemand}</span>
        <div className="lm-dash-value">
          {dashboard ? formatCkb(dashboard.totalOrdersCapacityCkb) : '—'}
          <span className="lm-dash-unit">{t.unitCkb}</span>
        </div>
      </div>

      <div className="kpi-grid kpi-grid-2 conn-kpis lm-dash-kpis">
        <div className="kpi">
          <div className="kpi-label">{t.lmTotalOrders}</div>
          <div className="kpi-value">
            {dashboard ? dashboard.totalOrders.toLocaleString() : '—'}
          </div>
          <div className="kpi-sub">{t.lmOrdersUnit}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.lmLockedCapacity}</div>
          <div className="kpi-value">
            {dashboard ? formatCkb(dashboard.totalCapacityLockedCkb) : '—'}
          </div>
          <div className="kpi-sub">{t.unitCkb}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.lmAvgApy}</div>
          <div className="kpi-value">
            {dashboard ? formatBpsNum(dashboard.avgAnnualYieldBps) : '—'}
          </div>
          <div className="kpi-sub">%</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.lmAvgRate}</div>
          <div className="kpi-value">
            {dashboard ? dashboard.avgShannonsPerBlock.toLocaleString() : '—'}
          </div>
          <div className="kpi-sub">{t.shannonsPerBlock}</div>
        </div>
      </div>

      <div className="lm-yield">
        <div className="lm-yield-head">
          <span className="stat-label">{t.lmYieldDistribution}</span>
        </div>
        {dashboard?.hasYieldData ? (
          <div className="lm-yield-bars">
            {dashboard.yieldBuckets.map((b) => (
              <div
                key={`${b.lowBps}-${b.highBps}`}
                className="lm-yield-row"
                title={`${formatYieldRange(b)} · ${b.count} ${t.mgOrderTag} · ${formatCkb(b.capacityCkb)} ${t.unitCkb}`}
              >
                <span className="lm-yield-row-label">{formatYieldRange(b)}</span>
                <div className="lm-yield-track">
                  <div
                    className="lm-yield-fill"
                    style={{ width: `${Math.round(b.share * 100)}%` }}
                  />
                </div>
                <span className="lm-yield-row-count">{b.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="lm-yield-empty">{t.lmNoYieldData}</div>
        )}
      </div>
    </>
  )
}
