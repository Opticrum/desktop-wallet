// ── Network topology ─────────────────────────────────────────────────────
// Shapes mirror fiber-json-types graph::{NodeInfo, ChannelInfo} from the
// Fiber `get_network_graph` RPC. The sidebar aggregates/slices these into
// stats + top hubs.

// Deterministic full-size (33-byte compressed) pubkey, so the mock stays
// realistic-looking but stable across renders.
function topologyPubkey(seed: number): string {
  let h = 0x811c9dc5
  const s = `topology-node-${seed}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let x = h >>> 0
  const digits = '0123456789abcdef'
  let hex = ''
  for (let i = 0; i < 64; i++) {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    hex += digits[x % 16]
  }
  return `${x % 2 === 0 ? '02' : '03'}${hex}`
}

export type TopologyHub = {
  rank: number
  nodeName: string
  pubkey: string
  /** Fiber multiaddr — used to prefill the "new connection" form. */
  addr: string
  /** Sum of the node's channel capacities (shannons → CKB) — used to rank hubs. */
  capacityCkb: number
  online: boolean
}

export const networkTopology = {
  /** Aggregated from GraphNodesResult / GraphChannelsResult. */
  totalNodes: 1284,
  totalPublicChannels: 6902,
  totalCapacityCkb: 18_420_550.22,

  /** Highest-capacity hubs, ranked by the sum of their channel capacities. */
  hubs: [
    { nodeName: 'ckb-bot-sg',     addr: '/ip4/18.142.44.12/tcp/8115',   capacityCkb: 2_124_000 },
    { nodeName: 'lp-foundation',  addr: '/ip4/34.96.140.55/tcp/8115',   capacityCkb: 1_860_000 },
    { nodeName: 'relay-eu',       addr: '/ip4/65.21.103.44/tcp/8115',   capacityCkb: 1_210_000 },
    { nodeName: 'fiber-seed-1',   addr: '/ip4/104.21.88.201/tcp/8115',  capacityCkb: 940_000 },
    { nodeName: 'merchant-node',  addr: '/ip4/47.98.210.66/tcp/8115',   capacityCkb: 680_000 },
    { nodeName: 'relay-us-west',  addr: '/ip4/52.52.91.7/tcp/8115',     capacityCkb: 590_000 },
    { nodeName: 'merchant-asia',  addr: '/ip4/13.213.4.99/tcp/8115',    capacityCkb: 510_000 },
    { nodeName: 'fiber-jp-relay', addr: '/ip4/13.115.32.211/tcp/8115',  capacityCkb: 460_000 },
    { nodeName: 'stable-bridge',  addr: '/ip4/45.77.65.221/tcp/8115',   capacityCkb: 410_000 },
    { nodeName: 'ckb-validator-7', addr: '/ip4/35.220.20.18/tcp/8115',  capacityCkb: 370_000 },
  ].map((h, i) => ({
    rank: i + 1,
    pubkey: topologyPubkey(i),
    online: true,
    ...h,
  })) as TopologyHub[],
}
