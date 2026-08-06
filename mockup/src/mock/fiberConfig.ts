// ── Fiber node config.yml — typed structure, defaults + YAML serializer ─────
// Field names mirror the real fiber-node config
// (fiber-lib/src/fiber/config.rs, rpc/config.rs, ckb/config.rs).

import type { NodeChain } from '../node/NodeContext'

export type Service = 'fiber' | 'cch' | 'rpc' | 'ckb'

/** A `cell_deps` entry on a script — either a Type ID script or a direct CellDep. */
export type ScriptCellDep =
  | { kind: 'type_id'; code_hash: string; hash_type: string; args: string }
  | { kind: 'cell_dep'; tx_hash: string; index: string; dep_type: 'code' | 'dep_group' }

export type FiberScript = {
  name: string
  code_hash: string
  hash_type: string
  args: string
  cell_deps: ScriptCellDep[]
}

export type UdtWhitelistEntry = {
  name: string
  code_hash: string
  hash_type: string
  args: string
  auto_accept_amount: number
  cell_deps?: ScriptCellDep[]
}

export type NodeConfig = {
  services: Service[]
  fiber: {
    chain: NodeChain
    announced_node_name: string
    listening_addr: string
    announce_listening_addr: boolean
    bootnode_addrs: string[]
    announced_addrs: string[]
    // advanced
    standalone_watchtower_rpc_url: string
    watchtower_check_interval_seconds: number
    disable_built_in_watchtower: boolean
    open_channel_auto_accept_min_ckb_funding_amount: number
    auto_accept_channel_ckb_funding_amount: number
    tlc_expiry_delta: number
    tlc_fee_proportional_millionths: number
    funding_timeout_seconds: number
    max_inbound_peers: number
    min_outbound_peers: number
    sync_network_graph: boolean
    auto_announce_node: boolean
    proxy_url: string
  }
  rpc: {
    listening_addr: string
    enabled_modules: string[]
  }
  ckb: {
    rpc_url: string
    tx_tracing_polling_interval_ms: number
  }
  scripts: FiberScript[]
  udtWhitelist: UdtWhitelistEntry[]
}

// ── Enumerations (from fiber-lib source) ────────────────────────────────────

/** Valid `rpc.enabled_modules` values. */
export const RPC_MODULES = [
  'invoice',
  'graph',
  'info',
  'peer',
  'channel',
  'payment',
  'watchtower',
  'cch',
  'dev',
  'admin',
  'prof',
  'pubsub',
]

/** Valid `services` values (case-insensitive in fiber). */
export const SERVICES: Service[] = ['fiber', 'cch', 'rpc', 'ckb']

/** `Contract` enum names for `fiber.scripts[].name`. */
export const SCRIPT_TYPES = ['CkbAuth', 'FundingLock', 'CommitmentLock', 'Secp256k1Lock', 'SimpleUDT']

/** Valid CKB script `hash_type` values. */
export const HASH_TYPES = ['type', 'data', 'data1', 'data2']

// ── Defaults ────────────────────────────────────────────────────────────────

