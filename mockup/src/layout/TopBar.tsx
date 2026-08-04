import { NavLink, useLocation } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'
import { useTheme } from '../theme/ThemeContext'
import { apps } from '../mock/apps'
import { wallet } from '../mock/wallet'
import { channelsSummary } from '../mock/channels'
import { mockDashboardData } from '../mock/liquidity'

type NavItem = {
  to: string
  glyph: string
  labelKey: 'marketplace' | 'nodeLabel' | 'wallet' | 'liquidityMarket'
  metric: string
  isActive: (pathname: string) => boolean
  disabled?: boolean
}

const navItems: NavItem[] = [
  {
    to: '/',
    glyph: 'M',
    labelKey: 'marketplace',
    disabled: true,
    metric: `${apps.length}`,
    isActive: (p) =>
      p === '/' || p.startsWith('/apps/') || p === '/news' || p === '/changelog',
  },
  {
    to: '/node',
    glyph: 'N',
    labelKey: 'nodeLabel',
    metric: `${channelsSummary.activeCount}`,
    isActive: (p) => p === '/node' || p.startsWith('/node/'),
  },
  {
    to: '/balance',
    glyph: 'W',
    labelKey: 'wallet',
    metric: `${wallet.totalCkb.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    isActive: (p) =>
      p === '/balance' || p.startsWith('/wallet/'),
  },
  {
    to: '/liquidity',
    glyph: 'L',
    labelKey: 'liquidityMarket',
    metric: `${mockDashboardData.total_matches}`,
    isActive: (p) => p === '/liquidity' || p.startsWith('/liquidity'),
  },
]

export function TopBar() {
  const { t, locale } = useLocale()
  const { theme } = useTheme()
  const { pathname } = useLocation()

  return (
    <div className="top-bar-wrapper">
      <header className="top-bar">
        <div className="top-bar-inner">
          <div className="top-bar-brand">
            <div className="top-bar-brand-mark" />
            <span className="top-bar-brand-text">{t.brand}</span>
          </div>

          <nav className="top-bar-nav" aria-label="Main navigation">
            {navItems.map((item) => {
              const active = item.isActive(pathname)
              const displayMetric =
                item.labelKey === 'marketplace'
                  ? `${item.metric} ${t.appCountSuffix}`
                  : item.metric
              const className = `top-bar-nav-item${active ? ' active' : ''}${item.disabled ? ' disabled' : ''}`
              const content = (
                <>
                  <span className="top-bar-nav-glyph">{item.glyph}</span>
                  <span className="top-bar-nav-label">{t[item.labelKey]}</span>
                  {displayMetric ? (
                    <span className="top-bar-nav-metric">{displayMetric}</span>
                  ) : null}
                  {item.disabled ? <LockIcon /> : null}
                </>
              )
              if (item.disabled) {
                return (
                  <span key={item.to} className={className} aria-disabled="true">
                    {content}
                  </span>
                )
              }
              return (
                <NavLink key={item.to} to={item.to} className={className}>
                  {content}
                </NavLink>
              )
            })}
          </nav>

          <div className="top-bar-right">
            <button
              type="button"
              className="top-bar-quick-btn"
              disabled
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button
              type="button"
              className="top-bar-quick-btn"
              disabled
              title={locale === 'zh' ? 'English' : '中文'}
              style={{ fontSize: 11, fontWeight: 600, width: 'auto', padding: '0 8px' }}
            >
              {locale === 'zh' ? 'EN' : '中'}
            </button>
          </div>
        </div>
      </header>
    </div>
  )
}

/* Small lock glyph — revealed on hover of a disabled nav entry */
function LockIcon() {
  return (
    <span className="top-bar-lock" aria-hidden="true">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </span>
  )
}
