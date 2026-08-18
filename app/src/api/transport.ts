// IPC transport — the single gateway between the frontend and Rust.
//
// The desktop app is Tauri-only (the runtime browser mock was removed), so every
// command is dispatched via `@tauri-apps/api` `invoke`.

import { invoke } from '@tauri-apps/api/core'
import { toCommandError } from './types'

/** True when running inside the Tauri webview (always true — desktop only). */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Commands that build & broadcast CKB transactions. Their failures are logged
 * to the browser console (in addition to the UI toast) for debugging.
 */
const CKB_TX_COMMANDS = new Set([
  'wallet.send_ckb',
  'liquidity.publish_order',
  'liquidity.cancel_order',
  'liquidity.inject_deposit',
  'liquidity.withdraw_deposit',
  'liquidity.extract_spent_match',
  'channels.open_channel',
  'channels.close_channel',
])

export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    // The docs name commands `<domain>.<verb>`; Tauri registers commands by
    // the Rust function name (`wallet_get_summary`), so map dots → underscores.
    const wireName = cmd.replace(/\./g, '_')
    return await invoke<T>(wireName, args)
  } catch (e) {
    if (CKB_TX_COMMANDS.has(cmd)) {
      // Print code + message as a single string — the console's collapsed
      // object preview otherwise truncates long error bodies (e.g. the
      // contract error code the node returns), hiding the debugging signal.
      const err = toCommandError(e)
      console.error(`[opticrum] CKB tx ${cmd} failed — ${err.code}: ${err.message}`)
    }
    throw e
  }
}
