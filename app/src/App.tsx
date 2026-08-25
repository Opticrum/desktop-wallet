import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from './i18n/LocaleContext'
import { ThemeProvider } from './theme/ThemeContext'
import { NodeProvider } from './node/NodeContext'
import { AppShell } from './layout/AppShell'
import { AppDetail } from './pages/AppDetail'
import { NewsPage } from './pages/NewsPage'
import { ChangelogPage } from './pages/ChangelogPage'
import { TrayExitHandler } from './components/TrayExitHandler'

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <NodeProvider>
          <TrayExitHandler />
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                {/* Landing page is the Node page — the marketplace is disabled. */}
                <Route index element={<Navigate to="/node" replace />} />
                <Route path="apps/:id" element={<AppDetail />} />
                <Route path="news" element={<NewsPage />} />
                <Route path="changelog" element={<ChangelogPage />} />

                {/* node stays keep-alive in AppShell (no re-fetch on leave) */}
                <Route path="node" element={null} />
                <Route path="liquidity" element={<Navigate to="/node" replace />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </NodeProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
