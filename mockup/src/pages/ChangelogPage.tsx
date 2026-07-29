import { BackLink } from '../components/BackLink'
import { useLocale } from '../i18n/LocaleContext'
import { changelogs } from '../mock/changelogs'

export function ChangelogPage() {
  const { t, locale } = useLocale()

  return (
    <div className="page">
      <BackLink />
      <h2 className="page-title">{t.changelog}</h2>

      <div className="news-list">
        {changelogs.map((item) => (
          <article key={item.version} className="news-item">
            <div className="changelog-head">
              <span className="changelog-version">v{item.version}</span>
              <span className="text-tertiary" style={{ fontSize: 12 }}>{item.date}</span>
            </div>
            <h3 className="news-item-title">
              {locale === 'zh' ? item.titleZh : item.titleEn}
            </h3>
            <p className="news-item-body">
              {locale === 'zh' ? item.bodyZh : item.bodyEn}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
