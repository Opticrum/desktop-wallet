import { useState, useMemo } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import {
  mockDashboardData,
  mockMatches,
  connectionPresets,
  type MatchHealth,
} from '../mock/liquidity'

// ── Helpers ───────────────────────────────────────────────────────────────

function truncateOutpoint(outpoint: string): string {
  return outpoint.slice(0, 10) + '…' + outpoint.slice(-6)
}

function formatCkb(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatBps(bps: number): string {
  return (bps / 100).toFixed(2) + '% APY'
}

function formatDeadline(blocks: number, hours: number): string {
  if (blocks <= 0) return '0 blocks'
  if (hours < 1) return `${blocks} blocks / <1h`
  if (hours >= 1000) return `${blocks.toLocaleString()} blocks / ~${Math.round(hours)}h`
  return `${blocks.toLocaleString()} blocks / ~${hours.toFixed(1)}h`
}

// ── Sub-component ─────────────────────────────────────────────────────────

function MatchHealthBadge({ health }: { health: MatchHealth }) {
  const { t } = useLocale()
  const labelMap: Record<MatchHealth, string> = {
    Healthy: t.healthHealthy,
    Warning: t.healthWarning,
    Critical: t.healthCritical,
    Exhausted: t.healthExhausted,
  }
  return (
    <span className={`badge health-${health.toLowerCase()}`}>
      {labelMap[health]}
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export function LiquidityMarket() {
  const { t } = useLocale()

  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('mainnet')
  const [rpcUrl, setRpcUrl] = useState(connectionPresets.mainnet.rpcUrl)
  const [indexerUrl, setIndexerUrl] = useState(connectionPresets.mainnet.indexerUrl)
  const [connected, setConnected] = useState(false)
  const [healthFilter, setHealthFilter] = useState<MatchHealth | 'all'>('all')

  const filteredMatches = useMemo(
    () =>
      healthFilter === 'all'
        ? mockMatches
        : mockMatches.filter((m) => m.deadline.health === healthFilter),
    [healthFilter],
  )

  const averageApy = useMemo(() => {
    const active = mockMatches.filter((m) => !m.is_exhausted)
    if (active.length === 0) return 0
    const sum = active.reduce((acc, m) => acc + m.annual_yield_bps, 0)
    return Math.round(sum / active.length)
  }, [])

  const handleNetworkChange = (net: 'mainnet' | 'testnet') => {
    setNetwork(net)
    const preset = connectionPresets[net]
    setRpcUrl(preset.rpcUrl)
    setIndexerUrl(preset.indexerUrl)
    setConnected(false)
  }

  const handleConnect = () => {
    setConnected(!connected)
  }

  const healthFilterOptions: Array<{ key: MatchHealth | 'all'; label: string }> = [
    { key: 'all', label: t.filterAll },
    { key: 'Healthy', label: t.healthHealthy },
    { key: 'Warning', label: t.healthWarning },
    { key: 'Critical', label: t.healthCritical },
    { key: 'Exhausted', label: t.healthExhausted },
  ]

  return (
    <div className="page-wide">
      <div className="page-kicker">{t.liquidityMarket}</div>
      <h1 className="page-title">{t.dashboardTitle}</h1>

      {/* ── A. Connection Panel ──────────────────────────────── */}
      <div className="panel lm-connection-panel">
        <div className="lm-connection-field">
          <label>{t.networkLabel}</label>
          <div className="radio-pill">
            <button
              type="button"
              className={network === 'mainnet' ? 'active' : ''}
              onClick={() => handleNetworkChange('mainnet')}
            >
              {t.networkMainnet}
            </button>
            <button
              type="button"
              className={network === 'testnet' ? 'active' : ''}
              onClick={() => handleNetworkChange('testnet')}
            >
              {t.networkTestnet}
            </button>
          </div>
        </div>

        <div className="lm-connection-field">
          <label>{t.rpcUrlLabel}</label>
          <input
            className="search-input"
            type="text"
            value={rpcUrl}
            onChange={(e) => setRpcUrl(e.target.value)}
            placeholder={t.rpcUrlPlaceholder}
            spellCheck={false}
          />
        </div>

        <div className="lm-connection-field">
          <label>{t.indexerUrlLabel}</label>
          <input
            className="search-input"
            type="text"
            value={indexerUrl}
            onChange={(e) => setIndexerUrl(e.target.value)}
            placeholder={t.indexerUrlPlaceholder}
            spellCheck={false}
          />
        </div>

        <div className="lm-connection-status">
          <span className={`pulse-dot${connected ? '' : ' off'}`} />
          <span>{connected ? t.statusConnected : t.statusDisconnected}</span>
          <button
            type="button"
            className="btn-primary"
            style={{ minHeight: 36, marginLeft: 8 }}
            onClick={handleConnect}
          >
            {t.connectButton}
          </button>
        </div>
      </div>

      {/* ── B. Dashboard KPI Row ─────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi kpi-hero">
          <div className="kpi-label">{t.tvlLabel}</div>
          <div className="kpi-value">
            {formatCkb(mockDashboardData.total_capacity_locked_ckb)}
            <span className="kpi-unit">{t.unitCkb}</span>
          </div>
          <div className="kpi-sub">{t.yieldDistribution}</div>
        </div>
        <div className="kpi kpi-hero">
          <div className="kpi-label">{t.activeOrdersLabel}</div>
          <div className="kpi-value">{mockDashboardData.total_orders.toLocaleString()}</div>
          <div className="kpi-sub">
            {t.tvlLabel}: {formatCkb(mockDashboardData.total_capacity_locked_ckb)} {t.unitCkb}
          </div>
        </div>
        <div className="kpi kpi-hero">
          <div className="kpi-label">{t.activeMatchesLabel}</div>
          <div className="kpi-value">{mockDashboardData.total_matches.toLocaleString()}</div>
          <div className="kpi-sub ok">
            {mockMatches.filter((m) => !m.is_exhausted).length} active
          </div>
        </div>
        <div className="kpi kpi-hero">
          <div className="kpi-label">{t.averageApyLabel}</div>
          <div className="kpi-value">{formatBps(averageApy)}</div>
          <div className="kpi-sub">
            {t.activeMatchesLabel}: {mockMatches.filter((m) => !m.is_exhausted).length}
          </div>
        </div>
      </div>

      {/* ── C. Yield Distribution ────────────────────────────── */}
      <div className="panel lm-yield-section">
        <h3 className="section-label">{t.yieldDistribution}</h3>
        <div className="lm-yield-bars">
          {mockDashboardData.yield_distribution.map((bucket) => {
            const pct =
              mockDashboardData.total_orders > 0
                ? (bucket.order_count / mockDashboardData.total_orders) * 100
                : 0
            return (
              <div className="lm-yield-bar-row" key={bucket.range_label}>
                <span className="lm-yield-bar-label">{bucket.range_label}</span>
                <div className="lm-yield-bar-track">
                  <div
                    className="lm-yield-bar-fill"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="lm-yield-bar-count">
                  {bucket.order_count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── D. Match Monitoring ──────────────────────────────── */}
      <div className="panel panel-flush">
        <div className="section-head toolbar">
          <h2>{t.matchMonitorTitle}</h2>
          <span className="lm-match-count">
            {filteredMatches.length} {filteredMatches.length === 1 ? 'match' : 'matches'}
          </span>
        </div>

        <div className="lm-filter-row">
          {healthFilterOptions.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`chip${healthFilter === f.key ? ' active' : ''}`}
              onClick={() => setHealthFilter(f.key)}
              aria-pressed={healthFilter === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>{t.matchOutpoint}</th>
              <th className="num">{t.matchCapacity}</th>
              <th className="num">{t.matchRate}</th>
              <th className="num">{t.matchRemaining}</th>
              <th className="num">{t.matchExtractable}</th>
              <th>{t.matchHealth}</th>
              <th className="num">{t.matchDeadline}</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatches.map((m) => (
              <tr key={m.channel_outpoint}>
                <td className="mono">{truncateOutpoint(m.channel_outpoint)}</td>
                <td className="num">{formatCkb(m.total_capacity_ckb)} {t.unitCkb}</td>
                <td className="num">
                  {m.shannons_per_block} {t.shannonsPerBlock}
                  <br />
                  <span className="text-secondary">{formatBps(m.annual_yield_bps)}</span>
                </td>
                <td className="num">
                  <span className={m.is_exhausted ? 'text-secondary' : ''}>
                    {formatCkb(m.remaining_capacity_ckb)} {t.unitCkb}
                  </span>
                </td>
                <td className="num">{formatCkb(m.extractable_now_ckb)} {t.unitCkb}</td>
                <td>
                  <MatchHealthBadge health={m.deadline.health} />
                </td>
                <td className="num">
                  {formatDeadline(m.deadline.blocks_remaining, m.deadline.estimated_hours_remaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
