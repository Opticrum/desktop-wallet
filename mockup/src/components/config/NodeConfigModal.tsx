import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import { useNode } from '../../node/NodeContext'
import {
  defaultNodeConfig,
  detectChainFromRpc,
  serializeConfigYaml,
  type NodeConfig,
  type ScriptCellDep,
} from '../../mock/fiberConfig'
import type { WatchtowerConfig } from '../../mock/node'
import { ConfigFormContext, type ConfigFormApi, type DetectState } from './ConfigFormContext'
import { IconClose } from './configFields'
import {
  AdvancedPanel,
  CkbSection,
  NetworkSection,
  RpcSection,
  ScriptsSection,
  ServicesSection,
  WatchtowerSection,
} from './configSections'

type Props = {
  open: boolean
  onClose: () => void
  onToast: (msg: string) => void
  watchtower: WatchtowerConfig
  onWatchtowerChange: (config: WatchtowerConfig) => void
}

/** Large modal for editing the node's runtime config as structured fields. */
export function NodeConfigModal({
  open,
  onClose,
  onToast,
  watchtower,
  onWatchtowerChange,
}: Props) {
  const { t } = useLocale()
  const { chain, setChain } = useNode()

  const [config, setConfig] = useState<NodeConfig>(defaultNodeConfig)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [detect, setDetect] = useState<DetectState>({ status: 'idle', chain })

  // Sync persisted chain + watchtower into the form whenever the modal opens.
  useEffect(() => {
    if (!open) return
    setConfig((c) => ({
      ...c,
      fiber: {
        ...c.fiber,
        chain,
        standalone_watchtower_rpc_url:
          watchtower.mode === 'remote' && watchtower.endpoint ? watchtower.endpoint : '',
      },
    }))
    setDetect({ status: 'idle', chain })
    setAdvancedOpen(false)
  }, [open, watchtower, chain])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const yaml = useMemo(() => serializeConfigYaml(config), [config])
  const yamlBytes = new Blob([yaml]).size

  const patchFiber = (patch: Partial<NodeConfig['fiber']>) =>
    setConfig((c) => ({ ...c, fiber: { ...c.fiber, ...patch } }))
  const patchRpc = (patch: Partial<NodeConfig['rpc']>) =>
    setConfig((c) => ({ ...c, rpc: { ...c.rpc, ...patch } }))
  const patchCkb = (patch: Partial<NodeConfig['ckb']>) =>
    setConfig((c) => ({ ...c, ckb: { ...c.ckb, ...patch } }))

  const toggleService = (s: string) =>
    setConfig((c) => ({
      ...c,
      services: c.services.includes(s as NodeConfig['services'][number])
        ? c.services.filter((v) => v !== s)
        : [...c.services, s as NodeConfig['services'][number]],
    }))

  const toggleModule = (m: string) =>
    patchRpc({
      enabled_modules: config.rpc.enabled_modules.includes(m)
        ? config.rpc.enabled_modules.filter((v) => v !== m)
        : [...config.rpc.enabled_modules, m],
    })

  const updateScript = (i: number, patch: Partial<NodeConfig['scripts'][number]>) =>
    setConfig((c) => ({ ...c, scripts: c.scripts.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }))

  const switchCellDepKind = (si: number, di: number, kind: 'type_id' | 'cell_dep') =>
    setConfig((c) => ({
      ...c,
      scripts: c.scripts.map((s, idx) =>
        idx === si
          ? {
              ...s,
              cell_deps: s.cell_deps.map((d, didx) =>
                didx === di
                  ? kind === 'type_id'
                    ? { kind: 'type_id' as const, code_hash: '', hash_type: 'type', args: '0x' }
                    : { kind: 'cell_dep' as const, tx_hash: '', index: '0x0', dep_type: 'code' }
                  : d,
              ),
            }
          : s,
      ),
    }))

  const updateScriptCellDep = (si: number, di: number, patch: Partial<ScriptCellDep>) =>
    setConfig((c) => ({
      ...c,
      scripts: c.scripts.map((s, idx) =>
        idx === si
          ? { ...s, cell_deps: s.cell_deps.map((d, didx) => (didx === di ? ({ ...d, ...patch } as ScriptCellDep) : d)) }
          : s,
      ),
    }))

  const addScriptCellDep = (si: number) =>
    setConfig((c) => ({
      ...c,
      scripts: c.scripts.map((s, idx) =>
        idx === si
          ? { ...s, cell_deps: [...s.cell_deps, { kind: 'type_id' as const, code_hash: '', hash_type: 'type', args: '0x' }] }
          : s,
      ),
    }))

  const removeScriptCellDep = (si: number, di: number) =>
    setConfig((c) => ({
      ...c,
      scripts: c.scripts.map((s, idx) =>
        idx === si ? { ...s, cell_deps: s.cell_deps.filter((_, didx) => didx !== di) } : s,
      ),
    }))

  const updateUdt = (i: number, patch: Partial<NodeConfig['udtWhitelist'][number]>) =>
    setConfig((c) => ({
      ...c,
      udtWhitelist: c.udtWhitelist.map((u, idx) => (idx === i ? { ...u, ...patch } : u)),
    }))
  const addUdt = () =>
    setConfig((c) => ({
      ...c,
      udtWhitelist: [...c.udtWhitelist, { name: '', code_hash: '', hash_type: 'type', args: '0x', auto_accept_amount: 0 }],
    }))
  const removeUdt = (i: number) =>
    setConfig((c) => ({ ...c, udtWhitelist: c.udtWhitelist.filter((_, idx) => idx !== i) }))

  const handleDetect = () => {
    const detected = detectChainFromRpc(config.ckb.rpc_url)
    if (detected) {
      patchFiber({ chain: detected })
      setDetect({ status: 'ok', chain: detected })
    } else {
      setDetect({ status: 'unknown', chain: config.fiber.chain })
    }
  }

  const api: ConfigFormApi = {
    config,
    patchFiber,
    patchRpc,
    patchCkb,
    toggleService,
    toggleModule,
    updateScript,
    switchCellDepKind,
    updateScriptCellDep,
    addScriptCellDep,
    removeScriptCellDep,
    updateUdt,
    addUdt,
    removeUdt,
    detect,
    handleDetect,
    advancedOpen,
    setAdvancedOpen,
  }

  if (!open) return null

  const handleReset = () => {
    setConfig(defaultNodeConfig)
    setDetect({ status: 'idle', chain: defaultNodeConfig.fiber.chain })
  }

  const handleSave = () => {
    setChain(config.fiber.chain)
    const url = config.fiber.standalone_watchtower_rpc_url.trim()
    onWatchtowerChange(url ? { mode: 'remote', endpoint: url } : { mode: 'local' })
    onClose()
    onToast(t.nodeConfigSaved)
  }

  return (
    <ConfigFormContext.Provider value={api}>
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div
          className="config-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t.nodeConfig}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="config-modal-head">
            <div className="config-modal-head-left">
              <div className="config-modal-title">{t.nodeConfig}</div>
              <div className="config-modal-sub">
                <span className={`lm-net-badge net-${config.fiber.chain}`}>
                  {config.fiber.chain === 'mainnet' ? t.networkMainnet : t.networkTestnet}
                </span>
                <span className="config-modal-sub-path mono">config.yml</span>
              </div>
            </div>
            <button type="button" className="config-modal-close" aria-label={t.close} onClick={onClose}>
              <IconClose />
            </button>
          </div>

          <div className="config-modal-body">
            <NetworkSection />
            <ScriptsSection />
            <WatchtowerSection />
            <RpcSection />
            <CkbSection />
            <ServicesSection />
            <AdvancedPanel />
          </div>

          <div className="config-modal-foot">
            <div className="config-modal-path mono">
              ~/.fiber-node/config.yml · {(yamlBytes / 1024).toFixed(1)} KB
            </div>
            <div className="config-modal-actions">
              <button type="button" className="btn-secondary" onClick={handleReset}>
                {t.nodeConfigReset}
              </button>
              <button type="button" className="btn-primary" onClick={handleSave}>
                {t.nodeConfigSave}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ConfigFormContext.Provider>
  )
}
