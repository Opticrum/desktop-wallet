import { useEffect, useState } from 'react'
import { liquidity } from '../api/client'
import { mapDashboardData, type MappedDashboard } from './liquidity'

let cached: MappedDashboard | null = null
const listeners = new Set<(next: MappedDashboard | null) => void>()
let inFlight = false

function publish(next: MappedDashboard) {
  cached = next
  for (const fn of listeners) fn(next)
}

async function tick() {
  if (inFlight) return
  inFlight = true
  try {
    const raw = await liquidity.getDashboard()
    publish(mapDashboardData(raw))
  } catch {
    /* keep last value — chain scan is best-effort */
  } finally {
    inFlight = false
  }
}

/** Manual refresh — same scan as hover-to-load, ignored if one is already in flight. */
export async function refreshMarketDashboard() {
  await tick()
}

/** First hover loads the dashboard; later hovers reuse the cache. */
export function ensureMarketDashboard() {
  if (cached || inFlight) return
  void tick()
}

/**
 * Shared whole-chain market dashboard. The top-bar chip is label-only, so
 * this does not poll — hover loads once, click refreshes.
 */
export function useMarketDashboard(): MappedDashboard | null {
  const [dashboard, setDashboard] = useState<MappedDashboard | null>(cached)

  useEffect(() => {
    listeners.add(setDashboard)
    if (cached) setDashboard(cached)
    return () => {
      listeners.delete(setDashboard)
    }
  }, [])

  return dashboard
}
