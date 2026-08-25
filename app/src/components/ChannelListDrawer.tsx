import { useEffect, useState, type ReactNode } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import type { ChannelNode } from '../api/types'
import { CopyableText } from './CopyableText'
import { BottomDrawer } from './BottomDrawer'

const round1 = (n: number) => Math.round(n * 10) / 10

const DEFAULT_CAPACITY = '1000'
const DEFAULT_BASE_FEE = '1000'
const DEFAULT_FEE_RATE = '100'

type Props = {
  open: boolean
  frozen?: boolean
  node: ChannelNode | null
  /** When false, Escape does not dismiss — used while a nested confirm is open. */
  dismissible?: boolean
  onClose: () => void
  onCreate: (capacity: string, baseFee: string, feeRate: string) => void
  children: ReactNode
}

/** Right-side column listing a peer's channel cards, headed by a compact node identity. */
export function ChannelListDrawer({
  open,
  frozen,
  node,
  dismissible = true,
  onClose,
  onCreate,
  children,
}: Props) {
  const { t } = useLocale()
  const outbound = node?.channels.reduce((sum, c) => sum + c.localBalanceCkb, 0) ?? 0
  const inbound = node?.channels.reduce((sum, c) => sum + c.remoteBalanceCkb, 0) ?? 0

  const [formOpen, setFormOpen] = useState(false)
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY)
  const [baseFee, setBaseFee] = useState(DEFAULT_BASE_FEE)
  const [feeRate, setFeeRate] = useState(DEFAULT_FEE_RATE)

  useEffect(() => {
    if (!open) {
      setFormOpen(false)
      return
    }
    setCapacity(DEFAULT_CAPACITY)
    setBaseFee(DEFAULT_BASE_FEE)
    setFeeRate(DEFAULT_FEE_RATE)
  }, [open, node?.peer.id])

  useEffect(() => {
    if (!formOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setFormOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [formOpen])

  const openForm = () => {
    setCapacity(DEFAULT_CAPACITY)
    setBaseFee(DEFAULT_BASE_FEE)
    setFeeRate(DEFAULT_FEE_RATE)
    setFormOpen(true)
  }

  return (
    <BottomDrawer
      open={open}
      onClose={onClose}
      ariaLabel={t.nodeChannelListTitle}
      side="right"
      dismissible={dismissible && !formOpen}
    >
      <div className="conn-channel-drawer">
        <header className="conn-channel-drawer-head">
          <div className="conn-channel-drawer-id">
            {node ? (
              <>
                <div className="conn-channel-drawer-id-row">
                  <CopyableText value={node.peer.id} className="mono" />
                  {node.peer.version ? (
                    <span className="conn-channel-drawer-ver">v{node.peer.version}</span>
                  ) : null}
                </div>
                <div className="conn-channel-drawer-liq">
                  <span>
                    {t.nodeOutbound} {round1(outbound).toLocaleString()}
                  </span>
                  <span>
                    {t.nodeInbound} {round1(inbound).toLocaleString()}
                  </span>
                  <span>{t.unitCkb}</span>
                </div>
              </>
            ) : (
              <span className="conn-channel-drawer-ver">{t.nodeChannelListTitle}</span>
            )}
          </div>
        </header>
        <div className="conn-channel-drawer-body">
          {node && node.channels.length > 0 ? children : null}
          {formOpen ? (
            <form
              className="inline-form conn-channel-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (frozen) return
                setFormOpen(false)
                onCreate(capacity, baseFee, feeRate)
              }}
            >
              <div className="form-row">
                <label className="form-label" htmlFor="channel-open-capacity">
                  {t.nodeFormCapacity}
                </label>
                <input
                  id="channel-open-capacity"
                  className="form-input"
                  placeholder="1000"
                  inputMode="decimal"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-row">
                <div className="form-label-line">
                  <label className="form-label" htmlFor="channel-open-base-fee">
                    {t.nodeFormBaseFee}
                  </label>
                  <span className="field-help">
                    <button type="button" className="field-help-btn" aria-label={t.walletHelp}>
                      ?
                    </button>
                    <span className="field-help-tip" role="tooltip">
                      {t.nodeFormBaseFeeHelp}
                    </span>
                  </span>
                </div>
                <input
                  id="channel-open-base-fee"
                  className="form-input"
                  placeholder="1000"
                  inputMode="numeric"
                  value={baseFee}
                  onChange={(e) => setBaseFee(e.target.value)}
                />
              </div>
              <div className="form-row">
                <div className="form-label-line">
                  <label className="form-label" htmlFor="channel-open-fee-rate">
                    {t.nodeFormFeeRate}
                  </label>
                  <span className="field-help">
                    <button type="button" className="field-help-btn" aria-label={t.walletHelp}>
                      ?
                    </button>
                    <span className="field-help-tip" role="tooltip">
                      {t.nodeFormFeeRateHelp}
                    </span>
                  </span>
                </div>
                <input
                  id="channel-open-fee-rate"
                  className="form-input"
                  placeholder="100"
                  inputMode="numeric"
                  value={feeRate}
                  onChange={(e) => setFeeRate(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
                  {t.nodeFormCancel}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={frozen}
                  title={frozen ? t.connFrozen : undefined}
                >
                  {t.nodeFormCreate}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="conn-channel-drawer-new"
              onClick={openForm}
              disabled={frozen}
              title={frozen ? t.connFrozen : undefined}
            >
              + {t.nodeNewChannel}
            </button>
          )}
        </div>
      </div>
    </BottomDrawer>
  )
}
