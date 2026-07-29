import { useState } from 'react'
import { NodeChannelSection } from '../components/NodeChannelSection'
import { NodeControlPanel } from '../components/NodeControlPanel'
import { NodeNetworkSidebar } from '../components/NodeNetworkSidebar'
import { NodePeerSection } from '../components/NodePeerSection'
import { Toast } from '../components/Toast'

export function NodeDetail() {
  const [toast, setToast] = useState<string | null>(null)

  return (
    <div className="page-wide">
      <div className="node-layout">
        <div className="node-main">
          <NodeControlPanel onToast={setToast} />

          <NodeChannelSection onToast={setToast} />
          <NodePeerSection onToast={setToast} />
        </div>

        <NodeNetworkSidebar />
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}