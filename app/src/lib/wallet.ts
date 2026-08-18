// Frontend wallet formulas — display/math kept on the frontend per
// `docs/ipc/ipc-api.md` §6 (wallet domain).

import type { WalletTx, WalletTxKind } from '../api/types'

export type Tx = WalletTx
export type TxType = WalletTxKind

const TX_TYPES: TxType[] = ['receive', 'send', 'channel_open', 'channel_close', 'rent_pledge', 'rent_extract']

/** Transaction-type counts — reduce over `wallet.get_transactions` `kind`. */
export function typeCounts(txs: Tx[]): Record<TxType, number> {
  const counts: Record<TxType, number> = {
    receive: 0,
    send: 0,
    channel_open: 0,
    channel_close: 0,
    rent_pledge: 0,
    rent_extract: 0,
  }
  for (const tx of txs) counts[tx.kind] += 1
  return counts
}

export const TX_TYPE_ORDER: readonly TxType[] = TX_TYPES

/** Short hash — `0x7a1c9e2b…f8a0` (8 + 6 visible hex). */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

/**
 * "Moderate" truncation — keep enough context on both ends to be identifiable
 * (12 prefix + 12 suffix = 24 visible hex chars + ellipsis) without spilling
 * onto multiple lines. The full hash is exposed via the native browser
 * tooltip (title attr) on hover.
 */
export function truncatedHash(hash: string): string {
  return `${hash.slice(0, 12)}…${hash.slice(-12)}`
}

/** `ckt1qzda0cr08…9s2p` — compact address for inputs/placeholders. */
export function addressShort(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 4)}…${address.slice(-3)}`
}

/** Signed transaction amount: `+1,200 CKB` / `−42.5 CKB`. */
export function formatSignedCkb(amountCkb: number): string {
  const sign = amountCkb >= 0 ? '+' : ''
  return sign + amountCkb.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' CKB'
}
