import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { NodeDetail } from '../pages/NodeDetail'

export function AppShell() {
  const { pathname } = useLocation()
  const isNode = pathname === '/node'
  // The node page stays mounted (keep-alive) and is toggled by route so
  // leaving for a secondary page never re-fetches node/liquidity data.
  // Lightweight secondary pages (news/changelog/app detail) use <Outlet />.
  return (
    <div className="app-shell">
      <TopBar />
      <main className={`center-panel${isNode ? ' is-node' : ''}`}>
        <div className={`app-page${isNode ? ' is-active is-node' : ''}`}>
          <NodeDetail />
        </div>
        <div className={`app-page${!isNode ? ' is-active' : ''}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
