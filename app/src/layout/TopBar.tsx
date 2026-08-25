import { useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { useTheme } from '../theme/ThemeContext'
import { node } from '../api/client'
import { HelpDialog } from '../components/HelpDialog'
import { MarketOverviewChip } from '../components/MarketOverviewChip'

const GITHUB_REPO_URL = 'https://github.com/Opticrum/desktop-wallet'

export function TopBar() {
  const { t, locale, setLocale } = useLocale()
  const { theme, setTheme } = useTheme()
  // "关于 Opticrum" help dialog — opened from the top-right About button.
  const [helpOpen, setHelpOpen] = useState(false)

  // Brand lockup suffix ("Desktop" from "Opticrum Desktop") — the wordmark's
  // two-tone split (Optic|rum) is a visual-design constant, not content.
  const brandSuffix = t.brand.split(' ').slice(1).join(' ')

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

          <div className="top-bar-right">
            <MarketOverviewChip />
            <button
              type="button"
              className="top-bar-quick-btn"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className="top-bar-quick-btn"
              title={locale === 'zh' ? 'English' : '中文'}
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            >
              {locale === 'zh' ? 'EN' : '中'}
            </button>
            <button
              type="button"
              className="top-bar-quick-btn"
              title={t.helpTitle}
              onClick={() => setHelpOpen(true)}
            >
              {t.aboutButton}
            </button>
            <button
              type="button"
              className="top-bar-github"
              title={t.githubLinkTitle}
              aria-label={t.githubLinkTitle}
              onClick={() => {
                node.openUrl(GITHUB_REPO_URL).catch(() => {})
              }}
            >
              <GithubIcon />
            </button>
          </div>
        </div>
      </header>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

/* Sun / moon glyphs for the theme toggle — inline SVG keeps the icon and the
   lang label on the same baseline (emoji glyphs render inconsistently). */
function SunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.688 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}
