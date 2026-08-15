import { useEffect, useState } from 'react'
import { NodeConnectionsSection } from '../components/NodeConnectionsSection'
import { NodeControlPanel } from '../components/NodeControlPanel'
import { NodeKpiGrid } from '../components/NodeKpiGrid'
import { NodeLogsConsole } from '../components/NodeLogsConsole'
import { WalletModule } from '../components/WalletModule'
import { WalletSetupDialog } from '../components/WalletSetupDialog'
import { Toast } from '../components/Toast'
import { wallet } from '../api/client'

export function NodeDetail() {
  const [toast, setToast] = useState<string | null>(null)
  // Bumped to remount WalletModule (immediate refresh) once a wallet exists.
  const [walletEpoch, setWalletEpoch] = useState(0)
  // Bumped by the connections toolbar's refresh button to re-fetch the
  // node-overview runtime (pubkey/address/status) as well.
  const [overviewEpoch, setOverviewEpoch] = useState(0)
  const [noWallet, setNoWallet] = useState(false)

  // The node page owns the wallet gate: while no CKB wallet exists, a
  // non-dismissable creation dialog blocks the page (Fiber links one wallet).
  useEffect(() => {
    let alive = true
    const check = () =>
      wallet
        .getSummary()
        .then((s) => {
          if (alive) setNoWallet(!s.hasWallet)
        })
        .catch(() => {})
    check()
    const id = window.setInterval(check, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const handleWalletReady = () => {
    setNoWallet(false)
    setWalletEpoch((n) => n + 1)
  }

  return (
    <div className="page-wide">
      <div className="node-layout">
        <div className="node-main">
          <NodeControlPanel onToast={setToast} refreshKey={overviewEpoch} />
          <NodeLogsConsole />
          <NodeConnectionsSection
            onToast={setToast}
            onRefresh={() => {
              // The toolbar refresh re-fetches the node overview AND remounts
              // the wallet module so its balance/history refresh too.
              setOverviewEpoch((n) => n + 1)
              setWalletEpoch((n) => n + 1)
            }}
          />
        </div>

        <aside className="node-aside">
          <NodeKpiGrid refreshKey={overviewEpoch} onToast={setToast} />
          {/* refreshKey re-fetches without unmounting — keeps the content visible
              and shows the refreshing veil instead of clearing. */}
          <WalletModule refreshKey={walletEpoch} />
        </aside>
      </div>

      <WalletSetupDialog open={noWallet} onReady={handleWalletReady} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
