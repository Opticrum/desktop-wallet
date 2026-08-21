import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { node } from '../api/client'
import type { Chain } from '../api/types'

/** Back-compat alias — used by the config form context. */
export type NodeChain = Chain

type NodeCtx = {
  /** CKB chain the node is configured for — drives the liquidity market network. */
  chain: Chain
  setChain: (chain: Chain) => void
  /** Whether the embedded node is up and fully started — gates every action
   *  that needs the node (出金/入金, liquidity 注入/抽离, publish/cancel). */
  running: boolean
  starting: boolean
  /** The fiber node's identity pubkey (66-hex). Orders whose cell pubkey differs
   *  were created under an older/different node identity → flagged as legacy. */
  fiberPubkey: string
}

const NodeContext = createContext<NodeCtx | null>(null)

export function NodeProvider({ children }: { children: ReactNode }) {
  // Authoritative chain comes from `node.get_runtime` (persisted config);
  // `setChain` is called with the result of `node.save_config`.
  const [chain, setChain] = useState<Chain>('testnet')
  // Optimistic default — the mock runtime is up; real node resolves on the
  // first poll. Conservative readers should gate on `running && !starting`.
  const [running, setRunning] = useState(true)
  const [starting, setStarting] = useState(false)
  const [fiberPubkey, setFiberPubkey] = useState('')

  useEffect(() => {
    let alive = true
    const poll = () =>
      node
        .getRuntime()
        .then((r) => {
          if (!alive) return
          setChain(r.chain)
          setRunning(r.running)
          setStarting(r.starting)
          setFiberPubkey(r.fiberPubkey)
        })
        .catch(() => {})
    poll()
    // Poll so node-dependent actions disable promptly when the node stops and
    // re-enable once it is back up (mirrors NodeControlPanel's cadence).
    const id = window.setInterval(poll, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const value = useMemo(
    () => ({ chain, setChain, running, starting, fiberPubkey }),
    [chain, running, starting, fiberPubkey],
  )

  return <NodeContext.Provider value={value}>{children}</NodeContext.Provider>
}

export function useNode() {
  const ctx = useContext(NodeContext)
  if (!ctx) throw new Error('useNode outside NodeProvider')
  return ctx
}
