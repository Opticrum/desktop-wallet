import { useLocale } from '../../i18n/LocaleContext'
import { HASH_TYPES, RPC_MODULES, SERVICES } from '../../lib/config'
import { useConfigForm } from './ConfigFormContext'
import {
  Section,
  TextField,
  NumberField,
  SelectField,
  ToggleRow,
  CheckGrid,
  TagEditor,
  ItemCard,
  IconGlobe,
  IconCode,
  IconShield,
  IconTerminal,
  IconLink,
  IconLayers,
  IconSliders,
  IconChevron,
} from './configFields'

// ── Network & identity ──────────────────────────────────────────────────────

export function NetworkSection() {
  const { t } = useLocale()
  const { config, patchFiber } = useConfigForm()
  return (
    <Section title={t.cfgSectionNetwork} icon={<IconGlobe />}>
      <TextField
        label={t.cfgListenAddr}
        value={config.fiber.listening_addr}
        onChange={(v) => patchFiber({ listening_addr: v })}
        mono
      />
      <TextField
        label={t.cfgNodeName}
        value={config.fiber.announced_node_name}
        onChange={(v) => patchFiber({ announced_node_name: v })}
      />
      <TagEditor
        label={t.cfgBootnodes}
        items={config.fiber.bootnode_addrs}
        onAdd={(v) => patchFiber({ bootnode_addrs: [...config.fiber.bootnode_addrs, v] })}
        onRemove={(v) => patchFiber({ bootnode_addrs: config.fiber.bootnode_addrs.filter((a) => a !== v) })}
        placeholder="/ip4/…/tcp/8228/p2p/…"
      />
      <ToggleRow
        title={t.cfgAnnounceListen}
        checked={config.fiber.announce_listening_addr}
        onChange={(v) => patchFiber({ announce_listening_addr: v })}
      />
      <TagEditor
        label={t.cfgAnnouncedAddrs}
        items={config.fiber.announced_addrs}
        onAdd={(v) => patchFiber({ announced_addrs: [...config.fiber.announced_addrs, v] })}
        onRemove={(v) => patchFiber({ announced_addrs: config.fiber.announced_addrs.filter((a) => a !== v) })}
        placeholder="/ip4/你的公网 IP/tcp/8228"
        disabled={!config.fiber.announce_listening_addr}
      />
    </Section>
  )
}

// ── Contract scripts (fixed FundingLock / CommitmentLock) ───────────────────

