import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { NodeChannelSection } from '../components/NodeChannelSection'
import { NodeControlPanel } from '../components/NodeControlPanel'
import { NodeNetworkSidebar } from '../components/NodeNetworkSidebar'
import { NodePeerSection } from '../components/NodePeerSection'
import { Toast } from '../components/Toast'
import { useLocale } from '../i18n/LocaleContext'
import { channels } from '../mock/channels'
import { peers } from '../mock/node'

const TABS = ['channels', 'peers'] as const
type NodeTab = (typeof TABS)[number]

export function NodeDetail() {
  const { t, locale } = useLocale()
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<NodeTab>('channels')
  const [createOpen, setCreateOpen] = useState(false)

  const tablistRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef<Record<NodeTab, HTMLButtonElement | null>>({
    channels: null,
    peers: null,
  })
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  // Position the sliding capsule under the active tab. Re-measured whenever
  // the active tab changes or the label copy (zh/en) swaps.
  const measure = useCallback(() => {
    const tablist = tablistRef.current
    const btn = tabButtonRefs.current[tab]
    if (!tablist || !btn) return
    const tablistRect = tablist.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    setIndicator({ left: btnRect.left - tablistRect.left, width: btnRect.width })
  }, [tab])

  useLayoutEffect(() => {
    measure()
  }, [measure, locale])

  useEffect(() => {
    const reMeasure = () => measure()
    document.fonts?.ready.then(reMeasure).catch(() => {})
    window.addEventListener('resize', reMeasure)
    return () => window.removeEventListener('resize', reMeasure)
  }, [measure])

  const selectTab = (next: NodeTab) => {
    if (next === tab) return
    setCreateOpen(false)
    setTab(next)
  }

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: NodeTab) => {
    const idx = TABS.indexOf(current)
    const nextIdx =
      e.key === 'ArrowRight'
        ? (idx + 1) % TABS.length
        : e.key === 'ArrowLeft'
          ? (idx - 1 + TABS.length) % TABS.length
          : null
    if (nextIdx === null) return
    e.preventDefault()
    selectTab(TABS[nextIdx])
    tabButtonRefs.current[TABS[nextIdx]]?.focus()
  }

  return (
    <div className="page-wide">
      <div className="node-layout">
        <div className="node-main">
          <NodeControlPanel onToast={setToast} />

          {/* Unified toolbar: tab capsule + create action */}
          <div className="node-tabbar">
            <div className="node-tabs" role="tablist" ref={tablistRef} aria-label={t.nodeTabsLabel}>
              {TABS.map((key) => {
                const active = tab === key
                const label = key === 'channels' ? t.nodeChannelsSection : t.nodePeersSection
                const count = key === 'channels' ? channels.length : peers.length
                return (
                  <button
                    key={key}
                    ref={(el) => {
                      tabButtonRefs.current[key] = el
                    }}
                    type="button"
                    role="tab"
                    id={`node-tab-${key}`}
                    className={`node-tab${active ? ' active' : ''}`}
                    aria-selected={active}
                    aria-controls="node-tab-panel"
                    tabIndex={active ? 0 : -1}
                    onClick={() => selectTab(key)}
                    onKeyDown={(e) => handleTabKeyDown(e, key)}
                  >
                    {label}
                    <span className="node-tab-count">{count}</span>
                  </button>
                )
              })}
              <span
                className="node-tab-indicator"
                aria-hidden="true"
                style={indicator ? { left: indicator.left, width: indicator.width } : undefined}
              />
            </div>

            <button
              type="button"
              className={`node-tabbar-action${createOpen ? ' btn-secondary' : ' btn-primary'}`}
              aria-expanded={createOpen}
              onClick={() => setCreateOpen((o) => !o)}
            >
              {createOpen ? t.nodeFormCancel : `+ ${tab === 'channels' ? t.nodeNewChannel : t.nodeNewConnection}`}
            </button>
          </div>

          {/* Tab content */}
          <div
            id="node-tab-panel"
            role="tabpanel"
            aria-labelledby={`node-tab-${tab}`}
            className="node-tab-panel"
          >
            {tab === 'channels' ? (
              <NodeChannelSection
                onToast={setToast}
                createOpen={createOpen}
                onCreateToggle={() => setCreateOpen((o) => !o)}
              />
            ) : (
              <NodePeerSection
                onToast={setToast}
                createOpen={createOpen}
                onCreateToggle={() => setCreateOpen((o) => !o)}
              />
            )}
          </div>
        </div>

        <NodeNetworkSidebar />
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
