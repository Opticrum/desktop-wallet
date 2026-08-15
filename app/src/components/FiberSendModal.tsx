import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

/** Inbox gauge glyph for the capacity hint row. */
function IconGauge() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 13a8 8 0 1 1 16 0" />
      <path d="M4 13h16" />
      <path d="M12 13v-4" />
      <path d="M12 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Compact CKB string for the "max" fill (strip trailing zeros). */
function fmtCkb(n: number): string {
  const s = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return s
}

/**
 * Send-a-Fiber-transfer dialog, opened from the node overview's 出金 KPI.
 * The target is given as an invoice; the amount is capped at the outbound
 * capacity (sum of channel local balances). Form is a functional mockup —
 * validation + max-fill are live, submission just toasts and closes (no
 * fiber pay command in the IPC surface yet).
 */
export function FiberSendModal({
  open,
  onClose,
  capCkb,
  onToast,
}: {
  open: boolean
  onClose: () => void
  /** Outbound capacity cap (CKB) — the max the user may send. */
  capCkb: number
  onToast: (msg: string) => void
}) {
  const { t } = useLocale()
  const [invoice, setInvoice] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setInvoice('')
    setAmount('')
    setError(null)
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleConfirm = () => {
    const value = Number.parseFloat(amount)
    if (!invoice.trim()) {
      setError(t.fiberInvoiceRequired)
      return
    }
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      setError(t.fiberAmountRequired)
      return
    }
    if (value > capCkb) {
      setError(t.fiberOverCap)
      return
    }
    onToast(t.fiberSentToast)
    onClose()
  }

  return (
    <div className="send-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="send-modal fiber-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.fiberSendTitle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="send-modal-head">
          <div>
            <div className="send-modal-kicker">{t.fiberSendKicker}</div>
            <h2 className="send-modal-title">{t.fiberSendTitle}</h2>
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
          <p className="fiber-desc">{t.fiberSendDesc}</p>

          <div className="send-form-row">
            <label className="send-form-label" htmlFor="fiber-invoice">
              {t.fiberTargetInvoice}
            </label>
            <textarea
              id="fiber-invoice"
              className="fiber-invoice-input"
              value={invoice}
              onChange={(e) => {
                setInvoice(e.target.value)
                setError(null)
              }}
              placeholder={t.fiberTargetInvoicePh}
              rows={3}
              spellCheck={false}
            />
          </div>

          <div className="send-form-row">
            <label className="send-form-label" htmlFor="fiber-send-amount">
              {t.fiberAmount}
            </label>
            <div className="send-form-amount">
              <input
                id="fiber-send-amount"
                className="search-input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setError(null)
                }}
                placeholder="0.00"
              />
              <span className="send-form-unit">CKB</span>
              <button
                type="button"
                className="fiber-max-btn"
                onClick={() => setAmount(fmtCkb(capCkb))}
              >
                {t.fiberMax}
              </button>
            </div>
            <div className="fiber-cap">
              <IconGauge />
              <span>
                {t.fiberCapOutbound}
                <strong> {capCkb.toLocaleString()} CKB</strong>
              </span>
            </div>
          </div>

          {error && <p className="text-error">{error}</p>}

          <div className="send-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t.walletCancel}
            </button>
            <button type="button" className="btn-primary" onClick={handleConfirm}>
              {t.fiberConfirmSend}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
