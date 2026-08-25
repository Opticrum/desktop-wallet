// Backend error → localized display text.
//
// Backend `CommandError` messages are English (from the Rust core); well-known
// codes are mapped here to the active locale, and anything unknown falls back
// to the raw message so no error is ever swallowed or blank.

import type { CommandError } from '../api/types'
import type { Messages } from '../i18n/types'

export function commandErrorText(t: Messages, err: CommandError): string {
  switch (err.code) {
    // Wrong wallet password (core wallet/crypto.rs returns NotAuthorized).
    case 'not_authorized':
      return t.walletPasswordWrong
    case 'channel_open_timeout':
      return t.channelOpenTimeout
    case 'chain':
      if (
        err.message.includes('Fiber RPC unreachable') ||
        err.message.includes('Fiber RPC timed out')
      ) {
        return t.nodeUnreachable
      }
      return err.message
    default:
      return err.message
  }
}
