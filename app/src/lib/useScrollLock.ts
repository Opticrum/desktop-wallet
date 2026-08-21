import { useEffect } from 'react'

/**
 * Lock the page scroll while `active` (a modal/drawer is open) so wheel and
 * trackpad input over the overlay can't scroll the page behind it.
 *
 * Locks `body` (generic fallback) and the app's real scroll container
 * `.center-panel` (the element pages actually scroll in) — `overscroll-behavior`
 * alone doesn't cut the wheel chain on every WebView. Restores the previous
 * inline values on cleanup.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const body = document.body
    const panel = document.querySelector<HTMLElement>('.center-panel')
    const prevBody = body.style.overflow
    const prevPanel = panel?.style.overflow
    body.style.overflow = 'hidden'
    if (panel) panel.style.overflow = 'hidden'
    return () => {
      body.style.overflow = prevBody
      if (panel) panel.style.overflow = prevPanel ?? ''
    }
  }, [active])
}
