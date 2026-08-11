import { useState } from 'react'
import { NodeConnectionsSection } from '../components/NodeConnectionsSection'
import { NodeControlPanel } from '../components/NodeControlPanel'
import { NodeKpiGrid } from '../components/NodeKpiGrid'
import { NodeLogsConsole } from '../components/NodeLogsConsole'
import { WalletModule } from '../components/WalletModule'
import { Toast } from '../components/Toast'

export function NodeDetail() {
  const [toast, setToast] = useState<string | null>(null)

  return (
    <div className="page-wide">
      <div className="node-layout">
        <div className="node-main">
          <NodeControlPanel onToast={setToast} />
          <NodeLogsConsole />
          <NodeConnectionsSection onToast={setToast} />
        </div>

        <aside className="node-aside">
          <NodeKpiGrid />
          <WalletModule />
        </aside>
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
