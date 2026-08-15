import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { toCommandError } from '../api/types'

export type CkbTxState =
  | { status: 'idle' }
  | { status: 'waiting'; label: string }
  | { status: 'confirmed'; label: string; txHash: string }
  | { status: 'rejected'; label: string; error: string }

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  )
}

function IconError() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
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
 * CKB transaction confirmation modal. Prompts the wait for the tx to confirm
 * on-chain (the underlying command resolves only once it has), then shows the
 * confirmed tx hash (copyable). Non-dismissable while waiting except via the
 * close button / Escape — the operation still completes in the background.
 */
export function CkbTxModal({
  state,
  onClose,
}: {
  state: CkbTxState
  onClose: () => void
}) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (state.status === 'idle') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.status, onClose])

  if (state.status === 'idle') return null

  const waiting = state.status === 'waiting'
  const confirmed = state.status === 'confirmed'
  const rejected = state.status === 'rejected'

  const handleCopy = async () => {
    if (state.status !== 'confirmed') return
    await copyText(state.txHash)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div
      className="modal-backdrop ckb-tx-backdrop"
      onClick={waiting ? undefined : onClose}
      role="presentation"
    >
      <div
        className="modal ckb-tx-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="ckb-tx-close" aria-label={t.close} onClick={onClose}>
          <IconClose />
        </button>

        <div className={`ckb-tx-icon is-${state.status}`}>
          {waiting ? <span className="ckb-tx-spinner" aria-hidden="true" /> : confirmed ? <IconCheck /> : <IconError />}
        </div>

        <div className="ckb-tx-title">
          {waiting ? t.ckbTxWaiting : confirmed ? t.ckbTxConfirmed : t.ckbTxFailed}
        </div>
        <div className="ckb-tx-label">{state.label}</div>

        {waiting && <div className="ckb-tx-hint">{t.ckbTxWaitingHint}</div>}

        {confirmed && (
          <>
            <div className="ckb-tx-hint">{t.ckbTxConfirmedHint}</div>
            {state.txHash && (
              <button
                type="button"
                className="ckb-tx-hash"
                onClick={handleCopy}
                title={`${t.copy}: ${state.txHash}`}
              >
                <span className="ckb-tx-hash-label">{t.ckbTxHash}</span>
                <span className="ckb-tx-hash-value mono">{state.txHash}</span>
                <span className="ckb-tx-hash-copy">{copied ? t.copied : <IconCopy />}</span>
              </button>
            )}
          </>
        )}

        {rejected && <div className="ckb-tx-error">{state.error}</div>}

        {!waiting && (
          <button type="button" className="btn-primary ckb-tx-done" onClick={onClose}>
            {t.close}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Run a CKB transaction command behind the confirmation modal.
 *
 * `onConfirmed` fires the moment the command resolves (the backend only
 * resolves once the tx is confirmed on-chain) so the page can refresh.
 * The tx hash is printed to the browser console on confirmation, and shown
 * in the modal. Handles both camelCase (`txHash`) and snake_case (`tx_hash`)
 * result shapes (browser mock vs wire).
 */
export function useCkbTx(onConfirmed?: () => void) {
  const [state, setState] = useState<CkbTxState>({ status: 'idle' })
  const runIdRef = useRef(0)

  const runCkbTx = useCallback(
    async (label: string, action: () => Promise<{ txHash?: string; tx_hash?: string } | null>) => {
      const runId = ++runIdRef.current
      setState({ status: 'waiting', label })
      const startedAt = Date.now()
      try {
        const res = await action()
        const txHash = res?.txHash ?? res?.tx_hash ?? ''
        if (txHash) {
          console.info(`[opticrum] CKB tx confirmed (${label}): ${txHash}`)
        }
        onConfirmed?.()
        // Keep the waiting state legible even when the backend resolves fast
        // (e.g. browser mock) so the transition never flashes imperceptibly.
        const minWait = 700 - (Date.now() - startedAt)
        if (minWait > 0) await new Promise((r) => setTimeout(r, minWait))
        if (runId !== runIdRef.current) return
        setState({ status: 'confirmed', label, txHash })
        window.setTimeout(() => {
          if (runId === runIdRef.current) setState({ status: 'idle' })
        }, 1800)
      } catch (e) {
        if (runId !== runIdRef.current) return
        setState({ status: 'rejected', label, error: toCommandError(e).message })
      }
    },
    [onConfirmed],
  )

  const closeCkbTx = useCallback(() => {
    runIdRef.current++ // invalidate any pending transition
    setState({ status: 'idle' })
  }, [])

  return { ckbTxState: state, runCkbTx, closeCkbTx }
}
