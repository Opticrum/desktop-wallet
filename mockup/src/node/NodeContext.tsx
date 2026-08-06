import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { nodeRuntime } from '../mock/node'

export type NodeChain = 'mainnet' | 'testnet'

type NodeCtx = {
  /** CKB chain the node is configured for — drives the liquidity market network. */
  chain: NodeChain
  setChain: (chain: NodeChain) => void
}

const NodeContext = createContext<NodeCtx | null>(null)

export function NodeProvider({ children }: { children: ReactNode }) {
  const [chain, setChain] = useState<NodeChain>(nodeRuntime.chain)

  const value = useMemo(() => ({ chain, setChain }), [chain])

  return <NodeContext.Provider value={value}>{children}</NodeContext.Provider>
}

export function useNode() {
  const ctx = useContext(NodeContext)
  if (!ctx) throw new Error('useNode outside NodeProvider')
  return ctx
}
