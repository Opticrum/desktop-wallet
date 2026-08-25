import { useCallback, useEffect, useState } from 'react'
import { node, wallet } from '../api/client'
import { toCommandError } from '../api/types'
import type { ExternalTarget, NodeTargetList } from '../api/types'
import { useLocale } from '../i18n/LocaleContext'
import { commandErrorText } from '../lib/errors'
import { useNode } from '../node/NodeContext'
import { ConfirmModal } from './ConfirmModal'

type DialogState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; target: ExternalTarget }

type Props = {
  onWallet: () => void
  onToast: (msg: string) => void
  /** Bumped by the control panel's "edit connection" to open the active external. */
  editRequest?: number
  /** Bumped after unlock so the lock/unlock badge updates immediately. */
  walletEpoch?: number
  /** After add / edit / remove so the console's Fiber port row refreshes. */
  onTargetsChanged?: () => void
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconNode() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z" />
      <circle cx="12" cy="12" r="2.2" />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/**
 * Node-page rail: built-in node, user-added external Fiber RPCs, wallet
 * at the bottom. Selecting a node calls `node.set_active` (backend is
 * source of truth).
 */
export function NodeSideMenu({
  onWallet,
  onToast,
  editRequest = 0,
  walletEpoch = 0,
  onTargetsChanged,
}: Props) {
  const { t } = useLocale()
  const { running, starting, kind, targetId, applyRuntime } = useNode()
  const [list, setList] = useState<NodeTargetList | null>(null)
  const [walletUnlocked, setWalletUnlocked] = useState(false)
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' })
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [formAlias, setFormAlias] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formToken, setFormToken] = useState('')
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    node.listTargets().then(setList).catch(() => {})
  }, [])

  useEffect(() => {
    if (!editRequest) return
    const active = list?.externals.find((e) => e.id === list.activeId)
    if (active) openEdit(active)
    // openEdit is local and list is the snapshot we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    let alive = true
    const poll = () =>
      wallet
        .getStatus()
        .then((s) => {
          if (alive) setWalletUnlocked(s.unlocked)
        })
        .catch(() => {})
    poll()
    const id = window.setInterval(poll, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [walletEpoch])

  const select = async (id: string) => {
    if (id === (list?.activeId ?? targetId)) return
    try {
      const rt = await node.setActive(id)
      applyRuntime(rt)
      refresh()
    } catch (e) {
      onToast(commandErrorText(t, toCommandError(e)))
    }
  }

  const openAdd = () => {
    setFormAlias('')
    setFormUrl('')
    setFormToken('')
    setFormError(null)
    setDialog({ mode: 'add' })
  }

  const openEdit = (target: ExternalTarget) => {
    setFormAlias(target.alias)
    setFormUrl(target.rpcUrl)
    setFormToken(target.authToken ?? '')
    setFormError(null)
    setDialog({ mode: 'edit', target })
  }

  const submitDialog = async () => {
    if (!formAlias.trim() || !formUrl.trim()) {
      setFormError(t.nodeExternalRpcUrl)
      return
    }
    setFormBusy(true)
    setFormError(null)
    try {
      const token = formToken.trim() || undefined
      if (dialog.mode === 'add') {
        const next = await node.addExternal(formAlias.trim(), formUrl.trim(), token)
        setList(next)
      } else if (dialog.mode === 'edit') {
        const next = await node.updateExternal(
          dialog.target.id,
          formAlias.trim(),
          formUrl.trim(),
          token,
        )
        setList(next)
        if (dialog.target.id === (list?.activeId ?? targetId)) {
          const rt = await node.getRuntime()
          applyRuntime(rt)
        }
      }
      setDialog({ mode: 'closed' })
      onTargetsChanged?.()
    } catch (e) {
      const err = toCommandError(e)
      setFormError(commandErrorText(t, err))
    }
    setFormBusy(false)
  }

  const confirmRemove = async () => {
    if (!removeId) return
    try {
      const next = await node.removeExternal(removeId)
      setList(next)
      const rt = await node.getRuntime()
      applyRuntime(rt)
      onTargetsChanged?.()
    } catch (e) {
      onToast(commandErrorText(t, toCommandError(e)))
    }
    setRemoveId(null)
  }

  const activeId = list?.activeId ?? targetId
  const builtin = list?.builtin
  const externals = list?.externals ?? []
  const builtinSelected = activeId === 'builtin'
  const builtinDot = builtin?.starting
    ? 'starting'
    : builtin?.running
      ? 'on'
      : 'off'

  return (
    <nav className="node-side-menu" aria-label={t.nodeLabel}>
      <div className="nsm-body">
        <button
          type="button"
          className={`nsm-item nsm-builtin${builtinSelected ? ' is-active' : ''}`}
          onClick={() => select('builtin')}
        >
          <span className="nsm-icon-well">
            <IconNode />
          </span>
          <span className="nsm-item-text">
            <span className="nsm-item-title">{t.nodeBuiltin}</span>
            <span className="nsm-item-sub">{builtin?.alias || '—'}</span>
          </span>
          <span className={`nsm-dot ${builtinDot}`} />
        </button>

        <section className="nsm-externals" aria-label={t.nodeExternals}>
          <div className="nsm-externals-head">{t.nodeExternals}</div>
          <div className="nsm-externals-list">
            {externals.map((ext) => {
              const selected = activeId === ext.id
              const live =
                selected && kind === 'external'
                  ? starting
                    ? 'starting'
                    : running
                      ? 'on'
                      : 'off'
                  : 'idle'
              return (
                <div
                  key={ext.id}
                  className={`nsm-row${selected ? ' is-active' : ''}`}
                >
                  <button
                    type="button"
                    className="nsm-item nsm-external"
                    onClick={() => select(ext.id)}
                  >
                    <span className={`nsm-dot ${live}`} />
                    <span className="nsm-item-text">
                      <span className="nsm-item-title">{ext.alias}</span>
                      <span className="nsm-item-sub mono">{ext.rpcUrl}</span>
                    </span>
                  </button>
                  <div className="nsm-row-actions">
                    <button
                      type="button"
                      className="nsm-icon-btn"
                      title={t.nodeEditExternal}
                      aria-label={t.nodeEditExternal}
                      onClick={() => openEdit(ext)}
                    >
                      <IconPencil />
                    </button>
                    <button
                      type="button"
                      className="nsm-icon-btn"
                      title={t.nodeRemoveExternal}
                      aria-label={t.nodeRemoveExternal}
                      onClick={() => setRemoveId(ext.id)}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              )
            })}
            <button type="button" className="nsm-add" onClick={openAdd}>
              <IconPlus />
              <span>{t.nodeAddExternal}</span>
            </button>
          </div>
        </section>
      </div>

      <button
        type="button"
        className={`nsm-wallet${walletUnlocked ? ' is-unlocked' : ' is-locked'}`}
        onClick={onWallet}
        aria-label={`${t.wallet}, ${walletUnlocked ? t.nodeWalletUnlocked : t.nodeWalletLocked}`}
        title={walletUnlocked ? t.nodeWalletUnlocked : t.nodeWalletLocked}
      >
        <span className="nsm-wallet-icon">
          <IconWallet />
        </span>
        <span className="nsm-wallet-text">
          <span className="nsm-item-title">{t.wallet}</span>
          <span className="nsm-item-sub">
            {walletUnlocked ? t.nodeWalletUnlocked : t.nodeWalletLocked}
          </span>
        </span>
        <span className="nsm-wallet-chevron">
          <IconChevron />
        </span>
      </button>

      {dialog.mode !== 'closed' && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={dialog.mode === 'add' ? t.nodeAddExternal : t.nodeEditExternal}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              {dialog.mode === 'add' ? t.nodeAddExternal : t.nodeEditExternal}
            </div>
            <div className="modal-body nsm-form">
              <label className="send-form-label">
                {t.nodeExternalAlias}
                <input
                  className="search-input"
                  value={formAlias}
                  onChange={(e) => setFormAlias(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="send-form-label">
                {t.nodeExternalRpcUrl}
                <input
                  className="search-input"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="127.0.0.1:8227"
                />
              </label>
              <label className="send-form-label">
                {t.nodeExternalToken}
                <input
                  className="search-input"
                  type="password"
                  value={formToken}
                  onChange={(e) => setFormToken(e.target.value)}
                />
                <span className="nsm-form-hint">{t.nodeExternalTokenHint}</span>
              </label>
              {formError && <p className="text-error">{formError}</p>}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={formBusy}
                onClick={() => setDialog({ mode: 'closed' })}
              >
                {t.nodeFormCancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={formBusy}
                onClick={submitDialog}
              >
                {formBusy ? t.nodeExternalBusy : t.nodeExternalSave}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={removeId != null}
        title={t.nodeConfirmRemoveExternalTitle}
        body={t.nodeConfirmRemoveExternalBody}
        confirmLabel={t.nodeRemoveExternal}
        cancelLabel={t.nodeDeleteCancel}
        danger
        onCancel={() => setRemoveId(null)}
        onConfirm={confirmRemove}
      />
    </nav>
  )
}
