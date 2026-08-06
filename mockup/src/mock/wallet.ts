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
  address: string
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
    {
      id: 'tx6',
      type: 'send' as const,
      amountCkb: -250,
      timestamp: '2026-07-23T14:05:00+08:00',
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
    {
      id: 'tx7',
      type: 'receive' as const,
      amountCkb: 1200,
      timestamp: '2026-07-22T09:33:00+08:00',
      txHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    },
    {
      id: 'tx8',
      type: 'channel_open' as const,
      amountCkb: -800,
      timestamp: '2026-07-21T18:22:00+08:00',
      txHash: '0x0f1e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3',
    },
    {
      id: 'tx9',
      type: 'send' as const,
      amountCkb: -15.75,
      timestamp: '2026-07-20T07:48:00+08:00',
      txHash: '0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
    },
    {
      id: 'tx10',
      type: 'receive' as const,
      amountCkb: 320.5,
      timestamp: '2026-07-19T21:10:00+08:00',
      txHash: '0xccddeeff00112233445566778899aabbccddeeff00112233445566778899aabb',
    },
  ] satisfies Tx[],
}

export const hdAccounts: HdAccount[] = [
  {
    id: 'acc-0',
    nameZh: '主钱包',
    nameEn: 'Primary wallet',
    path: "m/44'/309'/0'/0/0",
    address: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s2p',
    addressShort: 'ckt1…s2p',
    balanceCkb: 9860.32,
  },
  {
    id: 'acc-1',
    nameZh: '储蓄钱包',
    nameEn: 'Savings wallet',
    path: "m/44'/309'/0'/0/1",
    address: 'ckt1qrf9syv8pnj5z3y9j4h8k7c2d6wxt5a4b3e2f1g0h9i8j7k6l5m4n3o2p1q0r9s8t7u6v5w4x3y2z1a0b9c8d7e6f5g4h3i2j1k0l9m8n7o6p5q4r3s2t1u0v',
    addressShort: 'ckt1…h7q',
    balanceCkb: 2620.2,
  },
]

// ── HD account derivation ───────────────────────────────────────────────
// Deterministic pseudo-address so a freshly derived account looks real but
// is stable across renders.

function pseudoCkbAddress(seed: number) {
  let h = 0x811c9dc5
  const s = `opticrum-hd-${seed}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let x = h >>> 0
  const digits = '0123456789abcdef'
  let hex = ''
  for (let i = 0; i < 44; i++) {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    hex += digits[x % 16]
  }
  return { address: `ckt1${hex}`, addressShort: `ckt1…${hex.slice(-3)}` }
}

/** Derive the Nth account from the wallet's master seed path. Newly derived
 * accounts are empty (0 CKB) — just like a fresh HD account. */
export function deriveHdAccount(index: number): HdAccount {
  const { address, addressShort } = pseudoCkbAddress(index)
  return {
    id: `acc-${index}`,
    nameZh: index === 0 ? '主钱包' : index === 1 ? '储蓄钱包' : `钱包 ${index + 1}`,
    nameEn: index === 0 ? 'Primary wallet' : index === 1 ? 'Savings wallet' : `Wallet ${index + 1}`,
    path: `m/44'/309'/0'/0/${index}`,
    address,
    addressShort,
    balanceCkb: 0,
  }
}