export function ScriptsSection() {
  const { t } = useLocale()
  const {
    config,
    updateScript,
    switchCellDepKind,
    updateScriptCellDep,
    addScriptCellDep,
    removeScriptCellDep,
  } = useConfigForm()
  return (
    <Section title={t.cfgSectionScripts} icon={<IconCode />}>
      {config.scripts.map((s, i) => (
        <div key={i} className="config-item-card">
          <div className="config-item-head">
            <span className="config-script-name mono">{s.name}</span>
          </div>
          <div className="config-item-grid">
            <TextField label={t.cfgScriptCodeHash} value={s.code_hash} onChange={(v) => updateScript(i, { code_hash: v })} mono />
            <SelectField label={t.cfgHashType} value={s.hash_type} options={HASH_TYPES} onChange={(v) => updateScript(i, { hash_type: v })} />
            <TextField label={t.cfgArgs} value={s.args} onChange={(v) => updateScript(i, { args: v })} mono />
          </div>
          <div className="config-celldeps">
            <span className="config-url-label">{t.cfgCellDeps}</span>
            {s.cell_deps.map((dep, di) => (
              <div key={di} className="config-celldep">
                <div className="config-celldep-head">
                  <div className="radio-pill config-celldep-kind">
                    {(['type_id', 'cell_dep'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={dep.kind === k ? 'active' : ''}
                        onClick={() => switchCellDepKind(i, di, k)}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="config-item-remove"
                    aria-label={t.cfgRemove}
                    onClick={() => removeScriptCellDep(i, di)}
                  >
                    ×
                  </button>
                </div>
                {dep.kind === 'type_id' ? (
                  <div className="config-item-grid">
                    <TextField label={t.cfgScriptCodeHash} value={dep.code_hash} onChange={(v) => updateScriptCellDep(i, di, { code_hash: v })} mono />
                    <SelectField label={t.cfgHashType} value={dep.hash_type} options={HASH_TYPES} onChange={(v) => updateScriptCellDep(i, di, { hash_type: v })} />
                    <TextField label={t.cfgArgs} value={dep.args} onChange={(v) => updateScriptCellDep(i, di, { args: v })} mono />
                  </div>
                ) : (
                  <div className="config-item-grid">
                    <TextField label={t.cfgTxHash} value={dep.tx_hash} onChange={(v) => updateScriptCellDep(i, di, { tx_hash: v })} mono />
                    <TextField label={t.cfgIndex} value={dep.index} onChange={(v) => updateScriptCellDep(i, di, { index: v })} mono />
                    <SelectField label={t.cfgDepType} value={dep.dep_type} options={['code', 'dep_group']} onChange={(v) => updateScriptCellDep(i, di, { dep_type: v as 'code' | 'dep_group' })} />
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="config-add-btn" onClick={() => addScriptCellDep(i)}>
              + cell_dep
            </button>
          </div>
        </div>
      ))}
    </Section>
  )
}

// ── Watchtower ──────────────────────────────────────────────────────────────

export function WatchtowerSection() {
  const { t } = useLocale()
  const { config, patchFiber } = useConfigForm()
  const wtUrl = config.fiber.standalone_watchtower_rpc_url
  const wtEnabled = wtUrl !== ''
  return (
    <Section title={t.watchtower} icon={<IconShield />}>
      <ToggleRow
        title={t.cfgDisableBuiltinWatchtower}
        desc={t.cfgDisableBuiltinWatchtowerDesc}
        checked={config.fiber.disable_built_in_watchtower}
        onChange={(v) => patchFiber({ disable_built_in_watchtower: v })}
      />
      <ToggleRow
        title={t.watchtowerRemoteEnable}
        desc={t.watchtowerRemoteDesc}
        checked={wtEnabled}
        onChange={(v) =>
          patchFiber({ standalone_watchtower_rpc_url: v ? '/ip4/45.77.65.221/tcp/8115' : '' })
        }
      />
      {wtEnabled && (
        <>
          <TextField
            label={t.watchtowerUrl}
            value={wtUrl}
            onChange={(v) => patchFiber({ standalone_watchtower_rpc_url: v })}
            mono
          />
          <TextField
            label={t.watchtowerToken}
            desc={t.watchtowerTokenDesc}
            value={config.fiber.standalone_watchtower_token}
            onChange={(v) => patchFiber({ standalone_watchtower_token: v })}
            mono
          />
        </>
      )}
      <NumberField
        label={t.cfgWatchtowerInterval}
        value={config.fiber.watchtower_check_interval_seconds}
        onChange={(v) => patchFiber({ watchtower_check_interval_seconds: v })}
      />
    </Section>
  )
}

// ── RPC ─────────────────────────────────────────────────────────────────────

export function RpcSection() {
  const { t } = useLocale()
  const { config, patchRpc, toggleModule } = useConfigForm()
  return (
    <Section title={t.cfgSectionRpc} icon={<IconTerminal />}>
      <TextField
        label={t.cfgRpcListenAddr}
        value={config.rpc.listening_addr}
        onChange={(v) => patchRpc({ listening_addr: v })}
        mono
      />
      <div className="config-url-row">
        <label className="config-url-label">{t.cfgEnabledModules}</label>
        <CheckGrid options={RPC_MODULES} selected={config.rpc.enabled_modules} onToggle={toggleModule} mono />
      </div>
    </Section>
  )
}

// ── CKB (rpc + network detection + UDT whitelist) ───────────────────────────

export function CkbSection() {
  const { t } = useLocale()
  const { config, patchCkb, updateUdt, addUdt, removeUdt, detect, handleDetect } = useConfigForm()
  return (
    <Section title={t.cfgSectionCkb} icon={<IconLink />}>
      <TextField
        label={t.rpcUrlLabel}
        value={config.ckb.rpc_url}
        onChange={(v) => patchCkb({ rpc_url: v })}
        mono
      />
      <div className="config-net-detect">
        <button type="button" className="btn-secondary" onClick={handleDetect}>
          {t.cfgDetectNetwork}
        </button>
        {detect.status === 'ok' && (
          <span className={`lm-net-badge net-${detect.chain}`}>
            {detect.chain === 'mainnet' ? t.networkMainnet : t.networkTestnet}
          </span>
        )}
        {detect.status === 'unknown' && <span className="config-net-unknown">{t.cfgNetworkUnknown}</span>}
        <span className="config-net-hint">{t.cfgNetworkFromRpc}</span>
      </div>
      <NumberField
        label={t.cfgCkbPolling}
        value={config.ckb.tx_tracing_polling_interval_ms}
        onChange={(v) => patchCkb({ tx_tracing_polling_interval_ms: v })}
      />
      <label className="config-url-label">{t.cfgUdtWhitelist}</label>
      {config.udt_whitelist.length === 0 && <div className="config-empty">{t.cfgUdtEmpty}</div>}
      {config.udt_whitelist.map((u, i) => (
        <ItemCard
          key={i}
          head={
            <input
              className="config-url-input config-udt-name"
              value={u.name}
              onChange={(e) => updateUdt(i, { name: e.target.value })}
              placeholder="RUSD"
              spellCheck={false}
            />
          }
          onRemove={() => removeUdt(i)}
        >
          <TextField label={t.cfgScriptCodeHash} value={u.code_hash} onChange={(v) => updateUdt(i, { code_hash: v })} mono />
          <SelectField label={t.cfgHashType} value={u.hash_type} options={HASH_TYPES} onChange={(v) => updateUdt(i, { hash_type: v })} />
          <TextField label={t.cfgArgs} value={u.args} onChange={(v) => updateUdt(i, { args: v })} mono />
          <NumberField label={t.cfgUdtAutoAccept} value={u.auto_accept_amount} onChange={(v) => updateUdt(i, { auto_accept_amount: v })} />
        </ItemCard>
      ))}
      <button type="button" className="config-add-btn config-list-add" onClick={addUdt}>
        + {t.cfgAddUdt}
      </button>
    </Section>
  )
}

// ── Services ────────────────────────────────────────────────────────────────

export function ServicesSection() {
  const { t } = useLocale()
  const { config, toggleService } = useConfigForm()
  return (
    <Section title={t.cfgSectionServices} icon={<IconLayers />}>
      <CheckGrid options={SERVICES} selected={config.services} onToggle={toggleService} />
    </Section>
  )
}

// ── Advanced (subtle, at the very bottom) ───────────────────────────────────

export function AdvancedPanel() {
  const { t } = useLocale()
  const { config, patchFiber, advancedOpen, setAdvancedOpen } = useConfigForm()
  return (
    <div className="config-advanced">
      <button
        type="button"
        className={`config-advanced-toggle${advancedOpen ? ' open' : ''}`}
        onClick={() => setAdvancedOpen(!advancedOpen)}
      >
        <IconSliders />
        <span>{t.cfgSectionAdvanced}</span>
        <IconChevron />
      </button>
      {advancedOpen && (
        <div className="config-advanced-panel">
          <div className="config-advanced-grid">
            <NumberField
              label={t.cfgAutoAcceptMin}
              value={config.fiber.open_channel_auto_accept_min_ckb_funding_amount}
              onChange={(v) => patchFiber({ open_channel_auto_accept_min_ckb_funding_amount: v })}
            />
            <NumberField
              label={t.cfgAutoAcceptAmount}
              value={config.fiber.auto_accept_channel_ckb_funding_amount}
              onChange={(v) => patchFiber({ auto_accept_channel_ckb_funding_amount: v })}
            />
            <NumberField
              label={t.cfgTlcExpiry}
              value={config.fiber.tlc_expiry_delta}
              onChange={(v) => patchFiber({ tlc_expiry_delta: v })}
            />
            <NumberField
              label={t.cfgTlcFee}
              value={config.fiber.tlc_fee_proportional_millionths}
              onChange={(v) => patchFiber({ tlc_fee_proportional_millionths: v })}
            />
            <NumberField
              label={t.cfgFundingTimeout}
              value={config.fiber.funding_timeout_seconds}
              onChange={(v) => patchFiber({ funding_timeout_seconds: v })}
            />
            <NumberField
              label={t.cfgMaxInbound}
              value={config.fiber.max_inbound_peers}
              onChange={(v) => patchFiber({ max_inbound_peers: v })}
            />
            <NumberField
              label={t.cfgMinOutbound}
              value={config.fiber.min_outbound_peers}
              onChange={(v) => patchFiber({ min_outbound_peers: v })}
            />
            <TextField
              label={t.cfgProxyUrl}
              value={config.fiber.proxy_url}
              onChange={(v) => patchFiber({ proxy_url: v })}
              placeholder="socks5://127.0.0.1:9050"
              mono
            />
            <ToggleRow
              title={t.cfgAutoAnnounceNode}
              checked={config.fiber.auto_announce_node}
              onChange={(v) => patchFiber({ auto_announce_node: v })}
            />
            <ToggleRow
              title={t.cfgSyncGraph}
              checked={config.fiber.sync_network_graph}
              onChange={(v) => patchFiber({ sync_network_graph: v })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
