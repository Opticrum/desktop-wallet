import { useEffect, useState } from 'react'
import { NodeConnectionsSection } from '../components/NodeConnectionsSection'
import { NodeControlPanel } from '../components/NodeControlPanel'
import { NodeKpiGrid } from '../components/NodeKpiGrid'
import { NodeLogsConsole } from '../components/NodeLogsConsole'
import { NodeSideMenu } from '../components/NodeSideMenu'
import { WalletModule } from '../components/WalletModule'
import { WalletUnlockDialog } from '../components/WalletUnlockDialog'
import { WalletSetupDialog } from '../components/WalletSetupDialog'
import { BottomDrawer } from '../components/BottomDrawer'
import { Toast } from '../components/Toast'
import { wallet } from '../api/client'
import { useLocale } from '../i18n/LocaleContext'
import { useNode } from '../node/NodeContext'

export function NodeDetail() {
  const { t } = useLocale()
  const { kind, targetId } = useNode()
  const [toast, setToast] = useState<string | null>(null)
  const [walletEpoch, setWalletEpoch] = useState(0)
  const [overviewEpoch, setOverviewEpoch] = useState(0)
  const [noWallet, setNoWallet] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [editRequest, setEditRequest] = useState(0)

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

  useEffect(() => {
    setOverviewEpoch((n) => n + 1)
  }, [targetId])

  const handleWalletReady = () => {
    setNoWallet(false)
    setWalletEpoch((n) => n + 1)
  }

  const requestWallet = async () => {
    try {
      const s = await wallet.getStatus()
      if (!s.hasWallet) return
      if (!s.unlocked) {
        setUnlockOpen(true)
        return
      }
      setWalletOpen(true)
    } catch {
      setUnlockOpen(true)
    }
  }

  return (
    <div className="node-frames">
      <NodeSideMenu
        onWallet={requestWallet}
        onToast={setToast}
        editRequest={editRequest}
        walletEpoch={walletEpoch}
      />
      <div className="node-content">
        <div className="node-content-inner">
          <NodeControlPanel
            onToast={setToast}
            refreshKey={overviewEpoch}
            onRequestWallet={requestWallet}
            onEditConnection={() => setEditRequest((n) => n + 1)}
          />
          <NodeKpiGrid refreshKey={overviewEpoch} onToast={setToast} />
          {kind === 'builtin' && <NodeLogsConsole />}
          <NodeConnectionsSection
            onToast={setToast}
            onRefresh={() => {
              setOverviewEpoch((n) => n + 1)
              setWalletEpoch((n) => n + 1)
            }}
          />
        </div>
      </div>

      <BottomDrawer
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        ariaLabel={t.walletCkb}
        wide
      >
        <WalletModule refreshKey={walletEpoch} />
      </BottomDrawer>

      <WalletUnlockDialog
        open={unlockOpen}
        onCancel={() => setUnlockOpen(false)}
        onUnlocked={() => {
          setUnlockOpen(false)
          setWalletEpoch((n) => n + 1)
          setOverviewEpoch((n) => n + 1)
          setWalletOpen(true)
        }}
      />
      <WalletSetupDialog open={noWallet} onReady={handleWalletReady} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
