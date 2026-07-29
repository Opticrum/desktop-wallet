import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppGrid } from '../components/AppGrid'
import { apps, type AppCategory } from '../mock/apps'
import { useLocale } from '../i18n/LocaleContext'

type CatFilter = 'all' | AppCategory

export function Home() {
  const { t, locale } = useLocale()
  const [category, setCategory] = useState<CatFilter>('all')
  const featured = apps.find((a) => a.featured) ?? apps[0]
  const catLabel =
    featured.category === 'payments'
      ? t.catPayments
      : featured.category === 'defi'
        ? t.catDefi
        : featured.category === 'tools'
          ? t.catTools
          : t.catGames

  const chips: { id: CatFilter; label: string }[] = [
    { id: 'all', label: t.allCategories },
    { id: 'payments', label: t.catPayments },
    { id: 'defi', label: t.catDefi },
    { id: 'tools', label: t.catTools },
    { id: 'games', label: t.catGames },
  ]

  return (
    <div className="page-wide">
      <section className="hero">
        <div className="hero-inner">
          <div className="page-kicker">{t.marketplace}</div>
          <h1>{t.marketHeroTitle}</h1>
          <p>{t.marketHeroLead}</p>
          <div className="hero-cats" role="group" aria-label={t.allCategories}>
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip${category === c.id ? ' active' : ''}`}
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="spotlight">
        <Link to={`/apps/${featured.id}`} className="spotlight-main">
          <span className="spotlight-tag">{t.featuredApp}</span>
          <div>
            <h2>{locale === 'zh' ? featured.nameZh : featured.nameEn}</h2>
            <p>
              {locale === 'zh'
                ? featured.descZh || featured.blurbZh
                : featured.descEn || featured.blurbEn}
            </p>
            <div className="spotlight-meta">
              <span>{catLabel}</span>
              {featured.rating != null && (
                <span>
                  {t.ratingLabel} {featured.rating}
                </span>
              )}
              {featured.downloads && (
                <span>
                  {featured.downloads} {t.downloadsLabel}
                </span>
              )}
            </div>
          </div>
        </Link>

        <div className="spotlight-side">
          <Link to="/news" className="spotlight-tile">
            <div>
              <h3>{t.news}</h3>
              <p>{locale === 'zh' ? 'Fiber 生态与协议进展' : 'Fiber ecosystem & protocol updates'}</p>
            </div>
            <span className="tile-cta">{t.viewAll} →</span>
          </Link>
          <Link to="/changelog" className="spotlight-tile">
            <div>
              <h3>{t.changelog}</h3>
              <p>{locale === 'zh' ? '桌面端版本更新记录' : 'Desktop release notes'}</p>
            </div>
            <span className="tile-cta">{t.viewAll} →</span>
          </Link>
        </div>
      </div>

      <div className="section-head">
        <h2>{t.browseApps}</h2>
      </div>
      <AppGrid category={category} onCategoryChange={setCategory} />
    </div>
  )
}
