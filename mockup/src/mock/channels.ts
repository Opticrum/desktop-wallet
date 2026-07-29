export type Channel = {
  id: string
  peerAlias: string
  peerPubkeyShort: string
  capacityCkb: number
  localBalanceCkb: number
  remoteBalanceCkb: number
  state: 'active' | 'pending' | 'closing'
  baseFeeMshannons: number
  feeRatePpm: number
}

export const channelsSummary = {
  online: true,
  activeCount: 6,
  pendingCount: 1,
  localCapacityCkb: 4820.5,
}

export const channels: Channel[] = [
  {
    id: 'ch-01',
    peerAlias: 'Nervos Hub',
    peerPubkeyShort: '02ab…91f4',
    capacityCkb: 2000,
    localBalanceCkb: 1250.4,
    remoteBalanceCkb: 749.6,
    state: 'active',
    baseFeeMshannons: 1000,
    feeRatePpm: 120,
  },
  {
    id: 'ch-02',
    peerAlias: 'Fiber Relay East',
    peerPubkeyShort: '03cd…77a1',
    capacityCkb: 1500,
    localBalanceCkb: 620,
    remoteBalanceCkb: 880,
    state: 'active',
    baseFeeMshannons: 800,
    feeRatePpm: 90,
  },
  {
    id: 'ch-03',
    peerAlias: 'Opticrum LP-1',
    peerPubkeyShort: '02f1…0bb2',
    capacityCkb: 800,
    localBalanceCkb: 400,
    remoteBalanceCkb: 400,
    state: 'pending',
    baseFeeMshannons: 1000,
    feeRatePpm: 100,
  },
  {
    id: 'ch-04',
    peerAlias: 'Merchant Gate',
    peerPubkeyShort: '02de…44c0',
    capacityCkb: 600,
    localBalanceCkb: 510.2,
    remoteBalanceCkb: 89.8,
    state: 'active',
    baseFeeMshannons: 500,
    feeRatePpm: 75,
  },
  {
    id: 'ch-05',
    peerAlias: 'CKB Coffee Node',
    peerPubkeyShort: '03a9…12ef',
    capacityCkb: 420,
    localBalanceCkb: 180.5,
    remoteBalanceCkb: 239.5,
    state: 'active',
    baseFeeMshannons: 700,
    feeRatePpm: 110,
  },
  {
    id: 'ch-06',
    peerAlias: 'Lightning Bridge',
    peerPubkeyShort: '02c4…88aa',
    capacityCkb: 1000,
    localBalanceCkb: 350,
    remoteBalanceCkb: 650,
    state: 'active',
    baseFeeMshannons: 1200,
    feeRatePpm: 150,
  },
  {
    id: 'ch-07',
    peerAlias: 'Peer Lab West',
    peerPubkeyShort: '03b2…5d91',
    capacityCkb: 300,
    localBalanceCkb: 120,
    remoteBalanceCkb: 180,
    state: 'closing',
    baseFeeMshannons: 1000,
    feeRatePpm: 100,
  },
]
