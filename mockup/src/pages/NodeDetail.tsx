import { useCallback, useState } from 'react'
import { NodeConnectionsSection } from '../components/NodeConnectionsSection'
import { NodeControlPanel } from '../components/NodeControlPanel'
import { NodeNetworkSidebar } from '../components/NodeNetworkSidebar'
import { Toast } from '../components/Toast'

export function NodeDetail() {
  const [toast, setToast] = useState<string | null>(null)
  // Set when a top hub's "connect" is clicked in the sidebar — the connections
  // section opens its new-connection form and pre-fills these values.
  const [connectRequest, setConnectRequest] = useState<{ alias: string; addr: string } | null>(null)
  const clearConnectRequest = useCallback(() => setConnectRequest(null), [])

  return (
    <div className="page-wide">
      <div className="node-layout">
        <div className="node-main">
          <NodeControlPanel onToast={setToast} />
          <NodeConnectionsSection
            onToast={setToast}
            connectRequest={connectRequest}
            onConnectHandled={clearConnectRequest}
          />
        </div>

        <NodeNetworkSidebar onConnectNode={(alias, addr) => setConnectRequest({ alias, addr })} />
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
