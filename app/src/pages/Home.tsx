import { useMemo, useState, useEffect, useCallback } from 'react'
import { AppGrid, type GridLayout, type CardVariant } from '../components/AppGrid'
import { apps, banners, type AppCategory } from '../content/apps'
import { useLocale } from '../i18n/LocaleContext'

type CatFilter = 'all' | AppCategory

export function Home() {
  const { t, locale } = useLocale()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CatFilter>('all')
  const [bannerIdx, setBannerIdx] = useState(0)
  const [bannerPaused, setBannerPaused] = useState(false)

  /* ── Banner auto-rotate ──────────────────────────────────────────────── */
  useEffect(() => {
    if (bannerPaused || banners.length <= 1) return
    const timer = setInterval(() => {
      setBannerIdx((i) => (i + 1) % banners.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [bannerPaused])

  const goBanner = useCallback((i: number) => setBannerIdx(i), [])

  /* ── Category chips ──────────────────────────────────────────────────── */
  const chips: { id: CatFilter; label: string }[] = [
    { id: 'all',      label: t.allCategories },
    { id: 'payments', label: t.catPayments },
    { id: 'defi',     label: t.catDefi },
    { id: 'tools',    label: t.catTools },
    { id: 'games',    label: t.catGames },
  ]

  /* ── Filter ──────────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apps.filter((app) => {
      if (category !== 'all' && app.category !== category) return false
      if (!q) return true
      const hay = `${app.nameZh} ${app.nameEn} ${app.blurbZh} ${app.blurbEn} ${app.tags.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, category])

  /* ── Sections (only when "all" category is selected) ─────────────────── */
  const hotApps = useMemo(
    () => (category === 'all' ? filtered.filter((a) => a.badge === 'hot' || a.featured) : []),
    [filtered, category],
  )
  const newApps = useMemo(
    () => (category === 'all' ? filtered.filter((a) => a.badge === 'new' && !a.featured) : []),
    [filtered, category],
  )
  const restApps = useMemo(
    () =>
      category === 'all'
        ? filtered.filter((a) => !hotApps.includes(a) && !newApps.includes(a))
        : filtered,
    [filtered, category, hotApps, newApps],
  )

  /* ── Category-grouped apps (for "all" mode, after hot/new sections) ──── */
  const categoryGroups = useMemo(() => {
    if (category !== 'all') return []
    const cats: AppCategory[] = ['payments', 'defi', 'tools', 'games']
    return cats
      .map((cat) => {
        const groupApps = restApps.filter((a) => a.category === cat)
        return { cat, apps: groupApps }
      })
      .filter((g) => g.apps.length > 0)
  }, [restApps, category])

  return (
    <div className="page-wide">
      {/* ── Banner carousel ──────────────────────────────────────────── */}
      {banners.length > 0 && (
        <div
          className="market-banner"
          onMouseEnter={() => setBannerPaused(true)}
          onMouseLeave={() => setBannerPaused(false)}
        >
          <div
            className="market-banner-track"
            style={{ transform: `translateX(-${bannerIdx * 100}%)` }}
          >
            {banners.map((b) => (
              <div
                key={b.id}
                className="market-banner-slide"
                style={{ background: b.accent }}
              >
                <div className="market-banner-text">
                  <h3>{locale === 'zh' ? b.titleZh : b.titleEn}</h3>
                  <p>{locale === 'zh' ? b.subtitleZh : b.subtitleEn}</p>
                </div>
                <div className="market-banner-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    {b.id === 'b1' && <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>}
                    {b.id === 'b2' && <><path d="M2 12h4l2-6 4 12 2-6h4"/></>}
                    {b.id === 'b3' && <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 8l6 4-6 4z"/></>}
                    {b.id === 'b4' && <><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9 12h6"/></>}
                  </svg>
                </div>
              </div>
            ))}
          </div>
          {banners.length > 1 && (
            <div className="market-banner-dots">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  className={`market-banner-dot${i === bannerIdx ? ' active' : ''}`}
                  onClick={() => goBanner(i)}
                  aria-label={`Banner ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Search bar ────────────────────────────────────────────────── */}
      <div className="market-header">
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchApps}
          aria-label={t.searchApps}
        />
      </div>

      {/* ── Category chips ────────────────────────────────────────────── */}
      <div className="market-cats" role="group" aria-label={t.allCategories}>
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

      {/* ── Content ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p className="text-secondary" style={{ textAlign: 'center', padding: '40px 0' }}>
          {t.notFound}
        </p>
      ) : category !== 'all' ? (
        /* Single category: 3-col featured grid for visual variety */
        <AppGrid apps={filtered} count={filtered.length} layout="grid-3" cardVariant="featured" />
      ) : (
        /* "All" mode: mixed-layout sections */
        <>
          {hotApps.length > 0 && (
            <AppGrid apps={hotApps} title={t.popularApps} layout="hscroll" />
          )}
          {newApps.length > 0 && (
            <AppGrid apps={newApps} title={t.newApps} layout="grid-3" cardVariant="featured" />
          )}
          {categoryGroups.map((g, i) => {
            /* Alternate: even → 2-col list, odd → 4-col grid */
            const isEven = i % 2 === 0
            const layout: GridLayout = isEven ? 'grid-2' : 'grid-4'
            const cardVariant: CardVariant = isEven ? 'list' : 'default'
            return (
              <AppGrid
                key={g.cat}
                apps={g.apps}
                title={chips.find((c) => c.id === g.cat)?.label ?? g.cat}
                count={g.apps.length}
                layout={layout}
                cardVariant={cardVariant}
              />
            )
          })}
        </>
      )}
    </div>
  )
}
