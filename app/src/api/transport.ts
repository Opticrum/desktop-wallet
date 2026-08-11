// IPC transport — the single gateway between the frontend and Rust.
//
// In the Tauri shell the command is dispatched via `@tauri-apps/api` `invoke`.
// Outside the shell (standalone vite browser dev at :5174, no Tauri) the
// DEV-ONLY `browserMock` adapter serves the same wire-shaped data so UI work
// can continue without the desktop host.

import { invoke } from '@tauri-apps/api/core'
import { browserInvoke } from './browserMock'

/** True when running inside the Tauri webview. */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    // The docs name commands `<domain>.<verb>`; Tauri registers commands by
    // the Rust function name (`wallet_get_summary`), so map dots → underscores.
    const wireName = cmd.replace(/\./g, '_')
    return invoke<T>(wireName, args)
  }
  return browserInvoke<T>(cmd, args)
}
