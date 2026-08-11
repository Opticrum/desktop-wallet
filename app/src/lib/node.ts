// Frontend node formulas — display/math kept on the frontend per
// `docs/ipc/ipc-api.md` §6 (node domain).

import type { LogLevel, NodeLog } from '../api/types'

export type ChannelBucket = 'active' | 'pending' | 'closing'

/** Fiber raw `state_name` → display bucket (active | pending | closing). */
export function stateToBucket(state: string): ChannelBucket {
  if (state === 'ChannelReady') return 'active'
  if (state === 'ShuttingDown' || state === 'Closed') return 'closing'
  return 'pending'
}

/** Per-level log counts — reduce over `node.get_logs` `level`. */
export function logStats(logs: NodeLog[]): Record<LogLevel, number> {
  const stats: Record<LogLevel, number> = { INFO: 0, WARN: 0, ERROR: 0 }
  for (const line of logs) stats[line.level] += 1
  return stats
}

/** Locale-aware log timestamp formatting. */
export function formatLogTime(tsMs: number, locale: string): string {
  return new Date(tsMs).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
