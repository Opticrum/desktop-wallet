import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Channel } from '@tauri-apps/api/core'
import { node } from '../api/client'
import { useLocale } from '../i18n/LocaleContext'
import type { Messages } from '../i18n/types'
import { toCommandError } from '../api/types'
import type { CkbTxPhase, CkbTxProgress } from '../api/types'
import { explorerTxUrl } from '../lib/wallet'
import { useWalletNetwork } from '../wallet/WalletNetworkContext'
import { useScrollLock } from '../lib/useScrollLock'

/**
 * Localized message for a command error `code` — the four hesitation-window
 * codes get friendly text so a window-boundary race reads clearly; anything
 * unknown falls back to the backend's raw `message`.
 */
function localizeCommandError(t: Messages, code: string, message: string): string {
  switch (code) {
    case 'withdraw_window_expired':
      return t.lmWithdrawExpiredHint
    case 'inject_during_hesitation':
      return t.lmInjectBlockedHesitation
    case 'hesitation_not_elapsed':
      return t.lmHesitationNotElapsed
    case 'partial_withdraw_not_allowed':
      return t.lmPartialWithdrawNotAllowed
    default:
      return message
  }
}

export type CkbTxWaitingPhase = 'constructing' | CkbTxPhase

export type CkbTxState =
  | { status: 'idle' }
  | { status: 'waiting'; label: string; phase: CkbTxWaitingPhase }
  | { status: 'confirmed'; label: string; txHash: string }
  | { status: 'rejected'; label: string; phase: CkbTxWaitingPhase; error: string }

/**
 * Progress handle handed to the action — the frontend forwards `channel` to the
 * IPC call (Rust streams `broadcasting`/`confirming` back), and frontend-driven
 * flows (channel close) call `advance` directly.
 */
export interface CkbTxProgressHandle {
  channel: Channel<CkbTxProgress>
  advance: (phase: CkbTxPhase) => void
}

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

function IconExternal() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M14 5h5v5" />
      <path d="M20 4 10 14" />
      <path d="M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
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

type StepState = 'done' | 'active' | 'pending' | 'failed'

/** Which of the three steps failed, inferred from the last known phase. */
const FAILED_STEP: Record<CkbTxWaitingPhase, 0 | 1 | 2> = {
  constructing: 0,
  broadcasting: 1,
  confirming: 2,
}

/** Per-step state for the 3-step stepper (构造 → 发送上链 → 打包确认). */
function stepStates(status: 'waiting' | 'confirmed' | 'rejected', phase?: CkbTxWaitingPhase): StepState[] {
  if (status === 'confirmed') return ['done', 'done', 'done']
  if (status === 'rejected') {
    const failed = FAILED_STEP[phase ?? 'constructing']
    return [0, 1, 2].map((i) => (i === failed ? 'failed' : i < failed ? 'done' : 'pending'))
  }
  // waiting — the modal opens on the "constructing" step itself.
  const p = phase ?? 'constructing'
  if (p === 'constructing') return ['active', 'pending', 'pending']
  if (p === 'broadcasting') return ['done', 'active', 'pending']
  return ['done', 'done', 'active']
}

/**
 * CKB transaction confirmation modal. Walks a 3-step lifecycle —
 * ① 构造交易 ② 发送上链 ③ 打包确认 — driven by progress events from the backend
 * (or `advance` calls from frontend-driven flows), then shows the confirmed tx
 * hash (click to open the explorer; copy stays on the side) or the failure.
 * Stays open after confirmation until the user clicks 确认. Non-dismissable
 * while waiting (no close button, no Escape) — the operation still completes
 * in the background.
 */
