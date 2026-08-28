import { useLocale } from '../i18n/LocaleContext'
import { WalletGate } from './WalletGate'
import { usePresence } from '../lib/usePresence'
import { useScrollLock } from '../lib/useScrollLock'

type WalletSetupDialogProps = {
  open: boolean
  onReady: () => void
}

/**
 * Non-dismissable wallet-creation dialog. Shown while no CKB wallet exists —
 * there is deliberately no close button, backdrop-click, or Escape escape:
 * the user must create (or import) a wallet here before the node page proceeds.
 * `onReady` fires once the wallet is available and the dialog can close.
 */
export function WalletSetupDialog({ open, onReady }: WalletSetupDialogProps) {
  const { t } = useLocale()
  const { shown, entered, onExitEnd } = usePresence(open)

  useScrollLock(shown)

  if (!shown) return null

  return (
    <div
      className={`modal-backdrop${entered ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t.walletSetupTitle}
      onTransitionEnd={onExitEnd}
    >
      <div className="modal wallet-setup-modal">
        <div className="wallet-setup-head">
          <div className="modal-title">{t.walletSetupTitle}</div>
          <span className="wallet-help">
            <button type="button" className="wallet-help-btn" aria-label={t.walletHelp}>
              ?
            </button>
            <span className="wallet-help-tip" role="tooltip">
              {t.walletSingleHint}
            </span>
          </span>
        </div>
        <WalletGate onReady={onReady} />
      </div>
    </div>
  )
}
