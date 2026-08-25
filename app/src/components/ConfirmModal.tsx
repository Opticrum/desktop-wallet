import { useEffect } from 'react'
import { useScrollLock } from '../lib/useScrollLock'

type ConfirmModalProps = {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
  /** Sit above the bottom drawer (z-index 300). */
  overDrawer?: boolean
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
  overDrawer = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCancel()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onCancel])

  useScrollLock(open)

  if (!open) return null

  return (
    <div
      className={`modal-backdrop${overDrawer ? ' is-over-drawer' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}