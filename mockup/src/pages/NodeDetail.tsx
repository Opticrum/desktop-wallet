import { useState } from 'react'
import { NodeChannelSection } from '../components/NodeChannelSection'
import { NodeControlPanel } from '../components/NodeControlPanel'
import { NodeNetworkSidebar } from '../components/NodeNetworkSidebar'
import { NodePeerSection } from '../components/NodePeerSection'
import { Toast } from '../components/Toast'
import { useLocale } from '../i18n/LocaleContext'
import { channels } from '../mock/channels'
import { peers } from '../mock/node'

type NodeTab = 'channels' | 'peers'

export function NodeDetail() {
  const { t } = useLocale()
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<NodeTab>('channels')

  return (
    <div className="page-wide">
      <div className="node-layout">
        <div className="node-main">
          <NodeControlPanel onToast={setToast} />

          {/* Tab switcher */}
          <div className="node-tabs" role="tablist">
            <button
              role="tab"
              className={`node-tab${tab === 'channels' ? ' active' : ''}`}
              aria-selected={tab === 'channels'}
              onClick={() => setTab('channels')}
            >
              {t.nodeChannelsSection}
              <span className="node-tab-count">{channels.length}</span>
            </button>
            <button
              role="tab"
              className={`node-tab${tab === 'peers' ? ' active' : ''}`}
              aria-selected={tab === 'peers'}
              onClick={() => setTab('peers')}
            >
              {t.nodePeersSection}
              <span className="node-tab-count">{peers.length}</span>
            </button>
          </div>

          {/* Tab content */}
          {tab === 'channels' ? (
            <NodeChannelSection onToast={setToast} />
          ) : (
            <NodePeerSection onToast={setToast} />
          )}
        </div>

        <NodeNetworkSidebar />
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