export const defaultNodeConfig: NodeConfig = {
  services: ['fiber', 'rpc', 'ckb'],
  fiber: {
    chain: 'testnet',
    announced_node_name: 'ckb-bot-sg',
    listening_addr: '/ip4/0.0.0.0/tcp/8228',
    announce_listening_addr: true,
    bootnode_addrs: [
      '/ip4/54.179.226.154/tcp/8228/p2p/Qmes1EBD4yNo9Ywkfe6eRw9tG1nVNGLDmMud1xJMsoYFKy',
      '/ip4/16.163.7.105/tcp/8228/p2p/QmdyQWjPtbK4NWWsvy8s69NGJaQULwgeQDT5ZpNDrTNaeV',
    ],
    announced_addrs: [],
    standalone_watchtower_rpc_url: '/ip4/45.77.65.221/tcp/8115',
    watchtower_check_interval_seconds: 60,
    disable_built_in_watchtower: false,
    open_channel_auto_accept_min_ckb_funding_amount: 10_000_000_000,
    auto_accept_channel_ckb_funding_amount: 9_900_000_000,
    tlc_expiry_delta: 14_400_000,
    tlc_fee_proportional_millionths: 1000,
    funding_timeout_seconds: 86_400,
    max_inbound_peers: 16,
    min_outbound_peers: 8,
    sync_network_graph: true,
    auto_announce_node: true,
    proxy_url: '',
  },
  rpc: {
    listening_addr: '127.0.0.1:8227',
    enabled_modules: ['cch', 'channel', 'graph', 'payment', 'info', 'invoice', 'peer', 'watchtower'],
  },
  ckb: {
    rpc_url: 'https://testnet.ckbapp.dev/',
    tx_tracing_polling_interval_ms: 4000,
  },
  scripts: [
    {
      name: 'FundingLock',
      code_hash: '0x6c67887fe201ee0c7853f1682c0b77c0e6214044c156c7558269390a8afa6d7c',
      hash_type: 'type',
      args: '0x',
      cell_deps: [
        {
          kind: 'type_id',
          code_hash: '0x00000000000000000000000000000000000000000000000000545950455f4944',
          hash_type: 'type',
          args: '0x3cb7c0304fe53f75bb5727e2484d0beae4bd99d979813c6fc97c3cca569f10f6',
        },
        {
          kind: 'cell_dep',
          tx_hash: '0x12c569a258dd9c5bd99f632bb8314b1263b90921ba31496467580d6b79dd14a7',
          index: '0x0',
          dep_type: 'code',
        },
      ],
    },
    {
      name: 'CommitmentLock',
      code_hash: '0x740dee83f87c6f309824d8fd3fbdd3c8380ee6fc9acc90b1a748438afcdf81d8',
      hash_type: 'type',
      args: '0x',
      cell_deps: [
        {
          kind: 'type_id',
          code_hash: '0x00000000000000000000000000000000000000000000000000545950455f4944',
          hash_type: 'type',
          args: '0xf7e458887495cf70dd30d1543cad47dc1dfe9d874177bf19291e4db478d5751b',
        },
        {
          kind: 'cell_dep',
          tx_hash: '0x12c569a258dd9c5bd99f632bb8314b1263b90921ba31496467580d6b79dd14a7',
          index: '0x0',
          dep_type: 'code',
        },
      ],
    },
  ],
  udtWhitelist: [
    {
      name: 'RUSD',
      code_hash: '0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a',
      hash_type: 'type',
      args: '0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b',
      auto_accept_amount: 1_000_000_000,
      cell_deps: [
        {
          kind: 'type_id',
          code_hash: '0x00000000000000000000000000000000000000000000000000545950455f4944',
          hash_type: 'type',
          args: '0x97d30b723c0b2c66e9cb8d4d0df4ab5d7222cbb00d4a9a2055ce2e5d7f0d8b0f',
        },
      ],
    },
  ],
}

/** Infer the CKB network from a trusted node RPC URL. `null` = unrecognized. */
export function detectChainFromRpc(rpcUrl: string): NodeChain | null {
  const url = rpcUrl.toLowerCase()
  if (url.includes('testnet')) return 'testnet'
  if (url.includes('mainnet')) return 'mainnet'
  return null
}

// ── YAML serializer (config object → config.yml text) ───────────────────────

const yamlStr = (v: string | boolean | number): string =>
  typeof v === 'string' ? `"${v}"` : String(v)

