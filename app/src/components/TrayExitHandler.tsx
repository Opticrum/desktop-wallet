import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { ConfirmModal } from './ConfirmModal'
import { useLocale } from '../i18n/LocaleContext'
import { app } from '../api/client'
import { isTauri } from '../api/transport'

/**
 * Mounted once at the app root. When the tray's 退出 item is clicked, the shell
 * shows the window and emits `tray-exit-requested`; this renders the bilingual
 * risk prompt (no background fiber node → unreachable → liquidity buys won't
 * fill). Quitting only happens after the user confirms, via `app.exit`.
 *
 * No-op in the standalone browser workflow (`isTauri` false).
 */
export function TrayExitHandler() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isTauri) return
    let unlisten: (() => void) | undefined
    let cancelled = false
    listen<null>('tray-exit-requested', () => setOpen(true)).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  return (
    <ConfirmModal
      open={open}
      title={t.trayExitTitle}
      body={t.trayExitBody}
      confirmLabel={t.trayQuit}
      cancelLabel={t.trayCancel}
      danger
      onCancel={() => setOpen(false)}
      onConfirm={() => {
        setOpen(false)
        app.exit().catch(() => {})
      }}
    />
  )
}
