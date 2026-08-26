import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../i18n/LocaleContext'
import { useScrollLock } from '../lib/useScrollLock'

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

/** Minimum spendable CKB amount — a secp256k1_blake160 cell with empty data. */
const MIN_SEND_CKB = 61

/**
 * Floating send dialog. Portaled to `document.body` so the overlay covers the
 * full app — the wallet lives in a transformed drawer, which would otherwise
 * clip `position: fixed` to the sheet. Collects a recipient CKB address +
 * amount (CKB), validates locally, then hands off to `onSubmit` — the parent
 * runs the tx through the 3-step confirmation modal (构造 → 发送上链 → 打包确认).
 */
export function SendDetail({
  open,
  onClose,
  addressShort,
  availableCkb,
  busy,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  /** Compact receiving address shown as the placeholder. */
  addressShort: string
  /** Available spendable balance in CKB — upper bound for the amount. */
  availableCkb: number
  /** Disables the confirm button while a tx is running. */
  busy: boolean
  /** Fired with (address, amountCkb) once the form validates. */
  onSubmit: (address: string, amountCkb: number) => void
}) {
  const { t } = useLocale()
  const [address, setAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setAddress('')
      setAmount('')
      setError(null)
    }
  }, [open])

  // Capture Escape so the wallet drawer behind this overlay does not also close.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  useScrollLock(open)

  if (!open) return null

  const handleConfirm = () => {
    const amt = Number(amount)
    if (!address.trim()) {
      setError(t.sendAddressRequired)
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError(t.sendAmountInvalid)
      return
    }
    if (amt < MIN_SEND_CKB) {
      setError(t.sendAmountMin)
      return
    }
    if (amt > availableCkb) {
      setError(t.sendAmountExceed)
      return
    }
    setError(null)
    onSubmit(address.trim(), amt)
  }

  return createPortal(
    <div className="send-modal-backdrop is-over-drawer" role="presentation">
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
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              spellCheck={false}
              autoComplete="off"
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
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="send-form-unit">CKB</span>
            </div>
          </div>

          {error && <div className="send-form-error">{error}</div>}

          <div className="send-form-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={handleConfirm}
            >
              {t.sendConfirm}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