export function serializeConfigYaml(c: NodeConfig): string {
  const lines: string[] = [
    '# Fiber node configuration — config.yml',
    '# generated from the Opticrum Desktop config form',
    `# node: ${c.fiber.announced_node_name} · chain: ${c.fiber.chain}`,
  ]

  // fiber
  lines.push('fiber:')
  lines.push(`  listening_addr: ${yamlStr(c.fiber.listening_addr)}`)
  lines.push(`  announced_node_name: ${yamlStr(c.fiber.announced_node_name)}`)
  if (c.fiber.bootnode_addrs.length > 0) {
    lines.push('  bootnode_addrs:')
    for (const addr of c.fiber.bootnode_addrs) lines.push(`    - ${yamlStr(addr)}`)
  }
  lines.push(`  announce_listening_addr: ${c.fiber.announce_listening_addr}`)
  if (c.fiber.announced_addrs.length > 0) {
    lines.push('  announced_addrs:')
    for (const addr of c.fiber.announced_addrs) lines.push(`    - ${yamlStr(addr)}`)
  }
  lines.push(`  chain: ${c.fiber.chain}`)
  lines.push('  scripts:')
  for (const s of c.scripts) {
    lines.push(`    - name: ${s.name}`)
    lines.push('      script:')
    lines.push(`        code_hash: ${s.code_hash}`)
    lines.push(`        hash_type: ${s.hash_type}`)
    lines.push(`        args: ${s.args}`)
    lines.push('      cell_deps:')
    for (const dep of s.cell_deps) {
      if (dep.kind === 'type_id') {
        lines.push('        - type_id:')
        lines.push(`            code_hash: ${dep.code_hash}`)
        lines.push(`            hash_type: ${dep.hash_type}`)
        lines.push(`            args: ${dep.args}`)
      } else {
        lines.push('        - cell_dep:')
        lines.push('            out_point:')
        lines.push(`              tx_hash: ${dep.tx_hash}`)
        lines.push(`              index: ${dep.index}`)
        lines.push(`            dep_type: ${dep.dep_type}`)
      }
    }
  }
  lines.push(`  open_channel_auto_accept_min_ckb_funding_amount: ${c.fiber.open_channel_auto_accept_min_ckb_funding_amount}`)
  lines.push(`  auto_accept_channel_ckb_funding_amount: ${c.fiber.auto_accept_channel_ckb_funding_amount}`)
  lines.push(`  tlc_expiry_delta: ${c.fiber.tlc_expiry_delta}`)
  lines.push(`  tlc_fee_proportional_millionths: ${c.fiber.tlc_fee_proportional_millionths}`)
  lines.push(`  funding_timeout_seconds: ${c.fiber.funding_timeout_seconds}`)
  lines.push(`  max_inbound_peers: ${c.fiber.max_inbound_peers}`)
  lines.push(`  min_outbound_peers: ${c.fiber.min_outbound_peers}`)
  lines.push(`  sync_network_graph: ${c.fiber.sync_network_graph}`)
  lines.push(`  auto_announce_node: ${c.fiber.auto_announce_node}`)
  lines.push(`  watchtower_check_interval_seconds: ${c.fiber.watchtower_check_interval_seconds}`)
  if (c.fiber.standalone_watchtower_rpc_url) {
    lines.push(`  standalone_watchtower_rpc_url: ${yamlStr(c.fiber.standalone_watchtower_rpc_url)}`)
  }
  lines.push(`  disable_built_in_watchtower: ${c.fiber.disable_built_in_watchtower}`)
  if (c.fiber.proxy_url) {
    lines.push('  proxy:')
    lines.push(`    proxy_url: ${yamlStr(c.fiber.proxy_url)}`)
  }

  // rpc
  lines.push('')
  lines.push('rpc:')
  lines.push(`  listening_addr: ${yamlStr(c.rpc.listening_addr)}`)
  lines.push('  enabled_modules:')
  for (const m of c.rpc.enabled_modules) lines.push(`    - ${m}`)

  // ckb
  lines.push('')
  lines.push('ckb:')
  lines.push(`  rpc_url: ${yamlStr(c.ckb.rpc_url)}`)
  lines.push(`  tx_tracing_polling_interval_ms: ${c.ckb.tx_tracing_polling_interval_ms}`)
  lines.push('  udt_whitelist:')
  for (const u of c.udtWhitelist) {
    lines.push(`    - name: ${u.name}`)
    lines.push('      script:')
    lines.push(`        code_hash: ${u.code_hash}`)
    lines.push(`        hash_type: ${u.hash_type}`)
    lines.push(`        args: ${u.args}`)
    if (u.cell_deps && u.cell_deps.length > 0) {
      lines.push('      cell_deps:')
      for (const dep of u.cell_deps) {
        if (dep.kind === 'type_id') {
          lines.push('        - type_id:')
          lines.push(`            code_hash: ${dep.code_hash}`)
          lines.push(`            hash_type: ${dep.hash_type}`)
          lines.push(`            args: ${dep.args}`)
        } else {
          lines.push('        - cell_dep:')
          lines.push('            out_point:')
          lines.push(`              tx_hash: ${dep.tx_hash}`)
          lines.push(`              index: ${dep.index}`)
          lines.push(`            dep_type: ${dep.dep_type}`)
        }
      }
    }
    lines.push(`      auto_accept_amount: ${u.auto_accept_amount}`)
  }

  // services
  lines.push('')
  lines.push('services:')
  for (const s of c.services) lines.push(`  - ${s}`)

  return lines.join('\n') + '\n'
}
