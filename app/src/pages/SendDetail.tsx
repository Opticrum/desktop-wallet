import { useEffect } from 'react'
import { useLocale } from '../i18n/LocaleContext'

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

/**
 * Floating send dialog rendered above the wallet page.
 * Controlled by `open` + `onClose`. Closes on backdrop click, Escape, or
 * the close button. Form is intentionally read-only — this is a visual
 * mockup for the Send flow.
 */
export function SendDetail({
  open,
  onClose,
  addressShort,
}: {
  open: boolean
  onClose: () => void
  /** Compact receiving address shown as the placeholder. */
  addressShort: string
}) {
  const { t } = useLocale()

  // Escape to dismiss
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="send-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="send-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.send}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="send-modal-head">
          <div>
            <div className="send-modal-kicker">{t.walletCkb}</div>
            <h2 className="send-modal-title">{t.send}</h2>
          </div>
          <button
            type="button"
            className="send-modal-close"
            aria-label={t.close}
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>

        <div className="send-form">
          <div className="send-form-row">
            <label className="send-form-label" htmlFor="send-addr">
              {t.sendAddress}
            </label>
            <input
              id="send-addr"
              className="search-input"
              placeholder={addressShort}
              defaultValue=""
              readOnly
            />
          </div>

          <div className="send-form-row">
            <label className="send-form-label" htmlFor="send-amount">
              {t.sendAmount}
            </label>
            <div className="send-form-amount">
              <input
                id="send-amount"
                className="search-input"
                placeholder="0.00"
                defaultValue=""
                readOnly
              />
              <span className="send-form-unit">CKB</span>
            </div>
          </div>

          <div className="send-form-actions">
            <button type="button" className="btn-primary" disabled>
              {t.sendConfirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
