import { createContext, useContext } from 'react'
import type { NodeConfig, ScriptCellDep } from '../../mock/fiberConfig'
import type { NodeChain } from '../../node/NodeContext'

export type DetectState = { status: 'idle' | 'ok' | 'unknown'; chain: NodeChain }

export type ConfigFormApi = {
  config: NodeConfig
  patchFiber: (patch: Partial<NodeConfig['fiber']>) => void
  patchRpc: (patch: Partial<NodeConfig['rpc']>) => void
  patchCkb: (patch: Partial<NodeConfig['ckb']>) => void
  toggleService: (s: string) => void
  toggleModule: (m: string) => void
  updateScript: (i: number, patch: Partial<NodeConfig['scripts'][number]>) => void
  switchCellDepKind: (si: number, di: number, kind: 'type_id' | 'cell_dep') => void
  updateScriptCellDep: (si: number, di: number, patch: Partial<ScriptCellDep>) => void
  addScriptCellDep: (si: number) => void
  removeScriptCellDep: (si: number, di: number) => void
  updateUdt: (i: number, patch: Partial<NodeConfig['udtWhitelist'][number]>) => void
  addUdt: () => void
  removeUdt: (i: number) => void
  detect: DetectState
  handleDetect: () => void
  advancedOpen: boolean
  setAdvancedOpen: (open: boolean) => void
}

export const ConfigFormContext = createContext<ConfigFormApi | null>(null)

export function useConfigForm() {
  const ctx = useContext(ConfigFormContext)
  if (!ctx) throw new Error('useConfigForm outside ConfigFormContext.Provider')
  return ctx
}
