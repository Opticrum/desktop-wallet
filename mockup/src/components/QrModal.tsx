import { useEffect } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { CopyableText } from './CopyableText'

/**
 * Deterministic, dependency-free QR-style placeholder rendered from the
 * input value (the CKB address). Not a scannable QR — but visually faithful:
 * proper finder patterns at the three corners, timing patterns along row/column
 * 6, an alignment block at the lower-right, a dark module, and a denser
 * module grid that mimics the look of a real version-4 QR code.
 */
export function QrPlaceholder({ value }: { value: string }) {
  const size = 33

  // Two-stage hash → uniform bit stream keyed off the address.
  // Stage 1: FNV-1a 32-bit.
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  // Stage 2: xorshift to expand into a longer pseudo-random sequence.
  const bits: boolean[] = []
  let seed = hash >>> 0
  for (let i = 0; i < size * size; i++) {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    seed = seed >>> 0
    bits.push((seed & 1) === 0)
  }

  // True if (x,y) falls inside the 7×7 finder pattern anchored at (sx, sy).
  const inFinder = (x: number, y: number, sx: number, sy: number) =>
    x >= sx && x < sx + 7 && y >= sy && y < sy + 7

  // The three finder pattern anchors.
  const finders = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ] as const

  const isFinderArea = (x: number, y: number) =>
    finders.some(([sx, sy]) => inFinder(x, y, sx, sy))

  // Returns true for cells that are part of a finder pattern's drawn shape:
  // outer 1-module ring + 3×3 inner block, with the separator ring of 1 light
  // module around the finder.
  const isFinderModule = (x: number, y: number) => {
    for (const [sx, sy] of finders) {
      const lx = x - sx
      const ly = y - sy
      if (lx < -1 || lx > 7 || ly < -1 || ly > 7) continue
      const onOuter =
        lx === 0 || lx === 6 || ly === 0 || ly === 6
      const onInner = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4
      if (onOuter || onInner) return true
    }
    return false
  }

  // Alignment pattern (5×5) anchored at (size-9, size-9) — only for version 2+.
  const alignCx = size - 9
  const alignCy = size - 9
  const isAlignmentModule = (x: number, y: number) => {
    const lx = x - alignCx
    const ly = y - alignCy
    if (lx < -2 || lx > 2 || ly < -2 || ly > 2) return false
    const onEdge = Math.abs(lx) === 2 || Math.abs(ly) === 2
    const onCenter = lx === 0 && ly === 0
    return onEdge || onCenter
  }

  // Timing patterns: alternating modules along row 6 and column 6, but only
  // between the finder patterns (skipping finder areas).
  const isTiming = (x: number, y: number) => {
    if (y === 6 && x >= 8 && x <= size - 9) {
      return x % 2 === 0
    }
    if (x === 6 && y >= 8 && y <= size - 9) {
      return y % 2 === 0
    }
    return false
  }

  // The mandatory dark module at (8, size - 8) for any version 7+ — for
  // version 1–6 this is always (8, size - 8) which is row 8 col (size-8).
  // For our size (33, version 4) it's at row 8, col 25.
  const isDarkModule = (x: number, y: number) => x === 8 && y === size - 8

  const cell = 100 / size
  const rects: { x: number; y: number }[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let filled = false
      if (isFinderArea(x, y)) {
        filled = isFinderModule(x, y)
      } else if (isAlignmentModule(x, y)) {
        filled = true
      } else if (isTiming(x, y)) {
        filled = true
      } else if (isDarkModule(x, y)) {
        filled = true
      } else {
        filled = bits[y * size + x]
      }
      if (filled) rects.push({ x: x * cell, y: y * cell })
    }
  }

  return (
    <svg
      viewBox={`0 0 100 100`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={cell}
          height={cell}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}

export function QrZoomIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6M8 11h6" />
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

/** Enlarged receive QR dialog — click the QR tile to open it. */
export function QrModal({
  open,
  onClose,
  address,
}: {
  open: boolean
  onClose: () => void
  address: string
}) {
  const { t } = useLocale()

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="qr-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.scanToReceive}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qr-modal-head">
          <div className="qr-modal-kicker">{t.scanToReceive}</div>
          <button
            type="button"
            className="qr-modal-close"
            aria-label={t.close}
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>
        <div className="qr-modal-qr">
          <QrPlaceholder value={address} />
        </div>
        <div className="qr-modal-address">
          <CopyableText value={address} />
        </div>
      </div>
    </div>
  )
}
