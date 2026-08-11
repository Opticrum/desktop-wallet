import { useParams } from 'react-router-dom'
import { BackLink } from '../components/BackLink'
import { useLocale } from '../i18n/LocaleContext'
import { apps } from '../content/apps'

export function AppDetail() {
  const { id } = useParams()
  const { locale, t } = useLocale()
  const app = apps.find((a) => a.id === id)

  if (!app) {
    return (
      <div className="page">
        <BackLink />
        <p className="text-secondary">{t.notFound}</p>
      </div>
    )
  }

  const catLabel =
    app.category === 'payments'
      ? t.catPayments
      : app.category === 'defi'
        ? t.catDefi
        : app.category === 'tools'
          ? t.catTools
          : t.catGames

  return (
    <div className="page">
      <BackLink />
      <div className="app-hero">
        <div className="app-hero-icon" style={{ background: app.accent }} aria-hidden />
        <div>
          <h1>{locale === 'zh' ? app.nameZh : app.nameEn}</h1>
          <p className="app-hero-blurb">
            {locale === 'zh' ? app.descZh || app.blurbZh : app.descEn || app.blurbEn}
          </p>
          <div className="app-hero-meta">
            <span>
              {t.category}: {catLabel}
            </span>
            {app.rating != null && (
              <span>
                {t.ratingLabel} {app.rating}
              </span>
            )}
            {app.downloads && (
              <span>
                {app.downloads} {t.downloadsLabel}
              </span>
            )}
          </div>
          <div className="app-card-tags">
            {app.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <button type="button" className="btn-primary">
            {t.openApp}
          </button>
        </div>
      </div>
    </div>
  )
}
