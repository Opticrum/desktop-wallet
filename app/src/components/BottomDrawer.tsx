import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useScrollLock } from '../lib/useScrollLock'

/**
 * Bottom-up drawer ("big picture" sheet) for the node page's secondary views
 * (full logs, full transaction history). Slides up from the bottom edge and
 * carries the caller's content directly — no title bar. Closes on Escape (the
 * backdrop does not close it, to avoid accidental dismissal); page scroll locks
 * while open. Rendered through a portal into `document.body` so no ancestor
 * stacking context can trap the fixed overlay beneath the top bar.
 */
export function BottomDrawer({
  open,
  onClose,
  ariaLabel,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Accessible name for the dialog (not rendered visually). */
  ariaLabel: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useScrollLock(open)

  if (!open) return null

  return createPortal(
    <div className="drawer-backdrop" role="presentation">
      <div
        className="bottom-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="drawer-handle" aria-hidden="true" />
        <div className="drawer-inner">
          <div className="drawer-content">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
