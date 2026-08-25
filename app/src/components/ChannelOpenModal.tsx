import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../i18n/LocaleContext'
import { CopyableText } from './CopyableText'
import { useScrollLock } from '../lib/useScrollLock'
import { shortHash } from '../lib/wallet'

export type ChannelOpenState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'waiting' }
  | { status: 'ready'; channelId: string }
  | { status: 'failed'; error: string }

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

/**
 * Channel-open progress dialog. Fiber builds the funding tx internally, so
 * success is "the node listed the new channel" — not on-chain confirmation.
 * Non-dismissable while submitting/waiting; stays open on ready/failed until
 * the user clicks 确认.
 */
export function ChannelOpenModal({
  state,
  onClose,
  overDrawer = false,
}: {
  state: ChannelOpenState
  onClose: () => void
  overDrawer?: boolean
}) {
  const { t } = useLocale()

  useEffect(() => {
    if (state.status === 'idle') return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (state.status !== 'submitting' && state.status !== 'waiting') onClose()
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [state.status, onClose])

  useScrollLock(state.status !== 'idle')

  if (state.status === 'idle') return null

  const waiting = state.status === 'submitting' || state.status === 'waiting'
  const ready = state.status === 'ready'
  const failed = state.status === 'failed'

  const statusText =
    state.status === 'submitting'
      ? t.channelOpenSubmitting
      : state.status === 'waiting'
        ? t.channelOpenWaiting
        : ready
          ? t.channelOpenReady
          : t.channelOpenFailed

  const hint = waiting ? t.channelOpenHint : ready ? t.channelOpenReadyHint : null

  return createPortal(
    <div
      className={`modal-backdrop ckb-tx-backdrop${overDrawer ? ' is-over-drawer' : ''}`}
      role="presentation"
    >
      <div
        className="modal ckb-tx-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.channelOpenLabel}
        onClick={(e) => e.stopPropagation()}
      >
        {!waiting && (
          <button type="button" className="ckb-tx-close" aria-label={t.close} onClick={onClose}>
            <IconClose />
          </button>
        )}

        <div
          className={`ckb-tx-icon${ready ? ' is-confirmed' : failed ? ' is-rejected' : ' is-waiting'}`}
        >
          {ready ? <IconCheck /> : failed ? <IconError /> : <span className="ckb-tx-spinner" />}
        </div>

        <div className="ckb-tx-title">{t.channelOpenLabel}</div>
        <div className={`ckb-tx-status${failed ? ' is-failed' : ''}`}>{statusText}</div>
        {hint && <div className="ckb-tx-hint">{hint}</div>}

        {ready && state.channelId && (
          <div className="channel-open-id">
            <span className="channel-open-id-k">{t.nodeChannelId}</span>
            <CopyableText
              value={state.channelId}
              display={shortHash(state.channelId)}
              className="mono"
            />
          </div>
        )}

        {failed && <div className="ckb-tx-error">{state.error}</div>}

        {!waiting && (
          <button type="button" className="btn-primary ckb-tx-done" onClick={onClose}>
            {ready ? t.ckbTxOk : t.close}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
