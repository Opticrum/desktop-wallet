import { useEffect, useState } from 'react'
import { liquidity } from '../api/client'
import type { Chain } from '../api/types'
import { mapDashboardData, type MappedDashboard } from './liquidity'

/** Per-chain cache so switching networks never shows the other chain's snapshot. */
const cachedByChain: Partial<Record<Chain, MappedDashboard | null>> = {}
const listeners = new Set<(chain: Chain, next: MappedDashboard | null) => void>()
let inFlightChain: Chain | null = null
/** Active wallet chain the market follows — set by WalletNetworkContext. */
let activeChain: Chain = 'testnet'

function publish(chain: Chain, next: MappedDashboard | null) {
  cachedByChain[chain] = next
  for (const fn of listeners) fn(chain, next)
}

async function tick(chain: Chain) {
  if (inFlightChain === chain) return
  if (chain === 'mainnet') {
    // Opticrum contracts are testnet-only — never scan mainnet.
    publish(chain, null)
    return
  }
  inFlightChain = chain
  try {
    const raw = await liquidity.getDashboard()
    // Ignore stale responses if the wallet switched mid-flight.
    if (activeChain !== chain) return
    publish(chain, mapDashboardData(raw))
  } catch {
    /* keep last value — chain scan is best-effort */
  } finally {
    if (inFlightChain === chain) inFlightChain = null
  }
}

/** Drop all cached dashboards after a wallet network switch. */
export function invalidateMarketDashboard() {
  for (const key of Object.keys(cachedByChain) as Chain[]) {
    cachedByChain[key] = null
  }
  for (const fn of listeners) fn(activeChain, null)
}

/** Tell the market which wallet chain is active (no fetch by itself). */
export function setMarketDashboardChain(chain: Chain) {
  if (activeChain === chain) return
  activeChain = chain
  for (const fn of listeners) fn(chain, cachedByChain[chain] ?? null)
}

/** Manual refresh — same scan as hover-to-load, ignored if one is already in flight. */
export async function refreshMarketDashboard() {
  await tick(activeChain)
}

/** First hover loads the dashboard; later hovers reuse the cache for this chain. */
export function ensureMarketDashboard() {
  if (activeChain === 'mainnet') return
  if (cachedByChain[activeChain] || inFlightChain === activeChain) return
  void tick(activeChain)
}

/**
 * Shared whole-chain market dashboard. The top-bar chip is label-only, so
 * this does not poll — hover loads once, click refreshes. Follows the wallet
 * network via `setMarketDashboardChain`.
 */
export function useMarketDashboard(chain: Chain = activeChain): MappedDashboard | null {
  const [dashboard, setDashboard] = useState<MappedDashboard | null>(
    cachedByChain[chain] ?? null,
  )

  useEffect(() => {
    setMarketDashboardChain(chain)
    const onUpdate = (c: Chain, next: MappedDashboard | null) => {
      if (c === chain) setDashboard(next)
    }
    listeners.add(onUpdate)
    setDashboard(cachedByChain[chain] ?? null)
    return () => {
      listeners.delete(onUpdate)
    }
  }, [chain])

  return dashboard
}

/** Whether the Opticrum market is available for the given wallet chain. */
export function isMarketAvailable(chain: Chain): boolean {
  return chain === 'testnet'
}
