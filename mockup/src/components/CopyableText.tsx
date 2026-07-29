import { useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'

/**
 * Click-to-copy text. Renders an inline-block with a small copy icon that
 * appears on hover/focus. After a successful copy:
 *   - text color flashes to ok for ~1.4s
 *   - a small "Copied" toast pops above
 *
 * Falls back to a hidden textarea + execCommand when navigator.clipboard
 * isn't available (insecure contexts, older browsers).
 */
export function CopyableText({
  value,
  className = '',
}: {
  value: string
  className?: string
}) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCopy()
    }
  }

  return (
    <span
      className={`copyable${copied ? ' copied' : ''}${className ? ` ${className}` : ''}`}
      onClick={handleCopy}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`${t.copied}: ${value}`}
    >
      <span className="copyable-text">{value}</span>
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="copyable-icon"
      >
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
      {copied && (
        <span className="copyable-toast" aria-live="polite">
          {t.copied}
        </span>
      )}
    </span>
  )
}
