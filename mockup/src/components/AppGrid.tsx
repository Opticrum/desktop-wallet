import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apps, type AppCategory } from '../mock/apps'
import { useLocale } from '../i18n/LocaleContext'

type CatFilter = 'all' | AppCategory

export function AppGrid() {
  const { locale, t } = useLocale()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CatFilter>('all')

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
        />
        <div className="chips">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip${category === c.id ? ' active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="app-grid">
        {filtered.map((app) => (
          <Link key={app.id} to={`/apps/${app.id}`} className="app-card">
            <div className="app-card-icon" style={{ background: app.accent }} />
            <div style={{ minWidth: 0 }}>
              <h3>{locale === 'zh' ? app.nameZh : app.nameEn}</h3>
              <p>{locale === 'zh' ? app.blurbZh : app.blurbEn}</p>
              <div className="app-card-tags">
                {app.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
