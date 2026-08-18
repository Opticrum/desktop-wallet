import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import { useNode } from '../../node/NodeContext'
import { node } from '../../api/client'
import type { NodeConfig, ScriptCellDep, WatchtowerConfig } from '../../api/types'
import { defaultNodeConfig, detectChainFromRpc, serializeConfigYaml } from '../../lib/config'
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
  onWatchtowerChange: (config: WatchtowerConfig) => void
}

/** Large modal for editing the node's runtime config as structured fields.
 *  Loaded from `node.get_config` and persisted via `node.save_config`, which
 *  returns the applied chain + watchtower so the badge needs no re-fetch. */
export function NodeConfigModal({
  open,
  onClose,
  onToast,
  onWatchtowerChange,
}: Props) {
  const { t } = useLocale()
  const { setChain } = useNode()

  const [config, setConfig] = useState<NodeConfig>(defaultNodeConfig)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [detect, setDetect] = useState<DetectState>({ status: 'idle', chain: 'testnet' })
  const [tab, setTab] = useState<'form' | 'preview'>('form')
  const [copied, setCopied] = useState(false)

  // Load the authoritative config from the shell whenever the modal opens.
  useEffect(() => {
    if (!open) return
    let alive = true
    node
      .getConfig()
      .then((c) => {
        if (!alive) return
        setConfig(c)
        setDetect({ status: 'idle', chain: c.fiber.chain === 'mainnet' ? 'mainnet' : 'testnet' })
      })
      .catch(() => {
        if (alive) setConfig(defaultNodeConfig)
      })
    setAdvancedOpen(false)
    setTab('form')
    setCopied(false)
    return () => {
      alive = false
    }
  }, [open])

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

  const updateUdt = (i: number, patch: Partial<NodeConfig['udt_whitelist'][number]>) =>
    setConfig((c) => ({
      ...c,
      udt_whitelist: c.udt_whitelist.map((u, idx) => (idx === i ? { ...u, ...patch } : u)),
    }))
  const addUdt = () =>
    setConfig((c) => ({
      ...c,
      udt_whitelist: [...c.udt_whitelist, { name: '', code_hash: '', hash_type: 'type', args: '0x', auto_accept_amount: 0 }],
    }))
  const removeUdt = (i: number) =>
    setConfig((c) => ({ ...c, udt_whitelist: c.udt_whitelist.filter((_, idx) => idx !== i) }))

  const handleDetect = () => {
    const detected = detectChainFromRpc(config.ckb.rpc_url)
    if (detected) {
      patchFiber({ chain: detected })
      setDetect({ status: 'ok', chain: detected })
    } else {
      setDetect({ status: 'unknown', chain: config.fiber.chain === 'mainnet' ? 'mainnet' : 'testnet' })
    }
  }

  const handleCopyYaml = async () => {
    try {
      await navigator.clipboard.writeText(yaml)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = yaml
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
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
    setDetect({ status: 'idle', chain: defaultNodeConfig.fiber.chain === 'mainnet' ? 'mainnet' : 'testnet' })
  }

  const handleSave = async () => {
    try {
      const result = await node.saveConfig(config)
      setChain(result.chain)
      onWatchtowerChange(result.watchtower)
    } catch {
      /* mock — best-effort */
    }
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

          <div className="config-modal-tabs" role="tablist" aria-label={t.nodeConfig}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'form'}
              className={`config-modal-tab${tab === 'form' ? ' active' : ''}`}
              onClick={() => setTab('form')}
            >
              {t.cfgTabForm}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'preview'}
              className={`config-modal-tab${tab === 'preview' ? ' active' : ''}`}
              onClick={() => setTab('preview')}
            >
              {t.cfgTabPreview}
            </button>
          </div>

          {tab === 'form' ? (
            <div className="config-modal-body">
              <NetworkSection />
              <ScriptsSection />
              <WatchtowerSection />
              <RpcSection />
              <CkbSection />
              <ServicesSection />
              <AdvancedPanel />
            </div>
          ) : (
            <div className="config-modal-body">
              <div className="config-preview">
                <div className="config-preview-head">
                  <span className="config-preview-title mono">
                    config.yml · {(yamlBytes / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    className={`btn-secondary config-preview-copy${copied ? ' copied' : ''}`}
                    onClick={handleCopyYaml}
                  >
                    {copied ? t.copied : t.cfgCopyConfig}
                  </button>
                </div>
                <pre className="config-preview-body mono">
                  <code>{yaml}</code>
                </pre>
              </div>
            </div>
          )}

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
