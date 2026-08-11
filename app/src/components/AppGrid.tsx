import { type MarketApp, type AppCategory, type AppPlatform } from '../content/apps'
import { useLocale } from '../i18n/LocaleContext'
import { Link } from 'react-router-dom'

export type GridLayout = 'grid-4' | 'grid-3' | 'grid-2' | 'hscroll'
export type CardVariant = 'default' | 'featured' | 'list'

type Props = {
  apps: MarketApp[]
  title?: string
  count?: number
  layout?: GridLayout
  cardVariant?: CardVariant
}

function catLabel(cat: AppCategory, t: ReturnType<typeof useLocale>['t']) {
  switch (cat) {
    case 'payments':  return t.catPayments
    case 'defi':      return t.catDefi
    case 'tools':     return t.catTools
    case 'games':     return t.catGames
  }
}

function platformLabel(p: AppPlatform, t: ReturnType<typeof useLocale>['t']) {
  switch (p) {
    case 'web':    return t.platformWeb
    case 'mobile': return t.platformMobile
    case 'both':   return `${t.platformWeb} · ${t.platformMobile}`
  }
}

function iconLetter(app: MarketApp, locale: 'zh' | 'en') {
  const name = locale === 'zh' ? app.nameZh : app.nameEn
  return name.slice(0, 2).toUpperCase()
}

/* ── Badge ─────────────────────────────────────────────────────────────── */

function Badge({ badge, t }: { badge: 'hot' | 'new'; t: ReturnType<typeof useLocale>['t'] }) {
  return <span className={`dapp-card-badge ${badge}`}>{badge === 'hot' ? t.hotBadge : t.newBadge}</span>
}

/* ── Shared icon + body used by all card variants ─────────────────────── */

function DAppIcon({ app }: { app: MarketApp }) {
  const { locale, t } = useLocale()
  return (
    <div className="dapp-card-icon-wrap">
      <div className="dapp-card-icon" style={{ background: app.accent }}>
        {iconLetter(app, locale)}
      </div>
      {app.badge && <Badge badge={app.badge} t={t} />}
    </div>
  )
}

function DAppMeta({ app }: { app: MarketApp }) {
  const { t } = useLocale()
  return (
    <div className="dapp-card-meta">
      <span>{catLabel(app.category, t)}</span>
      <span className="dapp-card-meta-sep">·</span>
      <span className="platform">{platformLabel(app.platform, t)}</span>
    </div>
  )
}

/* ── Default card (stacked, for 4-col grids) ──────────────────────────── */

function DAppCardDefault({ app }: { app: MarketApp }) {
  const { locale } = useLocale()
  const name = locale === 'zh' ? app.nameZh : app.nameEn
  const blurb = locale === 'zh' ? app.blurbZh : app.blurbEn

  return (
    <Link to={`/apps/${app.id}`} className="dapp-card">
      <DAppIcon app={app} />
      <h3>{name}</h3>
      <p className="dapp-card-blurb">{blurb}</p>
      <DAppMeta app={app} />
    </Link>
  )
}

/* ── Featured card (3-col, accent top strip) ──────────────────────────── */

function DAppCardFeatured({ app }: { app: MarketApp }) {
  const { locale } = useLocale()
  const name = locale === 'zh' ? app.nameZh : app.nameEn
  const blurb = locale === 'zh' ? app.blurbZh : app.blurbEn

  return (
    <Link
      to={`/apps/${app.id}`}
      className="dapp-card dapp-card--featured"
      style={{ '--card-accent': app.accent } as React.CSSProperties}
    >
      <DAppIcon app={app} />
      <h3>{name}</h3>
      <p className="dapp-card-blurb">{blurb}</p>
      <DAppMeta app={app} />
    </Link>
  )
}

/* ── List card (icon left, text right, for 2-col grids) ───────────────── */

function DAppCardList({ app }: { app: MarketApp }) {
  const { locale } = useLocale()
  const name = locale === 'zh' ? app.nameZh : app.nameEn
  const blurb = locale === 'zh' ? app.blurbZh : app.blurbEn

  return (
    <Link to={`/apps/${app.id}`} className="dapp-card dapp-card--list">
      <DAppIcon app={app} />
      <div className="dapp-card-body-right">
        <h3>{name}</h3>
        <p className="dapp-card-blurb">{blurb}</p>
        <DAppMeta app={app} />
      </div>
    </Link>
  )
}

/* ── Card dispatcher ──────────────────────────────────────────────────── */

function DAppCard({ app, variant }: { app: MarketApp; variant: CardVariant }) {
  if (variant === 'featured') return <DAppCardFeatured app={app} />
  if (variant === 'list') return <DAppCardList app={app} />
  return <DAppCardDefault app={app} />
}

/* ── AppGrid — layout-aware section ───────────────────────────────────── */

export function AppGrid({ apps, title, count, layout = 'grid-4', cardVariant = 'default' }: Props) {
  if (apps.length === 0) return null

  const gridClass =
    layout === 'grid-3' ? 'dapp-grid-3' :
    layout === 'grid-2' ? 'dapp-grid-2' :
    'dapp-grid'

  const header = (title || count != null) ? (
    <div className="dapp-section-header">
      {title && <h2 className="dapp-section-title">{title}</h2>}
      {count != null && (
        <span className="dapp-section-count">{count} {useLocale().t.appCountSuffix}</span>
      )}
    </div>
  ) : null

  if (layout === 'hscroll') {
    return (
      <div className="dapp-hscroll-wrap">
        {header && (
          <div className="dapp-hscroll-header">
            {title && <h2 className="dapp-hscroll-title">{title}</h2>}
            {count != null && (
              <span className="dapp-section-count">{count} {useLocale().t.appCountSuffix}</span>
            )}
          </div>
        )}
        <div className="dapp-hscroll-track">
          {apps.map((app) => (
            <Link key={app.id} to={`/apps/${app.id}`} className="dapp-hscroll-card">
              <DAppIcon app={app} />
              <div>
                <h3>{useLocale().locale === 'zh' ? app.nameZh : app.nameEn}</h3>
                <p className="dapp-card-blurb">
                  {useLocale().locale === 'zh' ? app.blurbZh : app.blurbEn}
                </p>
                <DAppMeta app={app} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="dapp-section">
      {header}
      <div className={gridClass}>
        {apps.map((app) => (
          <DAppCard key={app.id} app={app} variant={cardVariant} />
        ))}
      </div>
    </div>
  )
}
