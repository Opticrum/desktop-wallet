import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { CopyableText } from './CopyableText'
import { useLocale } from '../i18n/LocaleContext'
import { peers } from '../mock/node'

type Props = {
  onToast: (msg: string) => void
}

function latencyClass(ms: number, status: string) {
  if (status !== 'connected') return 'latency-off'
  if (ms < 60) return 'latency-ok'
  if (ms < 150) return 'latency-warn'
  return 'latency-slow'
}

export function NodePeerSection({ onToast }: Props) {
  const { t } = useLocale()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const totalLatency = peers.reduce((sum, p) => sum + p.latencyMs, 0)
  const avgLatency = Math.round(totalLatency / Math.max(peers.length, 1))

  return (
    <>
      <div className="section-head toolbar" style={{ marginTop: 0 }}>
        <span className="text-tertiary" style={{ fontWeight: 500, fontSize: 13 }}>
          {t.averageLatency} {avgLatency} ms
        </span>
        <div className="toolbar-actions">
          <button
            className={createOpen ? 'btn-secondary' : 'btn-primary'}
            onClick={() => setCreateOpen((o) => !o)}
          >
            {createOpen ? t.nodeFormCancel : `+ ${t.nodeNewPeer}`}
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
            <label className="form-label">{t.nodeFormPeerAddr}</label>
            <input
              className="form-input"
              placeholder="/ip4/1.2.3.4/tcp/8115"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
            />
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
              <th>{t.peerList}</th>
              <th>{t.peerAddr}</th>
              <th>{t.latency}</th>
              <th className="row-action" aria-label={t.nodeRemovePeer} />
            </tr>
          </thead>
          <tbody>
            {peers.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="peer-name-cell">
                    <span className={`peer-dot ${p.status}`} />
                    <span className="peer-alias">{p.alias}</span>
                  </div>
                </td>
                <td className="mono text-secondary peer-addr-cell">
                  <CopyableText value={p.addr} />
                </td>
                <td className={`peer-latency ${latencyClass(p.latencyMs, p.status)}`}>
                  {p.status === 'connected' ? `${p.latencyMs} ms` : '—'}
                </td>
                <td className="row-action">
                  <button
                    className="row-action-btn"
                    onClick={() => setPendingDeleteId(p.id)}
                    aria-label={t.nodeRemovePeer}
                    title={t.nodeRemovePeer}
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
        body={t.nodeConfirmDeletePeerBody}
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
