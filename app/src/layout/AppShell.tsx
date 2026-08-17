import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { NodeDetail } from '../pages/NodeDetail'
import { LiquidityMarket } from '../pages/LiquidityMarket'

export function AppShell() {
  const { pathname } = useLocation()
  const isNode = pathname === '/node'
  const isLiquidity = pathname === '/liquidity'
  // The two primary pages stay mounted (keep-alive) and are toggled by route,
  // so switching between them never re-fetches their data. The lightweight
  // secondary pages (news/changelog/app detail) route normally via <Outlet />.
  return (
    <div className="app-shell">
      <TopBar />
      <main className="center-panel">
        <div className={`app-page${isNode ? ' is-active' : ''}`}>
          <NodeDetail />
        </div>
        <div className={`app-page${isLiquidity ? ' is-active' : ''}`}>
          <LiquidityMarket />
        </div>
        <div className={`app-page${!isNode && !isLiquidity ? ' is-active' : ''}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
