import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'

export function AppShell() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="center-panel">
        <Outlet />
      </main>
    </div>
  )
}
