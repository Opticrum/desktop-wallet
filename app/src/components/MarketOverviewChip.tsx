import { useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import {
  ensureMarketDashboard,
  refreshMarketDashboard,
  useMarketDashboard,
} from '../lib/useMarketDashboard'
import { MarketOverviewPanel } from './MarketOverviewPanel'

function IconMark() {
  return (
    <svg className="tb-market-mark" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.2" className="tb-market-mark-core" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.3-6" />
      <path d="M21 4v5h-5" />
    </svg>
  )
}

/** Top-bar market chip: idle names the market; hover opens the dashboard
 *  and swaps the face to a refresh hint; click re-scans the chain. */
export function MarketOverviewChip() {
  const { t } = useLocale()
  const dashboard = useMarketDashboard()
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    await refreshMarketDashboard()
    setRefreshing(false)
  }

  return (
    <div
      className={`tb-market${open ? ' is-open' : ''}`}
      onMouseEnter={() => {
        setOpen(true)
        ensureMarketDashboard()
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="tb-market-flyout">
        <div className="tb-market-flyout-head">
          <h2 className="tb-market-flyout-title">{t.lmMarketOverview}</h2>
        </div>
        <MarketOverviewPanel dashboard={dashboard} />
      </div>
      <button
        type="button"
        className={`tb-market-btn${refreshing ? ' is-refreshing' : ''}`}
        aria-label={`${t.lmMarketChipLabel}. ${t.lmRefreshMarket}`}
        onClick={refresh}
      >
        <IconMark />
        <span className="tb-market-faces">
          <span className="tb-market-label">{t.lmMarketChipLabel}</span>
          <span className="tb-market-hint">
            <IconRefresh />
            {t.lmClickToRefresh}
          </span>
        </span>
      </button>
    </div>
  )
}
