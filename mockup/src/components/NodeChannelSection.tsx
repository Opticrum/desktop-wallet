import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { useLocale } from '../i18n/LocaleContext'
import { channels } from '../mock/channels'

type Props = {
  onToast: (msg: string) => void
}

export function NodeChannelSection({ onToast }: Props) {
  const { t } = useLocale()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  return (
    <>
      <div className="section-head toolbar">
        <h2>
          {t.nodeChannelsSection}{' '}
          <span className="text-tertiary" style={{ fontWeight: 500, fontSize: 13 }}>
            · {channels.length} {t.nodeChannelCount}
          </span>
        </h2>
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
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.peer}</th>
              <th className="num">{t.capacity}</th>
              <th className="num">{t.local}</th>
              <th className="num">{t.remote}</th>
              <th>{t.state}</th>
              <th>{t.fees}</th>
              <th className="row-action" aria-label={t.nodeCloseChannel} />
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{ch.peerAlias}</div>
                  <div className="mono text-tertiary" style={{ fontSize: 11 }}>
                    {ch.peerPubkeyShort}
                  </div>
                </td>
                <td className="num">{ch.capacityCkb.toLocaleString()}</td>
                <td className="num">{ch.localBalanceCkb.toLocaleString()}</td>
                <td className="num">{ch.remoteBalanceCkb.toLocaleString()}</td>
                <td>
                  <span className={`badge ${ch.state}`}>{ch.state}</span>
                </td>
                <td className="text-secondary">
                  {ch.baseFeeMshannons} / {ch.feeRatePpm} ppm
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
            ))}
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