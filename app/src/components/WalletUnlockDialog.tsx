import { useEffect, useState } from 'react'
import { wallet } from '../api/client'
import { toCommandError } from '../api/types'
import { useLocale } from '../i18n/LocaleContext'
import { commandErrorText } from '../lib/errors'
import { useScrollLock } from '../lib/useScrollLock'

type Props = {
  open: boolean
  onCancel: () => void
  onUnlocked: () => void
}

/** Standalone unlock modal — not mixed into the wallet drawer. */
export function WalletUnlockDialog({ open, onCancel, onUnlocked }: Props) {
  const { t } = useLocale()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setError(null)
    setBusy(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  useScrollLock(open)

  if (!open) return null

  const submit = async () => {
    if (!password) {
      setError(t.walletPasswordRequired)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await wallet.unlock(password)
      onUnlocked()
    } catch (e) {
      setError(commandErrorText(t, toCommandError(e)))
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t.walletUnlock}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t.walletUnlock}</div>
        <form
          className="modal-body wallet-unlock-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label className="send-form-label" htmlFor="wallet-unlock-dialog-pw">
            {t.walletPassword}
            <input
              id="wallet-unlock-dialog-pw"
              className="search-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              disabled={busy}
            />
          </label>
          {error && <p className="text-error">{error}</p>}
        </form>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {t.walletCancel}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={submit}
          >
            {t.walletUnlockAction}
          </button>
        </div>
      </div>
    </div>
  )
}
