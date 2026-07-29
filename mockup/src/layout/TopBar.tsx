import { NavLink, useLocation } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'
import { useTheme } from '../theme/ThemeContext'
import { apps } from '../mock/apps'
import { wallet } from '../mock/wallet'
import { channelsSummary } from '../mock/channels'

type NavItem = {
  to: string
  glyph: string
  labelKey: 'marketplace' | 'nodeLabel' | 'wallet' | 'me'
  metric: string
  isActive: (pathname: string) => boolean
}

const navItems: NavItem[] = [
  {
    to: '/',
    glyph: 'M',
    labelKey: 'marketplace',
    metric: `${apps.length}`,
    isActive: (p) =>
      p === '/' || p.startsWith('/apps/') || p === '/news' || p === '/changelog',
  },
  {
    to: '/node',
    glyph: 'N',
    labelKey: 'nodeLabel',
    metric: `${channelsSummary.activeCount}`,
    isActive: (p) =>
      p === '/node' || p.startsWith('/channels') || p.startsWith('/peers') || p.startsWith('/runtime'),
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
    to: '/me',
    glyph: 'S',
    labelKey: 'me',
    metric: '',
    isActive: (p) => p === '/me' || p.startsWith('/settings'),
  },
]

export function TopBar() {
  const { t, locale, setLocale } = useLocale()
  const { theme, setTheme } = useTheme()
  const { pathname } = useLocation()

  const cycleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  const cycleLocale = () => setLocale(locale === 'zh' ? 'en' : 'zh')

  return (
    <div className="top-bar-wrapper">
      <header className="top-bar">
        {/* Mini top bar — visible in collapsed state, same layout as expanded */}
        <div className="top-bar-mini" aria-hidden="true">
          <span className="top-bar-mini-brand" />

          <span className="top-bar-mini-nav">
            {navItems.map((item) => {
              const active = item.isActive(pathname)
              return (
                <span
                  key={item.to}
                  className={`top-bar-mini-glyph${active ? ' active' : ''}`}
                >
                  {item.glyph}
                </span>
              )
            })}
          </span>

          <span className="top-bar-mini-right">
            <span className="top-bar-mini-glyph">
              {theme === 'dark' ? '☀' : '☾'}
            </span>
            <span className="top-bar-mini-glyph">
              {locale === 'zh' ? 'EN' : '中'}
            </span>
          </span>
        </div>

        {/* Full expanded nav */}
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
                  : item.labelKey === 'me'
                    ? ''
                    : item.metric
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`top-bar-nav-item${active ? ' active' : ''}`}
                >
                  <span className="top-bar-nav-glyph">{item.glyph}</span>
                  <span className="top-bar-nav-label">{t[item.labelKey]}</span>
                  {displayMetric ? (
                    <span className="top-bar-nav-metric">{displayMetric}</span>
                  ) : null}
                </NavLink>
              )
            })}
          </nav>

          <div className="top-bar-right">
            <button
              type="button"
              className="top-bar-quick-btn"
              onClick={cycleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button
              type="button"
              className="top-bar-quick-btn"
              onClick={cycleLocale}
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
