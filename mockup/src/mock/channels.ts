export type Channel = {
  id: string
  /** Funding tx hash, shortened for display. */
  txHash: string
  capacityCkb: number
  localBalanceCkb: number
  remoteBalanceCkb: number
  state: 'active' | 'pending' | 'closing'
  baseFeeMshannons: number
  feeRatePpm: number
}

/** A node the wallet is connected to. Every listed node is already connected;
 *  channels are opened with a node via "新建通道" on its row. */
export type ConnectedNode = {
  id: string
  alias: string
  addr: string
  channels: Channel[]
}

export const connectedNodes: ConnectedNode[] = [
  {
    id: 'n-fiber-seed-1',
    alias: 'fiber-seed-1',
    addr: '/ip4/104.21.88.201/tcp/8115',
    channels: [
      {
        id: 'ch-01',
        txHash: '0x8f3a…1c40',
        capacityCkb: 2000,
        localBalanceCkb: 1250.4,
        remoteBalanceCkb: 749.6,
        state: 'active',
        baseFeeMshannons: 1000,
        feeRatePpm: 120,
      },
      {
        id: 'ch-02',
        txHash: '0x2b91…a7d2',
        capacityCkb: 1500,
        localBalanceCkb: 620,
        remoteBalanceCkb: 880,
        state: 'active',
        baseFeeMshannons: 800,
        feeRatePpm: 90,
      },
    ],
  },
  {
    id: 'n-merchant-node',
    alias: 'merchant-node',
    addr: '/ip4/47.98.210.66/tcp/8115',
    channels: [
      {
        id: 'ch-03',
        txHash: '0x44f0…9e21',
        capacityCkb: 800,
        localBalanceCkb: 400,
        remoteBalanceCkb: 400,
        state: 'pending',
        baseFeeMshannons: 1000,
        feeRatePpm: 100,
      },
      {
        id: 'ch-04',
        txHash: '0xd13c…55f8',
        capacityCkb: 600,
        localBalanceCkb: 510.2,
        remoteBalanceCkb: 89.8,
        state: 'active',
        baseFeeMshannons: 500,
        feeRatePpm: 75,
      },
    ],
  },
  {
    id: 'n-opticrum-edge',
    alias: 'opticrum-edge',
    addr: '/ip4/13.229.101.7/tcp/8115',
    channels: [
      {
        id: 'ch-05',
        txHash: '0x7be9…2a04',
        capacityCkb: 420,
        localBalanceCkb: 180.5,
        remoteBalanceCkb: 239.5,
        state: 'active',
        baseFeeMshannons: 700,
        feeRatePpm: 110,
      },
    ],
  },
  {
    id: 'n-relay-eu',
    alias: 'relay-eu',
    addr: '/ip4/65.21.103.44/tcp/8115',
    channels: [
      {
        id: 'ch-06',
        txHash: '0xa09c…33d7',
        capacityCkb: 1000,
        localBalanceCkb: 350,
        remoteBalanceCkb: 650,
        state: 'active',
        baseFeeMshannons: 1200,
        feeRatePpm: 150,
      },
    ],
  },
  {
    id: 'n-lp-foundation',
    alias: 'lp-foundation',
    addr: '/ip4/34.96.140.55/tcp/8115',
    channels: [
      {
        id: 'ch-07',
        txHash: '0x55d1…8f6a',
        capacityCkb: 300,
        localBalanceCkb: 120,
        remoteBalanceCkb: 180,
        state: 'closing',
        baseFeeMshannons: 1000,
        feeRatePpm: 100,
      },
    ],
  },
  {
    id: 'n-merchant-asia',
    alias: 'merchant-asia',
    addr: '/ip4/13.213.4.99/tcp/8115',
    channels: [],
  },
  {
    id: 'n-fiber-jp-relay',
    alias: 'fiber-jp-relay',
    addr: '/ip4/13.115.32.211/tcp/8115',
    channels: [],
  },
]

/** Flat list derived from `connectedNodes` — kept so shared consumers
 *  (NodeControlPanel locked balance, counts) don't need restructuring. */
export const channels: Channel[] = connectedNodes.flatMap((n) => n.channels)

export const channelsSummary = {
  online: true,
  activeCount: channels.filter((c) => c.state === 'active').length,
  pendingCount: channels.filter((c) => c.state === 'pending').length,
  localCapacityCkb: channels.reduce((sum, c) => sum + c.localBalanceCkb, 0),
}