export function CkbTxModal({
  state,
  onClose,
  overDrawer = false,
}: {
  state: CkbTxState
  onClose: () => void
  /** Sit above the bottom / side drawer (z-index 300). */
  overDrawer?: boolean
}) {
  const { t } = useLocale()
  const { chain } = useWalletNetwork()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
  }, [state.status])

  useEffect(() => {
    if (state.status === 'idle') return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      // Non-dismissible while waiting — the tx is still being confirmed.
      if (state.status !== 'waiting') onClose()
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [state.status, onClose])

  useScrollLock(state.status !== 'idle')

  if (state.status === 'idle') return null

  const waiting = state.status === 'waiting'
  const confirmed = state.status === 'confirmed'
  const rejected = state.status === 'rejected'

  const handleCopy = async () => {
    if (state.status !== 'confirmed' || !state.txHash) return
    await copyText(state.txHash)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const handleOpenExplorer = () => {
    if (state.status !== 'confirmed' || !state.txHash) return
    const url = explorerTxUrl(chain, state.txHash)
    node.openUrl(url).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer')
    })
  }

  const statusText = waiting
    ? state.phase === 'confirming'
      ? t.ckbTxPhaseConfirming
      : state.phase === 'broadcasting'
        ? t.ckbTxPhaseBroadcasting
        : t.ckbTxPhaseConstructing
    : confirmed
      ? t.ckbTxConfirmed
      : t.ckbTxFailed

  const steps = stepStates(waiting ? 'waiting' : confirmed ? 'confirmed' : 'rejected', state.status === 'waiting' || state.status === 'rejected' ? state.phase : undefined)
  const stepLabels = [t.ckbTxStepConstruct, t.ckbTxStepBroadcast, t.ckbTxStepConfirm]

  return createPortal(
    <div
      className={`modal-backdrop ckb-tx-backdrop${overDrawer ? ' is-over-drawer' : ''}`}
      role="presentation"
    >
      <div
        className="modal ckb-tx-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {!waiting && (
          <button type="button" className="ckb-tx-close" aria-label={t.close} onClick={onClose}>
            <IconClose />
          </button>
        )}

        <div className="ckb-tx-title">{state.label}</div>

        <ol className="ckb-tx-steps">
          {steps.map((st, i) => (
            <li key={i} className={`ckb-tx-step is-${st}`}>
              <span className="ckb-tx-step-node" aria-hidden>
                {st === 'done' ? (
                  <IconCheck />
                ) : st === 'failed' ? (
                  <IconError />
                ) : st === 'active' ? (
                  <span className="ckb-tx-step-spinner" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="ckb-tx-step-label">{stepLabels[i]}</span>
            </li>
          ))}
        </ol>

        <div className={`ckb-tx-status${rejected ? ' is-failed' : ''}`}>{statusText}</div>

        {waiting && <div className="ckb-tx-hint">{t.ckbTxWaitingHint}</div>}

        {confirmed && (
          <>
            <div className="ckb-tx-hint">{t.ckbTxConfirmedHint}</div>
            {state.txHash && (
              <div className="ckb-tx-hash">
                <div className="ckb-tx-hash-label">
                  <span>{t.ckbTxHash}</span>
                  <button
                    type="button"
                    className="ckb-tx-hash-copy"
                    onClick={handleCopy}
                    title={`${t.copy}: ${state.txHash}`}
                    aria-label={`${t.copy}: ${state.txHash}`}
                  >
                    {copied ? t.copied : <IconCopy />}
                  </button>
                </div>
                <button
                  type="button"
                  className="ckb-tx-hash-value mono"
                  onClick={handleOpenExplorer}
                  title={t.ckbTxViewExplorer}
                >
                  <span>{state.txHash}</span>
                  <IconExternal />
                </button>
              </div>
            )}
          </>
        )}

        {rejected && <div className="ckb-tx-error">{state.error}</div>}

        {!waiting && (
          <button type="button" className="btn-primary ckb-tx-done" onClick={onClose}>
            {confirmed ? t.ckbTxOk : t.close}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Run a CKB transaction command behind the 3-step confirmation modal.
 *
 * Creates a per-invocation Tauri `Channel` and passes `{ channel, advance }` to
 * the action: Rust events stream `broadcasting` → `confirming` back (liquidity /
 * wallet flows forward `channel` to the IPC call), and frontend-driven flows
 * (channel close) call `advance` directly. `onConfirmed` fires the moment
 * the command resolves (the backend only resolves once the tx is confirmed
 * on-chain) so the page can refresh. The modal stays on the confirmed hash
 * until the user clicks 确认. Handles both camelCase (`txHash`) and snake_case
 * (`tx_hash`) result shapes.
 */
export function useCkbTx(onConfirmed?: () => void) {
  const { t } = useLocale()
  const [state, setState] = useState<CkbTxState>({ status: 'idle' })
  const runIdRef = useRef(0)
  const phaseRef = useRef<CkbTxWaitingPhase>('constructing')

  const runCkbTx = useCallback(
    async (
      label: string,
      action: (progress: CkbTxProgressHandle) => Promise<{ txHash?: string; tx_hash?: string } | null>,
    ) => {
      const runId = ++runIdRef.current
      phaseRef.current = 'constructing'
      setState({ status: 'waiting', label, phase: 'constructing' })
      const channel = new Channel<CkbTxProgress>()
      const advance = (phase: CkbTxPhase) => {
        if (runId !== runIdRef.current) return
        phaseRef.current = phase
        setState((prev) => (prev.status === 'waiting' ? { ...prev, phase } : prev))
      }
      channel.onmessage = (progress) => {
        if (progress?.phase) advance(progress.phase)
      }
      const startedAt = Date.now()
      try {
        const res = await action({ channel, advance })
        const txHash = res?.txHash ?? res?.tx_hash ?? ''
        if (txHash) {
          console.info(`[opticrum] CKB tx confirmed (${label}): ${txHash}`)
        }
        onConfirmed?.()
        // Keep the waiting state legible even when the backend resolves fast
        // so the transition never flashes imperceptibly.
        const minWait = 700 - (Date.now() - startedAt)
        if (minWait > 0) await new Promise((r) => setTimeout(r, minWait))
        if (runId !== runIdRef.current) return
        setState({ status: 'confirmed', label, txHash })
      } catch (e) {
        if (runId !== runIdRef.current) return
        const err = toCommandError(e)
        setState({
          status: 'rejected',
          label,
          phase: phaseRef.current,
          error: localizeCommandError(t, err.code, err.message),
        })
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
