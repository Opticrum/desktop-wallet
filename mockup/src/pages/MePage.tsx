import { Link } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'

export function MePage() {
  const { t } = useLocale()

  return (
    <div className="page">
      <div className="page-kicker">{t.me}</div>
      <h1 className="page-title">{t.profile}</h1>

      <div className="profile-header">
        <div className="profile-avatar" aria-hidden>
          SN
        </div>
        <div>
          <div className="profile-name">{t.profileName}</div>
          <div className="profile-detail">satoshi@opticrum.me · {t.lnAddress}</div>
        </div>
      </div>

      <div className="settings-panel">
        <div className="settings-list">
          <button type="button" className="settings-row">
            <span>{t.profile}</span>
            <span className="settings-row-arrow">→</span>
          </button>
          <button type="button" className="settings-row" aria-disabled="true">
            <span>{t.security}</span>
            <span className="text-tertiary">{t.comingSoon}</span>
          </button>
          <Link to="/settings" className="settings-row">
            <span>{t.preferences}</span>
            <span className="settings-row-arrow">→</span>
          </Link>
          <button type="button" className="settings-row" aria-disabled="true">
            <span>{t.connectedApps}</span>
            <span className="text-tertiary">{t.comingSoon}</span>
          </button>
          <button type="button" className="settings-row" aria-disabled="true">
            <span>{t.about}</span>
            <span className="text-tertiary">{t.comingSoon}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
