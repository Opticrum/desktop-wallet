import { useLocale } from '../i18n/LocaleContext'
import type { MatchHealth } from '../lib/liquidity'

/** Health capsule for a match — lowercase wire `health` values. */
export function MatchHealthBadge({ health }: { health: MatchHealth }) {
  const { t } = useLocale()
  const labelMap: Record<MatchHealth, string> = {
    healthy: t.healthHealthy,
    warning: t.healthWarning,
    critical: t.healthCritical,
    exhausted: t.healthExhausted,
  }
  return <span className={`badge health-${health}`}>{labelMap[health]}</span>
}
