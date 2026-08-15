import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { QrPlaceholder } from './QrModal'

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

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

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

/** Compact CKB string for the "max" fill (strip trailing zeros). */
function fmtCkb(n: number): string {
  const s = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return s
}

/** Deterministic, plausible-looking mock Fiber invoice (not a real one). */
function mockFiberInvoice(amountCkb: number): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l' // bech32 charset
  const sat = Math.max(1, Math.round(amountCkb * 1e8))
  let s = (sat ^ 0x9e3779b9) >>> 0
  const next = () => {
    s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) >>> 0
    s = Math.imul(s ^ (s >>> 12), 0x297a2d39) >>> 0
    s = (s ^ (s >>> 15)) >>> 0
    return s
  }
  // Amount tag (BOLT11-style: integer + unit letter) folded into the body.
  const amountTag = `${Math.floor(amountCkb)}u`
  let body = amountTag
  while (body.length < 96) body += CHARSET[next() % 32]
  return `fiber1${body}`
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = value
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

/**
 * Generate-invoice dialog, opened from the node overview's 入金 KPI. The
 * amount is capped at the inbound capacity (sum of channel remote balances).
 * Two steps: pick an amount → reveal the generated invoice (QR + copy plate).
 * Functional mockup — no real invoice is produced yet.
 */
export function FiberInvoiceModal({
  open,
  onClose,
  capCkb,
  onToast,
}: {
  open: boolean
  onClose: () => void
  /** Inbound capacity cap (CKB) — the max the invoice may request. */
  capCkb: number
  onToast: (msg: string) => void
}) {
  const { t } = useLocale()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setError(null)
    setInvoice(null)
    setCopied(false)
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleGenerate = () => {
    const value = Number.parseFloat(amount)
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      setError(t.fiberAmountRequired)
      return
    }
    if (value > capCkb) {
      setError(t.fiberOverCap)
      return
    }
    setInvoice(mockFiberInvoice(value))
    setError(null)
    onToast(t.fiberGeneratedToast)
  }

  const handleCopy = async () => {
    if (!invoice) return
    await copyText(invoice)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCopy()
    }
  }

  return (
    <div className="send-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="send-modal fiber-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.fiberInvoiceTitle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="send-modal-head">
          <div>
            <div className="send-modal-kicker">{t.fiberInvoiceKicker}</div>
            <h2 className="send-modal-title">
              {invoice ? t.fiberInvoiceReady : t.fiberInvoiceTitle}
            </h2>
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

        {!invoice ? (
          <div className="send-form">
            <p className="fiber-desc">{t.fiberInvoiceDesc}</p>

            <div className="send-form-row">
              <label className="send-form-label" htmlFor="fiber-invoice-amount">
                {t.fiberAmount}
              </label>
              <div className="send-form-amount">
                <input
                  id="fiber-invoice-amount"
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
                  {t.fiberCapInbound}
                  <strong> {capCkb.toLocaleString()} CKB</strong>
                </span>
              </div>
            </div>

            {error && <p className="text-error">{error}</p>}

            <div className="send-form-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                {t.walletCancel}
              </button>
              <button type="button" className="btn-primary" onClick={handleGenerate}>
                {t.fiberGenerate}
              </button>
            </div>
          </div>
        ) : (
          <div className="send-form">
            <div className="fiber-sheet">
              <div className="fiber-sheet-top">
                <div className="fiber-sheet-qr" aria-hidden="true">
                  <QrPlaceholder value={invoice} />
                </div>
                <div className="fiber-sheet-info">
                  <span className="fiber-sheet-kicker">
                    <IconCheck />
                    {t.fiberInvoiceReady}
                  </span>
                  <div className="fiber-sheet-amount">
                    {amount}
                    <span className="unit">CKB</span>
                  </div>
                  <p className="fiber-sheet-msg">{t.fiberInvoiceDesc}</p>
                </div>
              </div>

              <div
                className={`fiber-invoice-plate${copied ? ' copied' : ''}`}
                role="button"
                tabIndex={0}
                onClick={handleCopy}
                onKeyDown={handleKeyDown}
                aria-label={`${t.copy}: ${invoice}`}
              >
                <div className="fiber-invoice-plate-label">
                  <span>{t.fiberTargetInvoice}</span>
                  <span className="fiber-plate-copy">
                    {copied ? <IconCheck /> : <IconCopy />}
                    {copied ? t.copied : t.copy}
                  </span>
                </div>
                <div className="fiber-invoice-plate-string">{invoice}</div>
              </div>
            </div>

            <div className="send-form-actions">
              <button type="button" className="btn-primary" onClick={onClose}>
                {t.fiberDone}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
