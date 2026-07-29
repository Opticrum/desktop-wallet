import { useState } from 'react'
import { BackLink } from '../components/BackLink'
import { useLocale, type Locale } from '../i18n/LocaleContext'
import { useTheme } from '../theme/ThemeContext'

type Currency = 'USD' | 'CKB' | 'BTC'

export function SettingsPage() {
  const { t, locale, setLocale } = useLocale()
  const { theme, setTheme } = useTheme()
  const [currency, setCurrency] = useState<Currency>('CKB')
  const [hideSmallBalances, setHideSmallBalances] = useState(false)
  const [notifications, setNotifications] = useState(true)

  return (
    <div className="page">
      <BackLink to="/me" />
      <div className="page-kicker">{t.me}</div>
      <h1 className="page-title">{t.settings}</h1>

      <div className="settings-panel">
        <div className="settings-group">
          <div className="settings-row">
            <div>
              <div>{t.themeLabel}</div>
              <div className="settings-hint">{theme === 'dark' ? 'Dark' : 'Light'}</div>
            </div>
            <div className="radio-pill" role="radiogroup" aria-label={t.themeLabel}>
              <button
                type="button"
                className={theme === 'light' ? 'active' : ''}
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
              >
                Light
              </button>
              <button
                type="button"
                className={theme === 'dark' ? 'active' : ''}
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div>{locale === 'zh' ? '语言' : 'Language'}</div>
            <select
              className="select-mini"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label="Language"
            >
              <option value="zh">{t.languageZh}</option>
              <option value="en">{t.languageEn}</option>
            </select>
          </div>

          <div className="settings-row">
            <div>{t.currencyUnit}</div>
            <select
              className="select-mini"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              aria-label={t.currencyUnit}
            >
              <option value="USD">{t.currencyUsd}</option>
              <option value="CKB">{t.currencyCkb}</option>
              <option value="BTC">{t.currencyBtc}</option>
            </select>
          </div>

          <div className="settings-row">
            <div>
              <div>{t.hideSmallBalances}</div>
              <div className="settings-hint">{t.hideSmallBalancesHint}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-label={t.hideSmallBalances}
              aria-checked={hideSmallBalances}
              className="toggle-switch"
              onClick={() => setHideSmallBalances((v) => !v)}
            />
          </div>

          <div className="settings-row">
            <div>
              <div>{t.notifications}</div>
              <div className="settings-hint">{t.notificationsHint}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-label={t.notifications}
              aria-checked={notifications}
              className="toggle-switch"
              onClick={() => setNotifications((v) => !v)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
