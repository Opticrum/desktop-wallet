import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apps, type AppCategory } from '../mock/apps'
import { useLocale } from '../i18n/LocaleContext'

type CatFilter = 'all' | AppCategory

type Props = {
  category?: CatFilter
  onCategoryChange?: (c: CatFilter) => void
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

      <div className="app-list">
        {filtered.map((app) => (
          <Link key={app.id} to={`/apps/${app.id}`} className="app-row">
            <div className="app-row-icon" style={{ background: app.accent }} aria-hidden />
            <div>
              <h3>{locale === 'zh' ? app.nameZh : app.nameEn}</h3>
              <p>{locale === 'zh' ? app.blurbZh : app.blurbEn}</p>
              <div className="app-row-meta">
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
            </div>
            <div className="app-row-tags">
              {app.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
