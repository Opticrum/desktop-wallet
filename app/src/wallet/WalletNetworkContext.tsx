import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { wallet } from '../api/client'
import { toCommandError, type Chain, type WalletStatus } from '../api/types'
import {
  invalidateMarketDashboard,
  setMarketDashboardChain,
} from '../lib/useMarketDashboard'

type WalletNetworkCtx = {
  /** Active wallet CKB network (address HRP + Opticrum market). */
  chain: Chain
  status: WalletStatus | null
  switching: boolean
  switchError: string | null
  /** Bumped after a successful network switch so drawers reload summary/txs. */
  refreshEpoch: number
  setNetwork: (chain: Chain) => Promise<void>
  /** Re-poll fast status (e.g. after unlock / create). */
  refreshStatus: () => Promise<void>
}

const WalletNetworkContext = createContext<WalletNetworkCtx | null>(null)

const DEFAULT_STATUS: WalletStatus = {
  hasWallet: false,
  unlocked: false,
  address: '',
  chain: 'testnet',
}

export function WalletNetworkProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus | null>(null)
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [refreshEpoch, setRefreshEpoch] = useState(0)

  const refreshStatus = useCallback(async () => {
    try {
      const next = await wallet.getStatus()
      setStatus(next)
    } catch {
      /* keep last */
    }
  }, [])

  useEffect(() => {
    let alive = true
    const poll = () =>
      wallet
        .getStatus()
        .then((s) => {
          if (alive) setStatus(s)
        })
        .catch(() => {})
    poll()
    const id = window.setInterval(poll, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (status?.chain) setMarketDashboardChain(status.chain)
  }, [status?.chain])

  const setNetwork = useCallback(async (chain: Chain) => {
    if (switching) return
    const current = status?.chain ?? 'testnet'
    if (chain === current) return
    setSwitching(true)
    setSwitchError(null)
    try {
      const next = await wallet.setNetwork(chain)
      setStatus(next)
      invalidateMarketDashboard()
      setRefreshEpoch((n) => n + 1)
    } catch (e) {
      setSwitchError(toCommandError(e).message)
      throw e
    } finally {
      setSwitching(false)
    }
  }, [status?.chain, switching])

  const value = useMemo(
    () => ({
      chain: status?.chain ?? DEFAULT_STATUS.chain,
      status,
      switching,
      switchError,
      refreshEpoch,
      setNetwork,
      refreshStatus,
    }),
    [status, switching, switchError, refreshEpoch, setNetwork, refreshStatus],
  )

  return (
    <WalletNetworkContext.Provider value={value}>{children}</WalletNetworkContext.Provider>
  )
}

export function useWalletNetwork() {
  const ctx = useContext(WalletNetworkContext)
  if (!ctx) throw new Error('useWalletNetwork outside WalletNetworkProvider')
  return ctx
}
