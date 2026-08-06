export const nodeRuntime = {
  nodeAlias: 'ckb-bot-sg',
  chain: 'testnet' as 'mainnet' | 'testnet',
  fiberPubkey: '02ab91f4c5d27b8e6a1f4d3c9a72e881f0c5b7d4e3a9f8b6c1d2e5f4a3b7c9d1',
  tipHeight: 12_804_221,
  peers: 48,
  cpuPercent: 12,
  memPercent: 38,
  uptimeHours: 186,
  synced: true,
}

export type WatchtowerConfig = {
  mode: 'local' | 'remote'
  /** Remote watchtower URL — only present when mode is 'remote'. */
  endpoint?: string
}

export const nodeWatchtower: WatchtowerConfig = {
  mode: 'remote',
  endpoint: '/ip4/45.77.65.221/tcp/8115',
}

export type PeerStatus = 'connected' | 'disconnected'

export type Peer = {
  id: string
  alias: string
  addr: string
  latencyMs: number
  status: PeerStatus
}

export const peers: Peer[] = [
  { id: 'p1', alias: 'ckb-bot-sg',          addr: '/ip4/18.142.44.12/tcp/8115',  latencyMs: 42,  status: 'connected' },
  { id: 'p2', alias: 'fiber-seed-1',        addr: '/ip4/104.21.88.201/tcp/8115', latencyMs: 88,  status: 'connected' },
  { id: 'p3', alias: 'relay-eu',            addr: '/ip4/65.21.103.44/tcp/8115',  latencyMs: 160, status: 'connected' },
  { id: 'p4', alias: 'merchant-node',       addr: '/ip4/47.98.210.66/tcp/8115',  latencyMs: 55,  status: 'connected' },
  { id: 'p5', alias: 'opticrum-edge',       addr: '/ip4/13.229.101.7/tcp/8115',  latencyMs: 61,  status: 'connected' },
  { id: 'p6', alias: 'fiber-jp-relay',      addr: '/ip4/13.115.32.211/tcp/8115', latencyMs: 73,  status: 'connected' },
  { id: 'p7', alias: 'ckb-validator-7',     addr: '/ip4/35.220.20.18/tcp/8115',  latencyMs: 102, status: 'connected' },
  { id: 'p8', alias: 'lp-foundation',       addr: '/ip4/34.96.140.55/tcp/8115',  latencyMs: 134, status: 'connected' },
  { id: 'p9', alias: 'merchant-asia',       addr: '/ip4/13.213.4.99/tcp/8115',   latencyMs: 49,  status: 'connected' },
  { id: 'p10', alias: 'relay-us-west',      addr: '/ip4/52.52.91.7/tcp/8115',    latencyMs: 178, status: 'connected' },
  { id: 'p11', alias: 'fiber-archive-node', addr: '/ip4/23.227.38.74/tcp/8115',  latencyMs: 91,  status: 'connected' },
  { id: 'p12', alias: 'ckb-lab-cn',         addr: '/ip4/39.106.7.55/tcp/8115',   latencyMs: 38,  status: 'connected' },
  { id: 'p13', alias: 'stable-bridge',      addr: '/ip4/45.77.65.221/tcp/8115',  latencyMs: 245, status: 'connected' },
  { id: 'p14', alias: 'old-relay-3',        addr: '/ip4/198.51.100.42/tcp/8115', latencyMs: 312, status: 'disconnected' },
  { id: 'p15', alias: 'merchant-tx-9',      addr: '/ip4/203.0.113.18/tcp/8115',  latencyMs: 0,   status: 'disconnected' },
]

export const logs = [
  {
    ts: '2026-07-29T10:01:12+08:00',
    level: 'INFO' as const,
    msg: 'Channel ch-02 updated local balance +12.4 CKB',
  },
  {
    ts: '2026-07-29T09:58:03+08:00',
    level: 'INFO' as const,
    msg: 'Peer fiber-seed-1 connected',
  },
  {
    ts: '2026-07-29T09:40:17+08:00',
    level: 'WARN' as const,
    msg: 'Htlc timeout watchtower check delayed 1.2s',
  },
  {
    ts: '2026-07-29T09:12:44+08:00',
    level: 'INFO' as const,
    msg: 'Synced to tip #12804221',
  },
  {
    ts: '2026-07-29T08:55:01+08:00',
    level: 'INFO' as const,
    msg: 'Invoice settled 2.5 CKB via Fiber Relay East',
  },
  {
    ts: '2026-07-29T08:32:19+08:00',
    level: 'INFO' as const,
    msg: 'Channel ch-03 negotiated, awaiting funding tx',
  },
  {
    ts: '2026-07-29T08:14:50+08:00',
    level: 'WARN' as const,
    msg: 'Peer old-relay-3 unresponsive > 30s, marked disconnected',
  },
]