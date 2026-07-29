import { useMemo, useState } from 'react'
import { BackLink } from '../components/BackLink'
import { useLocale } from '../i18n/LocaleContext'
import { news, type NewsItem } from '../mock/news'

type Filter = 'all' | NewsItem['tag']

export function NewsPage() {
  const { t, locale } = useLocale()
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(
    () => (filter === 'all' ? news : news.filter((n) => n.tag === filter)),
    [filter],
  )

  return (
    <div className="page">
      <BackLink />
      <div className="page-kicker">{t.marketplace}</div>
      <h1 className="page-title">{t.news}</h1>

      <div className="chips" style={{ marginBottom: 24 }}>
        <button
          type="button"
          className={`chip${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
        >
          {t.allCategories}
        </button>
        <button
          type="button"
          className={`chip${filter === 'Fiber' ? ' active' : ''}`}
          onClick={() => setFilter('Fiber')}
          aria-pressed={filter === 'Fiber'}
        >
          Fiber
        </button>
        <button
          type="button"
          className={`chip${filter === 'Lightning' ? ' active' : ''}`}
          onClick={() => setFilter('Lightning')}
          aria-pressed={filter === 'Lightning'}
        >
          Lightning
        </button>
      </div>

      <div className="news-list">
        {filtered.map((item) => (
          <article key={item.id} className="news-item">
            <h3 className="news-item-title">
              {locale === 'zh' ? item.titleZh : item.titleEn}
            </h3>
            <div className="news-item-meta">
              <span className="badge">{item.tag}</span>
              <span>{item.source}</span>
              <span>{item.time}</span>
            </div>
            <p className="news-item-body">
              {locale === 'zh' ? item.bodyZh : item.bodyEn}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
