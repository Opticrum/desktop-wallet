import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from './i18n/LocaleContext'
import { ThemeProvider } from './theme/ThemeContext'
import { NodeProvider } from './node/NodeContext'
import { AppShell } from './layout/AppShell'
import { AppDetail } from './pages/AppDetail'
import { NewsPage } from './pages/NewsPage'
import { ChangelogPage } from './pages/ChangelogPage'
import { NodeDetail } from './pages/NodeDetail'
import { LiquidityMarket } from './pages/LiquidityMarket'

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <NodeProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                {/* Landing page is the Node page — the marketplace is disabled. */}
                <Route index element={<Navigate to="/node" replace />} />
                <Route path="apps/:id" element={<AppDetail />} />
                <Route path="news" element={<NewsPage />} />
                <Route path="changelog" element={<ChangelogPage />} />

                <Route path="node" element={<NodeDetail />} />

                <Route path="liquidity" element={<LiquidityMarket />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </NodeProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
