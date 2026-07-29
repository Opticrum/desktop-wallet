import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apps, type AppCategory, type MarketApp } from '../mock/apps'
import { useLocale } from '../i18n/LocaleContext'

type CatFilter = 'all' | AppCategory
type CardVariant = 'wide' | 'cover' | 'soft' | 'compact'

type Props = {
  category?: CatFilter
  onCategoryChange?: (c: CatFilter) => void
}

function variantFor(index: number, total: number): CardVariant {
  if (total === 1) return 'wide'
  if (index === 0) return 'wide'
  if (index === 1 || index === 2) return 'cover'
  if (index % 5 === 3) return 'soft'
  if (index % 5 === 4) return 'soft'
  return 'compact'
}

function catLabel(cat: AppCategory, t: ReturnType<typeof useLocale>['t']) {
  switch (cat) {
    case 'payments':
      return t.catPayments
    case 'defi':
      return t.catDefi
    case 'tools':
      return t.catTools
    case 'games':
      return t.catGames
  }
}

function AppCard({
  app,
  variant,
  locale,
  t,
}: {
  app: MarketApp
  variant: CardVariant
  locale: 'zh' | 'en'
  t: ReturnType<typeof useLocale>['t']
}) {
  const name = locale === 'zh' ? app.nameZh : app.nameEn
  const blurb = locale === 'zh' ? app.blurbZh : app.blurbEn

  if (variant === 'compact') {
    return (
      <Link to={`/apps/${app.id}`} className="app-card app-card--compact">
        <div className="app-card-icon" style={{ background: app.accent }} aria-hidden />
        <div className="app-card-body">
          <h3>{name}</h3>
          <p>{blurb}</p>
          <div className="app-card-meta">
            {app.rating != null && <span>{app.rating}</span>}
            {app.downloads && <span>{app.downloads}</span>}
            {app.tags.slice(0, 1).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </Link>
    )
  }

  if (variant === 'cover' || variant === 'soft') {
    return (
      <Link
        to={`/apps/${app.id}`}
        className={`app-card app-card--${variant}`}
      >
        <div className="app-card-cover" style={{ background: app.accent }} aria-hidden />
        <div className="app-card-body">
          <span className="app-card-cat">{catLabel(app.category, t)}</span>
          <h3>{name}</h3>
          <p>{blurb}</p>
          <div className="app-card-meta">
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
          {variant === 'soft' && (
            <div className="app-card-tags">
              {app.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
    )
  }

  return (
    <Link to={`/apps/${app.id}`} className="app-card app-card--wide">
      <div className="app-card-cover" style={{ background: app.accent }} aria-hidden />
      <div className="app-card-body">
        <span className="app-card-cat">{catLabel(app.category, t)}</span>
        <h3>{name}</h3>
        <p>{blurb}</p>
        <div className="app-card-meta">
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
      </div>
    </Link>
  )
}

export function AppGrid({ category: controlledCategory, onCategoryChange }: Props) {
  const { locale, t } = useLocale()
  const [query, setQuery] = useState('')
  const [localCategory, setLocalCategory] = useState<CatFilter>('all')
  const category = controlledCategory ?? localCategory
  const setCategory = onCategoryChange ?? setLocalCategory

  const chips: { id: CatFilter; label: string }[] = [
    { id: 'all', label: t.allCategories },
    { id: 'payments', label: t.catPayments },
    { id: 'defi', label: t.catDefi },
    { id: 'tools', label: t.catTools },
    { id: 'games', label: t.catGames },
  ]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apps.filter((app) => {
      if (category !== 'all' && app.category !== category) return false
      if (!q) return true
      const hay = `${app.nameZh} ${app.nameEn} ${app.blurbZh} ${app.blurbEn} ${app.tags.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, category])

  return (
    <div>
      <div className="market-toolbar">
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchApps}
          aria-label={t.searchApps}
        />
        {!onCategoryChange && (
          <div className="chips" role="group" aria-label={t.allCategories}>
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
        )}
      </div>

      <div className="app-mosaic">
        {filtered.map((app, index) => (
          <AppCard
            key={app.id}
            app={app}
            variant={variantFor(index, filtered.length)}
            locale={locale}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}
