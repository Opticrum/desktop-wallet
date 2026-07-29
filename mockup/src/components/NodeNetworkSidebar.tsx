import { Link } from 'react-router-dom'
import { DonutChart } from './DonutChart'
import { useLocale } from '../i18n/LocaleContext'
import { capacityBreakdown, networkOverview } from '../mock/network'
import { news, type NewsItem } from '../mock/news'

export function NodeNetworkSidebar() {
  const { t, locale } = useLocale()
  const titleOf = (n: NewsItem) => (locale === 'zh' ? n.titleZh : n.titleEn)
  const capacityM = `${(networkOverview.capacityCkb / 1_000_000).toFixed(1)}M`
  const articles = news.slice(0, 6)

  return (
    <aside className="node-aside">
      <section className="panel">
        <div className="section-head">
          <h2>{t.capacityBreakdown}</h2>
        </div>
        <DonutChart
          segments={capacityBreakdown}
          centerLabel={capacityM}
          centerSub="CKB"
        />
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>{t.topArticles}</h2>
        </div>
        <ul className="article-list">
          {articles.map((n) => (
            <li key={n.id} className="article-row">
              <div className="article-body">
                <div className="article-title">{titleOf(n)}</div>
                <div className="article-meta">
                  {n.source} · {n.time}
                  <span className={`article-tag tag-${n.tag.toLowerCase()}`}>
                    {n.tag}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Link to="/node/logs" className="btn-primary sidebar-cta">
        {t.viewNodeLogs} →
      </Link>
    </aside>
  )
}