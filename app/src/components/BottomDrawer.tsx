import { useEffect, useState, type ReactNode, type TransitionEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../i18n/LocaleContext'
import { useScrollLock } from '../lib/useScrollLock'

const EXIT_MS = 450

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M7 7 17 17" />
      <path d="M17 7 7 17" />
    </svg>
  )
}

/**
 * Bottom-up drawer ("big picture" sheet) for the node page's secondary views
 * (full logs, full transaction history). Slides up from the bottom edge and
 * carries the caller's content directly. Closes via the circular X sitting
 * outside the sheet's top-center, or Escape (the backdrop does not close it,
 * to avoid accidental dismissal). Exit animation is the reverse of enter.
 * Rendered through a portal into `document.body` so no ancestor stacking
 * context can trap the fixed overlay beneath the top bar.
 */
export function BottomDrawer({
  open,
  onClose,
  ariaLabel,
  wide = false,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Accessible name for the dialog (not rendered visually). */
  ariaLabel: string
  /** Wider sheet — used for the wallet module. */
  wide?: boolean
  children: ReactNode
}) {
  const { t } = useLocale()
  const [shown, setShown] = useState(open)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (open) {
      setShown(true)
      return
    }
    setEntered(false)
    const id = window.setTimeout(() => setShown(false), EXIT_MS)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!shown || !open) return
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true))
    })
    return () => window.cancelAnimationFrame(id)
  }, [shown, open])

  useEffect(() => {
    if (!shown) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shown, onClose])

  useScrollLock(shown)

  const handleStackTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.propertyName !== 'transform') return
    if (!open) setShown(false)
  }

  if (!shown) return null

  return createPortal(
    <div
      className={`drawer-backdrop${entered ? ' is-open' : ''}`}
      role="presentation"
    >
      <div
        className={`bottom-drawer-stack${wide ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onTransitionEnd={handleStackTransitionEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="drawer-close"
          aria-label={t.close}
          onClick={onClose}
        >
          <IconClose />
        </button>
        <div className="bottom-drawer">
          <div className="drawer-chrome">
            <span className="drawer-handle" aria-hidden="true" />
          </div>
          <div className="drawer-inner">
            <div className="drawer-content">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
