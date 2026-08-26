import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { useWalletNetwork } from '../wallet/WalletNetworkContext'
import {
  ensureMarketDashboard,
  isMarketAvailable,
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
 *  and swaps the face to a refresh hint; click re-scans the chain.
 *  Follows the wallet network — mainnet shows an unavailable state. */
export function MarketOverviewChip() {
  const { t } = useLocale()
  const { chain } = useWalletNetwork()
  const dashboard = useMarketDashboard(chain)
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const available = isMarketAvailable(chain)

  useEffect(() => {
    // Keep the shared cache pointed at the wallet chain even when not hovering.
  }, [chain])

  const refresh = async () => {
    if (refreshing || !available) return
    setRefreshing(true)
    await refreshMarketDashboard()
    setRefreshing(false)
  }

  return (
    <div
      className={`tb-market${open ? ' is-open' : ''}${!available ? ' is-unavailable' : ''}`}
      onMouseEnter={() => {
        setOpen(true)
        if (available) ensureMarketDashboard()
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="tb-market-flyout">
        <span className={`tb-net-pill net-${chain}`}>
          {chain === 'mainnet' ? t.networkMainnet : t.networkTestnet}
        </span>
        {available ? (
          <MarketOverviewPanel dashboard={dashboard} />
        ) : (
          <div className="tb-market-unavailable">
            <p className="tb-market-unavailable-title">{t.lmMarketUnavailableTitle}</p>
            <p className="tb-market-unavailable-body">{t.lmMarketUnavailableBody}</p>
          </div>
        )}
      </div>
      <button
        type="button"
        className={`tb-market-btn${refreshing ? ' is-refreshing' : ''}`}
        aria-label={
          available
            ? `${t.lmMarketChipLabel}. ${t.lmRefreshMarket}`
            : `${t.lmMarketChipLabel}. ${t.lmMarketUnavailableTitle}`
        }
        onClick={refresh}
        disabled={!available}
      >
        <IconMark />
        <span className="tb-market-faces">
          <span className="tb-market-label">{t.lmMarketChipLabel}</span>
          <span className="tb-market-hint">
            {available ? (
              <>
                <IconRefresh />
                {t.lmClickToRefresh}
              </>
            ) : (
              t.lmMarketUnavailableTitle
            )}
          </span>
        </span>
      </button>
    </div>
  )
}
