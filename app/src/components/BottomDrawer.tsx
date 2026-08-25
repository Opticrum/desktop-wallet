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
 * Page-level overlay sheet. Default `side="bottom"` slides up from the bottom
 * (wallet, full logs). `side="right"` docks a full-height column that slides
 * in from the right (channel list). Closes via the circular X sitting outside
 * the sheet (top-center on bottom sheets, vertically centered on the left
 * edge of a right-hand column), or Escape — the backdrop does not dismiss.
 * Exit animation is the reverse of enter. Portaled to `document.body` so no
 * ancestor stacking context can trap the overlay beneath the top bar.
 */
export function BottomDrawer({
  open,
  onClose,
  ariaLabel,
  wide = false,
  side = 'bottom',
  dismissible = true,
  flush = false,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Accessible name for the dialog (not rendered visually). */
  ariaLabel: string
  /** Wider sheet — used for the wallet module and full log viewer. */
  wide?: boolean
  /** `right` docks a full-height column that slides in from the right. */
  side?: 'bottom' | 'right'
  /** When false, Escape does not dismiss (a nested confirm is open). */
  dismissible?: boolean
  /** Drop inner padding so the child (e.g. node config) owns the layout. */
  flush?: boolean
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
    if (!shown || !dismissible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shown, onClose, dismissible])

  useScrollLock(shown)

  const handleStackTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.propertyName !== 'transform') return
    if (!open) setShown(false)
  }

  if (!shown) return null

  const isSide = side === 'right'

  return createPortal(
    <div
      className={`drawer-backdrop${entered ? ' is-open' : ''}${isSide ? ' is-side' : ''}`}
      role="presentation"
    >
      <div
        className={`bottom-drawer-stack${isSide ? ' is-side' : wide ? ' is-wide' : ''}${flush ? ' is-flush' : ''}`}
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
          {!isSide && (
            <div className="drawer-chrome">
              <span className="drawer-handle" aria-hidden="true" />
            </div>
          )}
          <div className="drawer-inner">
            <div className="drawer-content">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
