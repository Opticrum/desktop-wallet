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

type LogEntry = {
  ts: string
  level: 'INFO' | 'WARN' | 'ERROR'
  msg: string
}

/**
 * A dense recent tail of the node's running log — enough entries to exercise
 * vertical scrolling in the drawer, with several long-text lines that wrap.
 */
export const logs: LogEntry[] = [
  {
    ts: '2026-07-29T10:15:02+08:00',
    level: 'INFO',
    msg: 'New outbound payment routed: 1,250 CKB → 9 hops, fee 0.03 CKB',
  },
  {
    ts: '2026-07-29T10:14:41+08:00',
    level: 'ERROR',
    msg: 'Payment path failed on node 02c4…9a1f: insufficient inbound liquidity across all 3 candidate routes, retrying with fee bump',
  },
  {
    ts: '2026-07-29T10:14:05+08:00',
    level: 'INFO',
    msg: 'Channel ch-05 updated remote balance -18.9 CKB (relay)',
  },
  {
    ts: '2026-07-29T10:13:28+08:00',
    level: 'WARN',
    msg: 'HTLC #77812 approaching expiry (95 blocks remaining) on ch-03, forwarding delay 0.8s',
  },
  {
    ts: '2026-07-29T10:12:44+08:00',
    level: 'INFO',
    msg: 'HTLC payment timeout on channel ch-02, retrying',
  },
  {
    ts: '2026-07-29T10:12:10+08:00',
    level: 'INFO',
    msg: 'Invoice settled 2.5 CKB via Fiber Relay East',
  },
  {
    ts: '2026-07-29T10:11:33+08:00',
    level: 'WARN',
    msg: 'Watchtower check delayed 1.4s across 12 pending HTLCs',
  },
  {
    ts: '2026-07-29T10:11:02+08:00',
    level: 'INFO',
    msg: 'Peer fiber-seed-1 connected',
  },
  {
    ts: '2026-07-29T10:10:18+08:00',
    level: 'INFO',
    msg: 'Channel ch-01 announced new fee policy: base 1,000 shannons, rate 100/1M',
  },
  {
    ts: '2026-07-29T10:09:52+08:00',
    level: 'ERROR',
    msg: 'Funding tx 0x9f3a…c401 not confirmed after 120s, polling CKB RPC; retry in 30s',
  },
  {
    ts: '2026-07-29T10:09:30+08:00',
    level: 'INFO',
    msg: 'Channel ch-02 updated local balance +12.4 CKB',
  },
  {
    ts: '2026-07-29T10:08:47+08:00',
    level: 'INFO',
    msg: 'Received 3 invoices for rebalancing, total 4,200 CKB',
  },
  {
    ts: '2026-07-29T10:08:12+08:00',
    level: 'WARN',
    msg: 'Peer old-relay-3 unresponsive > 30s, marked disconnected',
  },
  {
    ts: '2026-07-29T10:07:36+08:00',
    level: 'INFO',
    msg: 'Rebalance triggered on ch-04: local 240.0 CKB → target 600.0 CKB',
  },
  {
    ts: '2026-07-29T10:06:58+08:00',
    level: 'INFO',
    msg: 'HTLC #77805 settled: 320 CKB → node 03e1…bb22',
  },
  {
    ts: '2026-07-29T10:06:20+08:00',
    level: 'INFO',
    msg: 'Synced to tip #12804221',
  },
  {
    ts: '2026-07-29T10:05:44+08:00',
    level: 'INFO',
    msg: 'Mempool refresh: 2 new CKB txs, 1 funding, 1 withdrawal',
  },
  {
    ts: '2026-07-29T10:05:09+08:00',
    level: 'WARN',
    msg: 'Outbound liquidity below 10% on ch-06 (76.3 CKB), consider rebalancing',
  },
  {
    ts: '2026-07-29T10:04:33+08:00',
    level: 'INFO',
    msg: 'Channel ch-03 negotiated, awaiting funding tx',
  },
  {
    ts: '2026-07-29T10:03:55+08:00',
    level: 'INFO',
    msg: 'Announced node address /ip4/18.142.44.12/tcp/8115 to 5 seed peers',
  },
  {
    ts: '2026-07-29T10:03:18+08:00',
    level: 'ERROR',
    msg: 'Failed to decode incoming peer message from 45.77.65.221: invalid handshake nonce 0x9f3a…c401, ignoring (normal during reconnects)',
  },
  {
    ts: '2026-07-29T10:02:41+08:00',
    level: 'INFO',
    msg: 'Watchtower remote sync OK — 9,512 channels backed up, last tx at block #12,804,214',
  },
  {
    ts: '2026-07-29T10:02:04+08:00',
    level: 'INFO',
    msg: 'Peer fiber-jp-relay connected (2 channels, 4,200 CKB liquidity)',
  },
  {
    ts: '2026-07-29T10:01:27+08:00',
    level: 'WARN',
    msg: 'Htlc timeout watchtower check delayed 1.2s',
  },
  {
    ts: '2026-07-29T10:00:50+08:00',
    level: 'INFO',
    msg: 'Channel ch-07 opened: 8,000 CKB, peer merchant-asia, funding tx 0x2b91…a7d2',
  },
  {
    ts: '2026-07-29T10:00:12+08:00',
    level: 'INFO',
    msg: 'Swept 3 expired HTLC outputs: +642.10 CKB reclaimed to wallet',
  },
  {
    ts: '2026-07-29T09:59:35+08:00',
    level: 'ERROR',
    msg: 'Payment 12,400 CKB to node 09f8…c33d failed: route not found after 5 attempts, all candidate peers lack sufficient outbound capacity',
  },
  {
    ts: '2026-07-29T09:58:58+08:00',
    level: 'INFO',
    msg: 'Invoice generated: 88.25 CKB, expires in 1h, memo "merchant-payout-week-30"',
  },
  {
    ts: '2026-07-29T09:58:21+08:00',
    level: 'INFO',
    msg: 'Channel ch-08 opened: 2,500 CKB, peer lp-foundation, funding tx 0x77aa…e021',
  },
  {
    ts: '2026-07-29T09:57:44+08:00',
    level: 'WARN',
    msg: 'High mempool congestion detected (avg fee 0.011 CKB/byte); funding txs may take longer',
  },
  {
    ts: '2026-07-29T09:57:07+08:00',
    level: 'INFO',
    msg: 'Rebalance complete on ch-04: local 596.4 CKB (target 600.0)',
  },
  {
    ts: '2026-07-29T09:56:30+08:00',
    level: 'INFO',
    msg: 'HTLC #77790 settled: 42.5 CKB → node 01ab…c9d2',
  },
  {
    ts: '2026-07-29T09:55:53+08:00',
    level: 'INFO',
    msg: 'Peer relay-eu connected (11 channels, 96,000 CKB total liquidity)',
  },
  {
    ts: '2026-07-29T09:55:16+08:00',
    level: 'WARN',
    msg: 'Clock skew detected with peer 45.77.65.221: +0.42s, adjusted once',
  },
  {
    ts: '2026-07-29T09:54:39+08:00',
    level: 'INFO',
    msg: 'Channel ch-02 closed: final balances local 1,250.4 / remote 749.6 CKB, mutual close tx 0x8f3a…1c40',
  },
  {
    ts: '2026-07-29T09:54:02+08:00',
    level: 'INFO',
    msg: 'Channel ch-09 updated local balance -320 CKB (payment relay)',
  },
  {
    ts: '2026-07-29T09:53:25+08:00',
    level: 'ERROR',
    msg: 'Watchtower upstream 45.77.65.221 returned HTTP 503 for 3 consecutive backups; retrying with exponential backoff (next attempt in 64s)',
  },
  {
    ts: '2026-07-29T09:52:48+08:00',
    level: 'INFO',
    msg: 'Mempool refresh: 4 new CKB txs, all channel funding',
  },
  {
    ts: '2026-07-29T09:52:11+08:00',
    level: 'INFO',
    msg: 'Synced to tip #12804219',
  },
  {
    ts: '2026-07-29T09:51:34+08:00',
    level: 'WARN',
    msg: 'Inbound liquidity on ch-05 critically low (12 CKB), inbound payments may fail until rebalance',
  },
  {
    ts: '2026-07-29T09:50:57+08:00',
    level: 'INFO',
    msg: 'Payment relayed: 150 CKB via merchant-node, fee earned 0.004 CKB',
  },
  {
    ts: '2026-07-29T09:50:20+08:00',
    level: 'INFO',
    msg: 'Peer merchant-node connected (7 channels, 52,000 CKB total liquidity)',
  },
  {
    ts: '2026-07-29T09:49:43+08:00',
    level: 'INFO',
    msg: 'Channel ch-10 negotiated: 12,000 CKB, peer fiber-jp-relay, conditions base 1,000 / rate 90',
  },
  {
    ts: '2026-07-29T09:49:06+08:00',
    level: 'WARN',
    msg: 'One of 5 seed peers failed to respond to ping; ignoring, will re-check in 5 min',
  },
  {
    ts: '2026-07-29T09:48:29+08:00',
    level: 'INFO',
    msg: 'HTLC #77770 settled: 1,200 CKB → node 05e2…ff10',
  },
  {
    ts: '2026-07-29T09:47:52+08:00',
    level: 'INFO',
    msg: 'Channel ch-11 opened: 500 CKB, peer opticrum-edge, funding tx 0x11aa…9f0d',
  },
  {
    ts: '2026-07-29T09:47:15+08:00',
    level: 'ERROR',
    msg: 'Rebalance attempt on ch-12 interrupted: insufficient remote liquidity on the 3 proposed circular paths; falling back to on-chain sweep',
  },
  {
    ts: '2026-07-29T09:46:38+08:00',
    level: 'INFO',
    msg: 'Fee policy updated on ch-01: base 900 shannons, rate 90/1M (config auto-apply)',
  },
  {
    ts: '2026-07-29T09:46:01+08:00',
    level: 'INFO',
    msg: 'Peer opticrum-edge connected (4 channels, 9,200 CKB liquidity)',
  },
  {
    ts: '2026-07-29T09:45:24+08:00',
    level: 'WARN',
    msg: 'Outbound liquidity below 10% on ch-03 (98.2 CKB), consider rebalancing',
  },
  {
    ts: '2026-07-29T09:44:47+08:00',
    level: 'INFO',
    msg: 'Synced to tip #12804216',
  },
  {
    ts: '2026-07-29T09:44:10+08:00',
    level: 'INFO',
    msg: 'Funding transaction broadcast for channel ch-14 (peer lp-foundation): tx 0xee44…12ab, inputs [0x9f3a…c401:0, 0x11aa…9f0d:1], outputs [channel script 4,200 CKB, change 80.12 CKB], estimated confirmations 6, fee 0.012 CKB',
  },
  {
    ts: '2026-07-29T09:43:33+08:00',
    level: 'INFO',
    msg: 'Channel negotiation with peer merchant-asia completed after 3 rounds: proposed capacity 8,000 CKB accepted, base fee 1,000 shannons accepted, fee rate 100/1M adjusted to 96/1M to match peer policy, funding script locktime disabled',
  },
  {
    ts: '2026-07-29T09:42:56+08:00',
    level: 'WARN',
    msg: 'Watchtower backup throttled: 245 queued channel updates, syncing 50 per batch',
  },
]
