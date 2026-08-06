export const nodeRuntime = {
  nodeAlias: 'ckb-bot-sg',
  chain: 'testnet' as 'mainnet' | 'testnet',
  fiberPubkey: '02ab91f4c5d27b8e6a1f4d3c9a72e881f0c5b7d4e3a9f8b6c1d2e5f4a3b7c9d1',
  fiberAddr: '/ip4/18.142.44.12/tcp/8115',
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