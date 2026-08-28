import { useEffect, useState, type TransitionEvent } from 'react'

/** Fallback unmount delay if `transitionend` never fires (e.g. reduced motion). */
const EXIT_FALLBACK_MS = 280

/**
 * Keep a modal/overlay mounted through its exit transition.
 *
 * Mirrors `BottomDrawer`: when `open` flips false, drop the enter class so CSS
 * can reverse the animation, then unmount after `transitionend` (or a short
 * timeout fallback). Double-rAF on open so the browser paints the closed
 * state before applying `is-open`.
 */
export function usePresence(open: boolean) {
  const [shown, setShown] = useState(open)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (open) {
      setShown(true)
      return
    }
    setEntered(false)
    const id = window.setTimeout(() => setShown(false), EXIT_FALLBACK_MS)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!shown || !open) return
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true))
    })
    return () => window.cancelAnimationFrame(id)
  }, [shown, open])

  const onExitEnd = (e: TransitionEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.propertyName !== 'opacity') return
    if (!open) setShown(false)
  }

  return { shown, entered, onExitEnd }
}
