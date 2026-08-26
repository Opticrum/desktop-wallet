import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { node } from '../api/client'
import type { Chain, NodeKind, NodeRuntime } from '../api/types'

/** Back-compat alias — used by the config form context. */
export type NodeChain = Chain

type NodeCtx = {
  /** CKB chain the *selected* node is on — independent of wallet network. */
  chain: Chain
  setChain: (chain: Chain) => void
  /** Whether the selected Fiber RPC is reachable / the builtin process is up. */
  running: boolean
  starting: boolean
  /** The selected node's identity pubkey (66-hex). Orders whose cell pubkey
   *  differs were created under an older/different node identity → flagged as legacy. */
  fiberPubkey: string
  kind: NodeKind
  targetId: string
  /** Push a runtime snapshot immediately after `node.set_active` so liquidity
   *  gating doesn't wait for the 5s poll. */
  applyRuntime: (r: NodeRuntime) => void
}

const NodeContext = createContext<NodeCtx | null>(null)

export function NodeProvider({ children }: { children: ReactNode }) {
  const [chain, setChain] = useState<Chain>('testnet')
  const [running, setRunning] = useState(true)
  const [starting, setStarting] = useState(false)
  const [fiberPubkey, setFiberPubkey] = useState('')
  const [kind, setKind] = useState<NodeKind>('builtin')
  const [targetId, setTargetId] = useState('builtin')

  const applyRuntime = useCallback((r: NodeRuntime) => {
    setChain(r.chain)
    setRunning(r.running)
    setStarting(r.starting)
    setFiberPubkey(r.fiberPubkey)
    setKind(r.kind ?? 'builtin')
    setTargetId(r.targetId || 'builtin')
  }, [])

  useEffect(() => {
    let alive = true
    const poll = () =>
      node
        .getRuntime()
        .then((r) => {
          if (!alive) return
          applyRuntime(r)
        })
        .catch(() => {})
    poll()
    const id = window.setInterval(poll, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [applyRuntime])

  const value = useMemo(
    () => ({
      chain,
      setChain,
      running,
      starting,
      fiberPubkey,
      kind,
      targetId,
      applyRuntime,
    }),
    [chain, running, starting, fiberPubkey, kind, targetId, applyRuntime],
  )

  return <NodeContext.Provider value={value}>{children}</NodeContext.Provider>
}

export function useNode() {
  const ctx = useContext(NodeContext)
  if (!ctx) throw new Error('useNode outside NodeProvider')
  return ctx
}
