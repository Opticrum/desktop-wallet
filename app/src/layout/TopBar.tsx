import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'
import { useTheme } from '../theme/ThemeContext'
import { content } from '../api/content'
import { channels, liquidity } from '../api/client'
import { stateToBucket } from '../lib/node'

type NavItem = {
  to: string
  glyph: string
  labelKey: 'marketplace' | 'nodeLabel' | 'liquidityMarket'
  metric: string
  isActive: (pathname: string) => boolean
  disabled?: boolean
}

export function TopBar() {
  const { t, locale, setLocale } = useLocale()
  const { theme, setTheme } = useTheme()
  const { pathname } = useLocation()

  // Nav metrics come from three domains: content (apps count), channels
  // (active channel count), liquidity dashboard (total matches).
  const [appCount, setAppCount] = useState<string | null>(null)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [totalMatches, setTotalMatches] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    content
      .getApps()
      .then((a) => alive && setAppCount(String(a.length)))
      .catch(() => {})
    channels
      .list()
      .then((c) => {
        const active = c.nodes
          .flatMap((n) => n.channels)
          .filter((ch) => stateToBucket(ch.state) === 'active').length
        if (alive) setActiveCount(active)
      })
      .catch(() => {})
    liquidity
      .getDashboard()
      .then((d) => alive && setTotalMatches(d.total_matches))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const navItems: NavItem[] = [
    {
      to: '/',
      glyph: 'M',
      labelKey: 'marketplace',
      disabled: true,
      metric: appCount ?? '—',
      isActive: (p) =>
        p === '/' || p.startsWith('/apps/') || p === '/news' || p === '/changelog',
    },
    {
      to: '/node',
      glyph: 'N',
      labelKey: 'nodeLabel',
      metric: activeCount != null ? `${activeCount}` : '—',
      isActive: (p) => p === '/node' || p.startsWith('/node/'),
    },
    {
      to: '/liquidity',
      glyph: 'L',
      labelKey: 'liquidityMarket',
      metric: totalMatches != null ? `${totalMatches}` : '—',
      isActive: (p) => p === '/liquidity' || p.startsWith('/liquidity'),
    },
  ]

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
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button
              type="button"
              className="top-bar-quick-btn"
              title={locale === 'zh' ? 'English' : '中文'}
              style={{ fontSize: 11, fontWeight: 600, width: 'auto', padding: '0 8px' }}
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
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
