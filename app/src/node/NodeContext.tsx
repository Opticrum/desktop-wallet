import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { node } from '../api/client'
import type { Chain } from '../api/types'

/** Back-compat alias — used by the config form context. */
export type NodeChain = Chain

type NodeCtx = {
  /** CKB chain the node is configured for — drives the liquidity market network. */
  chain: Chain
  setChain: (chain: Chain) => void
}

const NodeContext = createContext<NodeCtx | null>(null)

export function NodeProvider({ children }: { children: ReactNode }) {
  // Authoritative chain comes from `node.get_runtime` (persisted config);
  // `setChain` is called with the result of `node.save_config`.
  const [chain, setChain] = useState<Chain>('testnet')

  useEffect(() => {
    let alive = true
    node
      .getRuntime()
      .then((r) => {
        if (alive) setChain(r.chain)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo(() => ({ chain, setChain }), [chain])

  return <NodeContext.Provider value={value}>{children}</NodeContext.Provider>
}

export function useNode() {
  const ctx = useContext(NodeContext)
  if (!ctx) throw new Error('useNode outside NodeProvider')
  return ctx
}
