import { useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import { wallet } from '../api/client'
import { toCommandError } from '../api/types'
import { ConfirmModal } from './ConfirmModal'

type WalletGateProps = {
  /** Called once the wallet is available (import done, or mnemonic acknowledged). */
  onReady?: () => void
}

/**
 * The no-wallet gate: create (password only — Fiber links a single CKB
 * wallet, so no address-count input) or import a mnemonic. After a create the
 * mnemonic is shown once for safekeeping; `onReady` fires only when the user
 * acknowledges it, so the mnemonic never flashes away before it can be copied.
 */
export function WalletGate({ onReady }: WalletGateProps) {
  const { t } = useLocale()
  const [pw, setPw] = useState('')
  const [createdMnemonic, setCreatedMnemonic] = useState<string | null>(null)
  const [setupTab, setSetupTab] = useState<'create' | 'import'>('create')
  // 12 mnemonic word inputs — one box per word.
  const [words, setWords] = useState<string[]>(() => Array(12).fill(''))
  const [busy, setBusy] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)
  // Confirmation gate before closing — the mnemonic is shown only once.
  const [confirmOpen, setConfirmOpen] = useState(false)

  const setWord = (i: number, v: string) => {
    setWords((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  const createWallet = async () => {
    if (!pw) {
      setGateError(t.walletPasswordRequired)
      return
    }
    setBusy(true)
    setGateError(null)
    try {
      // Fiber links a single CKB wallet — create with one initial address
      // (more can be derived later).
      const r = await wallet.createHdWallet('wallet', pw, 1)
      setCreatedMnemonic(r.mnemonic)
    } catch (e) {
      setGateError(toCommandError(e).message)
    }
    setBusy(false)
  }

  const importWallet = async () => {
    if (!pw) {
      setGateError(t.walletPasswordRequired)
      return
    }
    if (words.some((w) => !w.trim())) {
      setGateError(t.walletImportFailed)
      return
    }
    setBusy(true)
    setGateError(null)
    try {
      await wallet.importMnemonic(words.map((w) => w.trim()).join(' '), pw, 'wallet')
      onReady?.()
    } catch (e) {
      setGateError(toCommandError(e).message)
    }
    setBusy(false)
  }

  return (
    <>
    <div className="wallet-gate">
      {createdMnemonic ? (
        <div className="wallet-gate-field">
          <label className="send-form-label">{t.walletMnemonic}</label>
          <p className="text-secondary">{t.walletMnemonicHint}</p>
          <div className="mnemonic-chips">
            {createdMnemonic.split(' ').map((word, i) => (
              <span className="mnemonic-chip" key={i}>
                <span className="mnemonic-index">{i + 1}</span>
                <span className="mnemonic-chip-word">{word}</span>
              </span>
            ))}
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigator.clipboard?.writeText(createdMnemonic)}
          >
            {t.copy} {t.walletMnemonic}
          </button>
          <button type="button" className="btn-primary" onClick={() => setConfirmOpen(true)}>
            {t.walletRemembered}
          </button>
        </div>
      ) : (
        <>
          <div className="wallet-gate-tabs">
            <button
              type="button"
              className={`chip${setupTab === 'create' ? ' active' : ''}`}
              onClick={() => setSetupTab('create')}
            >
              {t.walletCreate}
            </button>
            <button
              type="button"
              className={`chip${setupTab === 'import' ? ' active' : ''}`}
              onClick={() => setSetupTab('import')}
            >
              {t.walletImport}
            </button>
          </div>
          <div className="wallet-gate-field">
            <label className="send-form-label">{t.walletPassword}</label>
            <input
              className="search-input"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {setupTab === 'import' && (
            <div className="wallet-gate-field">
              <label className="send-form-label">{t.walletMnemonic}</label>
              <div className="mnemonic-grid">
                {words.map((w, i) => (
                  <label className="mnemonic-cell" key={i}>
                    <span className="mnemonic-index">{i + 1}</span>
                    <input
                      className="mnemonic-input"
                      value={w}
                      onChange={(e) => setWord(i, e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
          {gateError && <p className="text-error">{gateError}</p>}
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={setupTab === 'create' ? createWallet : importWallet}
          >
            {setupTab === 'create' ? t.walletCreateAction : t.walletImportMnemonicAction}
          </button>
        </>
      )}
    </div>
    <ConfirmModal
      open={confirmOpen}
      title={t.walletConfirmTitle}
      body={t.walletConfirmBody}
      confirmLabel={t.walletRemembered}
      cancelLabel={t.walletCancel}
      onConfirm={() => {
        setConfirmOpen(false)
        setCreatedMnemonic(null)
        onReady?.()
      }}
      onCancel={() => setConfirmOpen(false)}
    />
    </>
  )
}
