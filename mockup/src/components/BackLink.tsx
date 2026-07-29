import { Link } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'

export function BackLink({ to = '/' }: { to?: string }) {
  const { t } = useLocale()
  return (
    <Link className="back-link" to={to}>
      ← {t.back}
    </Link>
  )
}
