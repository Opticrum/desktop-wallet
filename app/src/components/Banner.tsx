import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { banners, apps } from '../content/apps'
import { useLocale } from '../i18n/LocaleContext'

export function Banner() {
  const { locale } = useLocale()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => setI((x) => (x + 1) % banners.length), 4000)
    return () => window.clearInterval(id)
  }, [paused])

  const slide = banners[i]
  // Each banner is mapped to a featured app for the visual showcase
  const featuredApp = apps.find((a) => a.featured && a.accent === slide.accent) || apps.find((a) => a.featured)

  return (
    <section
      className="banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="banner-content">
        <span className="banner-badge" style={{ marginBottom: 12 }}>
          {locale === 'zh' ? '精选' : 'Featured'}
        </span>
        <h1>{locale === 'zh' ? slide.titleZh : slide.titleEn}</h1>
        <p>{locale === 'zh' ? slide.subtitleZh : slide.subtitleEn}</p>
        {featuredApp && (
          <div className="banner-meta">
            <span className="banner-rating">
              {'★'.repeat(Math.round(featuredApp.rating || 0))}{' '}
              {featuredApp.rating}
            </span>
            <span>{featuredApp.downloads} {locale === 'zh' ? '次下载' : 'downloads'}</span>
            <Link
              to={`/apps/${featuredApp.id}`}
              style={{ color: 'var(--accent)', fontWeight: 500 }}
            >
              {locale === 'zh' ? '查看详情 →' : 'View details →'}
            </Link>
          </div>
        )}
      </div>
      {featuredApp && (
        <div
          className="banner-icon"
          style={{ background: featuredApp.accent }}
        />
      )}
      <div className="banner-dots">
        {banners.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            aria-label={`banner ${idx + 1}`}
            className={idx === i ? 'active' : ''}
            onClick={() => setI(idx)}
          />
        ))}
      </div>
    </section>
  )
}
