import { NavLink, useLocation } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'
import { useTheme } from '../theme/ThemeContext'

type NavItem = {
  to: string
  glyph: string
  labelKey: 'marketplace' | 'nodeLabel' | 'liquidityMarket'
  isActive: (pathname: string) => boolean
  disabled?: boolean
}

export function TopBar() {
  const { t, locale, setLocale } = useLocale()
  const { theme, setTheme } = useTheme()
  const { pathname } = useLocation()

  // Brand lockup suffix ("Desktop" from "Opticrum Desktop") — the wordmark's
  // two-tone split (Optic|rum) is a visual-design constant, not content.
  const brandSuffix = t.brand.split(' ').slice(1).join(' ')

  const navItems: NavItem[] = [
    {
      to: '/',
      glyph: 'M',
      labelKey: 'marketplace',
      disabled: true,
      isActive: (p) =>
        p === '/' || p.startsWith('/apps/') || p === '/news' || p === '/changelog',
    },
    {
      to: '/node',
      glyph: 'N',
      labelKey: 'nodeLabel',
      isActive: (p) => p === '/node' || p.startsWith('/node/'),
    },
    {
      to: '/liquidity',
      glyph: 'L',
      labelKey: 'liquidityMarket',
      isActive: (p) => p === '/liquidity' || p.startsWith('/liquidity'),
    },
  ]

  return (
    <div className="top-bar-wrapper">
      <header className="top-bar">
        <div className="top-bar-inner">
          <div className="top-bar-brand">
            {/* Optic-fiber ring mark — a light pulse riding a teal→cyan ring
                around a core node (optics + fiber, the product's two roots). */}
            <svg className="top-bar-brand-mark" viewBox="0 0 24 24" aria-hidden="true">
              <defs>
                <linearGradient id="opticrum-mark-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--me-accent)" />
                  <stop offset="1" stopColor="var(--cyan)" />
                </linearGradient>
              </defs>
              <circle
                cx="12"
                cy="12"
                r="8"
                fill="none"
                stroke="url(#opticrum-mark-grad)"
                strokeWidth="2"
              />
              <circle
                cx="12"
                cy="12"
                r="8"
                fill="none"
                stroke="var(--brand-pulse)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="3.4 47"
                transform="rotate(40 12 12)"
              />
              <circle cx="12" cy="12" r="2.3" fill="url(#opticrum-mark-grad)" />
            </svg>
            <span className="top-bar-brand-text">
              <span className="brand-word">
                Optic<span className="brand-accent">rum</span>
              </span>
              {brandSuffix && <span className="brand-suffix">{brandSuffix}</span>}
            </span>
          </div>

          <nav className="top-bar-nav" aria-label="Main navigation">
            {navItems.map((item) => {
              const active = item.isActive(pathname)
              const className = `top-bar-nav-item${active ? ' active' : ''}${item.disabled ? ' disabled' : ''}`
              const content = (
                <>
                  <span className="top-bar-nav-glyph">{item.glyph}</span>
                  <span className="top-bar-nav-label">{t[item.labelKey]}</span>
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
