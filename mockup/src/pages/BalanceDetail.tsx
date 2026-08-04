import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'
import { wallet, hdAccounts, type Tx } from '../mock/wallet'
import { SendDetail } from './SendDetail'
import { CopyableText } from '../components/CopyableText'

function IconArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

/**
 * Deterministic, dependency-free QR-style placeholder rendered from the
 * input value (the CKB address). Not a scannable QR — but visually faithful:
 * proper finder patterns at the three corners, timing patterns along row/column
 * 6, an alignment block at the lower-right, a dark module, and a denser
 * module grid that mimics the look of a real version-4 QR code.
 */
function QrPlaceholder({ value }: { value: string }) {
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

function txLabel(
  type: Tx['type'],
  t: ReturnType<typeof useLocale>['t'],
) {
  switch (type) {
    case 'receive':
      return t.txReceive
    case 'send':
      return t.txSend
    case 'channel_open':
      return t.txChannelOpen
    case 'channel_close':
      return t.txChannelClose
  }
}

export function BalanceDetail() {
  const { t, locale } = useLocale()
  const [whole, frac] = wallet.totalCkb.toFixed(2).split('.')
  const [sendOpen, setSendOpen] = useState(false)

  return (
    <div className="page-wide balance-page">
      <div className="balance-layout">
        <div className="balance-main">
          {/* Total balance + QR */}
          <section className="balance-stage">
            <div className="balance-stage-grid">
              <div className="balance-stage-left">
                <div className="page-title" style={{ margin: 0 }}>
                  {t.yourBalance}
                </div>
                <div
                  className="balance-figure"
                  aria-label={`${wallet.totalCkb} CKB`}
                >
                  {Number(whole).toLocaleString()}
                  <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>
                    .{frac}
                  </span>
                  <span className="unit">CKB</span>
                </div>
                <div className="balance-fiat">
                  ≈ ${wallet.fiatUsd.toLocaleString()} USD
                </div>
              </div>

              <div className="balance-stage-right">
                <div className="balance-qr" aria-label={t.scanToReceive}>
                  <QrPlaceholder value={wallet.address} />
                  <div className="balance-qr-caption">{t.scanToReceive}</div>
                </div>

                <button
                  type="button"
                  className="balance-send-btn"
                  onClick={() => setSendOpen(true)}
                >
                  <IconArrowUpRight />
                  <span>{t.send}</span>
                </button>
              </div>
            </div>

          </section>

          {/* HD wallet — same width as the balance stage, stacked below it */}
          <section className="hd-section">
            <div className="hd-toolbar">
              <button type="button" className="btn-primary">
                {t.hdCreateWallet}
              </button>
              <button type="button" className="btn-secondary">
                {t.walletAccounts}
              </button>
              <button type="button" className="btn-secondary">
                {t.derivationPath}
              </button>
            </div>

            <div className="panel panel-flush">
              {hdAccounts.map((acc) => (
                <div key={acc.id} className="hd-account-row">
                  <div className="hd-account-top">
                    <div className="hd-account-info">
                      <div className="hd-account-name">
                        {locale === 'zh' ? acc.nameZh : acc.nameEn}
                      </div>
                      <div className="hd-account-path">{acc.path}</div>
                    </div>
                    <div className="hd-account-balance">
                      {acc.balanceCkb.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{' '}
                      CKB
                    </div>
                  </div>
                  <div className="hd-account-address">
                    <CopyableText value={acc.address} />
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Activity sidebar — stretches to match the full left column height */}
        <aside className="balance-aside">
          <div className="activity">
            {wallet.txs.slice(0, 5).map((tx) => (
              <div key={tx.id} className="activity-row">
                <div className="activity-main">
                  <span className={`activity-dot ${tx.type}`} aria-hidden />
                  <div>
                    <div className="activity-title">{txLabel(tx.type, t)}</div>
                    <div className="activity-sub">
                      {new Date(tx.timestamp).toLocaleString(
                        locale === 'zh' ? 'zh-CN' : 'en-US',
                        {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className={`activity-amount ${
                    tx.amountCkb >= 0 ? 'positive' : 'negative'
                  }`}
                >
                  {tx.amountCkb >= 0 ? '+' : ''}
                  {tx.amountCkb.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{' '}
                  CKB
                </div>
              </div>
            ))}
          </div>

          <Link to="/wallet/activity" className="btn-secondary view-all-btn">
            {t.viewAll} →
          </Link>
        </aside>
      </div>

      <SendDetail open={sendOpen} onClose={() => setSendOpen(false)} />
    </div>
  )
}