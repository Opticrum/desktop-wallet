import { Link } from 'react-router-dom'
import { AppGrid } from '../components/AppGrid'
import { Banner } from '../components/Banner'
import { useLocale } from '../i18n/LocaleContext'

export function Home() {
  const { t } = useLocale()
  return (
    <div className="page-wide">
      <Banner />
      <div className="home-header">
        <h2>{t.marketplace}</h2>
        <div className="home-header-links">
          <Link to="/news">{t.news} →</Link>
          <Link to="/changelog">{t.changelog} →</Link>
        </div>
      </div>
      <AppGrid />
    </div>
  )
}
