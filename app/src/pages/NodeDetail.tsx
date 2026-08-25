import { useEffect, useState } from 'react'
import { NodeConnectionsSection } from '../components/NodeConnectionsSection'
import { NodeControlPanel } from '../components/NodeControlPanel'
import { NodeKpiGrid } from '../components/NodeKpiGrid'
import { NodeLogsConsole } from '../components/NodeLogsConsole'
import { NodeLiquidityPanel } from '../components/NodeLiquidityPanel'
import { NodeSideMenu } from '../components/NodeSideMenu'
import { WalletModule } from '../components/WalletModule'
import { WalletUnlockDialog } from '../components/WalletUnlockDialog'
import { WalletSetupDialog } from '../components/WalletSetupDialog'
import { BottomDrawer } from '../components/BottomDrawer'
import { Toast } from '../components/Toast'
import { wallet } from '../api/client'
import { useLocale } from '../i18n/LocaleContext'
import { useNode } from '../node/NodeContext'

type SectionTab = 'nodes' | 'liquidity'

function IconTabNodes() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function IconTabLiquidity() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <rect x="5" y="16" width="14" height="4" rx="1.5" />
    </svg>
  )
}

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
  const [pageTab, setPageTab] = useState<SectionTab>('nodes')

  useEffect(() => {
    let alive = true
    const check = () =>
      wallet
        .getStatus()
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
        onTargetsChanged={() => setOverviewEpoch((n) => n + 1)}
      />
      <div className="node-content">
        <div className="node-content-inner">
          <div className="node-overview-row">
            <NodeControlPanel
              onToast={setToast}
              refreshKey={overviewEpoch}
              onRequestWallet={requestWallet}
              onEditConnection={() => setEditRequest((n) => n + 1)}
            />
            <NodeKpiGrid refreshKey={overviewEpoch} onToast={setToast} />
          </div>
          {kind === 'builtin' && <NodeLogsConsole />}
          <div className="node-section-block">
            <div
              className="node-section-tabs"
              role="tablist"
              aria-label={`${t.nodeListTab} / ${t.liquidityMarket}`}
            >
              <button
                type="button"
                role="tab"
                id="node-section-tab-nodes"
                aria-selected={pageTab === 'nodes'}
                aria-controls="node-section-nodes"
                className={`node-section-tab${pageTab === 'nodes' ? ' is-active' : ''}`}
                onClick={() => setPageTab('nodes')}
              >
                <IconTabNodes />
                {t.nodeListTab}
              </button>
              <button
                type="button"
                role="tab"
                id="node-section-tab-liquidity"
                aria-selected={pageTab === 'liquidity'}
                aria-controls="node-section-liquidity"
                className={`node-section-tab${pageTab === 'liquidity' ? ' is-active' : ''}`}
                onClick={() => setPageTab('liquidity')}
              >
                <IconTabLiquidity />
                {t.liquidityMarket}
              </button>
            </div>
            <div
              id="node-section-nodes"
              role="tabpanel"
              aria-labelledby="node-section-tab-nodes"
              className={`node-section-pane${pageTab === 'nodes' ? ' is-active' : ''}`}
            >
              <NodeConnectionsSection
                onToast={setToast}
                onRefresh={() => {
                  setOverviewEpoch((n) => n + 1)
                  setWalletEpoch((n) => n + 1)
                }}
              />
            </div>
            <div
              id="node-section-liquidity"
              role="tabpanel"
              aria-labelledby="node-section-tab-liquidity"
              className={`node-section-pane${pageTab === 'liquidity' ? ' is-active' : ''}`}
            >
              <NodeLiquidityPanel visible={pageTab === 'liquidity' && !walletOpen} />
            </div>
          </div>
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
