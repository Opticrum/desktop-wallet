import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { channels } from '../api/client'
import { toCommandError } from '../api/types'
import { QrPlaceholder } from './QrModal'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/useScrollLock'

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
 * Two steps: pick an amount → ask the fiber node for a real signed invoice
 * (bech32m `fibt|fibb` address) → reveal it (QR + copy plate).
 */
export function FiberInvoiceModal({
  open,
  onClose,
  capCkb,
  network = 'testnet',
  onToast,
}: {
  open: boolean
  onClose: () => void
  /** Inbound capacity cap (CKB) — the max the invoice may request. */
  capCkb: number
  /** CKB chain the node is on — drives the invoice HRP (`fibt` testnet / `fibb` mainnet). */
  network: 'mainnet' | 'testnet'
  onToast: (msg: string) => void
}) {
  const { t } = useLocale()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const { shown, entered, onExitEnd } = usePresence(open)

  useScrollLock(shown)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setError(null)
    setInvoice(null)
    setCopied(false)
    setGenerating(false)
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!shown) return null

  const handleGenerate = async () => {
    const value = Number.parseFloat(amount)
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      setError(t.fiberAmountRequired)
      return
    }
    if (value > capCkb) {
      setError(t.fiberOverCap)
      return
    }
    setError(null)
    setGenerating(true)
    try {
      // Ask the fiber node for a real signed invoice — `fnn-cli send_payment`
      // validates the bech32m structure + signature, so a mock string fails.
      const address = await channels.createInvoice(Math.round(value * 1e8), network)
      setInvoice(address)
      onToast(t.fiberGeneratedToast)
    } catch (e) {
      setError(t.fiberGenerateFailed)
      onToast(`${t.fiberGenerateFailed}${toCommandError(e).message}`)
    } finally {
      setGenerating(false)
    }
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
    <div
      className={`send-modal-backdrop${entered ? ' is-open' : ''}`}
      role="presentation"
      onTransitionEnd={onExitEnd}
    >
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
              <button type="button" className="btn-secondary" onClick={onClose} disabled={generating}>
                {t.walletCancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? t.fiberGenerating : t.fiberGenerate}
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
