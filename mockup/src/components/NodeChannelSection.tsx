import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { useLocale } from '../i18n/LocaleContext'
import { channels } from '../mock/channels'

type Props = {
  onToast: (msg: string) => void
}

function stateLabel(state: string) {
  switch (state) {
    case 'active':  return 'active'
    case 'pending': return 'pending'
    case 'closing': return 'closing'
    default:        return state
  }
}

export function NodeChannelSection({ onToast }: Props) {
  const { t } = useLocale()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const totalCapacity = channels.reduce((sum, ch) => sum + ch.capacityCkb, 0)

  return (
    <>
      <div className="section-head toolbar" style={{ marginTop: 0 }}>
        <span className="text-tertiary" style={{ fontWeight: 500, fontSize: 13 }}>
          {t.capacity} {totalCapacity.toLocaleString()} CKB
        </span>
        <div className="toolbar-actions">
          <button
            className={createOpen ? 'btn-secondary' : 'btn-primary'}
            onClick={() => setCreateOpen((o) => !o)}
          >
            {createOpen ? t.nodeFormCancel : `+ ${t.nodeNewChannel}`}
          </button>
        </div>
      </div>

      {createOpen && (
        <div className="panel inline-form">
          <div className="form-row">
            <label className="form-label">{t.nodeFormPeerAlias}</label>
            <input className="form-input" placeholder="merchant-node" />
          </div>
          <div className="form-row">
            <label className="form-label">{t.nodeFormCapacity}</label>
            <input className="form-input" placeholder="1000" inputMode="decimal" />
          </div>
          <div className="form-row">
            <label className="form-label">{t.nodeFormBaseFee}</label>
            <input className="form-input" placeholder="1000" inputMode="numeric" />
          </div>
          <div className="form-row">
            <label className="form-label">{t.nodeFormFeeRate}</label>
            <input className="form-input" placeholder="100" inputMode="numeric" />
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setCreateOpen(false)}>
              {t.nodeFormCancel}
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setCreateOpen(false)
                onToast(t.nodeCreateToast)
              }}
            >
              {t.nodeFormCreate}
            </button>
          </div>
        </div>
      )}

      <div className="panel panel-flush">
        <table className="data-table data-table-sm">
          <thead>
            <tr>
              <th>{t.peer}</th>
              <th>{t.capacity}</th>
              <th>{t.local}</th>
              <th>{t.remote}</th>
              <th>{t.state}</th>
              <th className="row-action" aria-label={t.nodeCloseChannel} />
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => {
              const localPct = ch.capacityCkb > 0 ? Math.round((ch.localBalanceCkb / ch.capacityCkb) * 100) : 0
              const remotePct = 100 - localPct

              return (
                <tr key={ch.id}>
                  <td>
                    <div className="ch-peer-name">{ch.peerAlias}</div>
                    <div className="ch-peer-key">{ch.peerPubkeyShort}</div>
                  </td>
                  <td className="ch-capacity-cell">
                    <div className="ch-capacity-val">{ch.capacityCkb.toLocaleString()} CKB</div>
                    <div className="ch-capacity-bar">
                      <div className="ch-capacity-bar-local" style={{ width: `${localPct}%` }} />
                      <div className="ch-capacity-bar-remote" style={{ width: `${remotePct}%` }} />
                    </div>
                  </td>
                  <td className="ch-balance-local">{ch.localBalanceCkb.toLocaleString()} CKB</td>
                  <td>{ch.remoteBalanceCkb.toLocaleString()} CKB</td>
                  <td>
                    <span className={`badge ${ch.state}`}>{stateLabel(ch.state)}</span>
                  </td>
                  <td className="row-action">
                    <button
                      className="row-action-btn"
                      onClick={() => setPendingDeleteId(ch.id)}
                      aria-label={t.nodeCloseChannel}
                      title={t.nodeCloseChannel}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={!!pendingDeleteId}
        title={t.nodeConfirmDeleteTitle}
        body={t.nodeConfirmDeleteChannelBody}
        confirmLabel={t.nodeDeleteConfirm}
        cancelLabel={t.nodeDeleteCancel}
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          setPendingDeleteId(null)
          onToast(t.nodeDeleteToast)
        }}
      />
    </>
  )
}
