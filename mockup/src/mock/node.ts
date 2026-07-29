export const nodeRuntime = {
  tipHeight: 12_804_221,
  peers: 48,
  cpuPercent: 12,
  memPercent: 38,
  uptimeHours: 186,
  synced: true,
}

export const peers = [
  { id: 'p1', alias: 'ckb-bot-sg', addr: '/ip4/18.142.44.12/tcp/8115', latencyMs: 42 },
  { id: 'p2', alias: 'fiber-seed-1', addr: '/ip4/104.21.88.201/tcp/8115', latencyMs: 88 },
  { id: 'p3', alias: 'relay-eu', addr: '/ip4/65.21.103.44/tcp/8115', latencyMs: 160 },
  { id: 'p4', alias: 'merchant-node', addr: '/ip4/47.98.210.66/tcp/8115', latencyMs: 55 },
  { id: 'p5', alias: 'opticrum-edge', addr: '/ip4/13.229.101.7/tcp/8115', latencyMs: 61 },
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
]
