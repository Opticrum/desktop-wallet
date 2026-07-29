export type Tx = {
  id: string
  type: 'receive' | 'send' | 'channel_open' | 'channel_close'
  amountCkb: number
  timestamp: string
  txHash: string
}

export type HdAccount = {
  id: string
  nameZh: string
  nameEn: string
  path: string
  addressShort: string
  balanceCkb: number
}

export const wallet = {
  address:
    'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s2p',
  addressShort: 'ckt1…s2p',
  totalCkb: 12480.52134,
  availableCkb: 9820.12,
  lockedCkb: 2660.40134,
  fiatUsd: 1842.1,
  txs: [
    {
      id: 'tx1',
      type: 'receive' as const,
      amountCkb: 500,
      timestamp: '2026-07-28T09:14:00+08:00',
      txHash: '0x7a1c9e2b4d8f01a3c5e7b9d0f2a4c6e8b1d3f5a7c9e0b2d4f6a8c0e2b4d6f8a0',
    },
    {
      id: 'tx2',
      type: 'channel_open' as const,
      amountCkb: -1200,
      timestamp: '2026-07-27T16:02:00+08:00',
      txHash: '0x91b044aa12cd34ef56ab78cd90ef12ab34cd56ef78ab90cd12ef34ab56cd78ef',
    },
    {
      id: 'tx3',
      type: 'send' as const,
      amountCkb: -42.5,
      timestamp: '2026-07-26T11:40:00+08:00',
      txHash: '0x33de0c18a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef012345678',
    },
    {
      id: 'tx4',
      type: 'receive' as const,
      amountCkb: 88.25,
      timestamp: '2026-07-25T20:18:00+08:00',
      txHash: '0x55aa11bb22cc33dd44ee55ff66778899aabbccddeeff00112233445566778899',
    },
    {
      id: 'tx5',
      type: 'channel_close' as const,
      amountCkb: 640.12,
      timestamp: '2026-07-24T08:05:00+08:00',
      txHash: '0xabcdef0123456789fedcba9876543210abcdef0123456789fedcba9876543210',
    },
  ] satisfies Tx[],
}

export const hdAccounts: HdAccount[] = [
  {
    id: 'acc-0',
    nameZh: '主钱包',
    nameEn: 'Primary wallet',
    path: "m/44'/309'/0'/0/0",
    addressShort: 'ckt1…s2p',
    balanceCkb: 9860.32,
  },
  {
    id: 'acc-1',
    nameZh: '储蓄钱包',
    nameEn: 'Savings wallet',
    path: "m/44'/309'/0'/0/1",
    addressShort: 'ckt1…h7q',
    balanceCkb: 2620.2,
  },
]