import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from './i18n/LocaleContext'
import { ThemeProvider } from './theme/ThemeContext'
import { AppShell } from './layout/AppShell'
import { Home } from './pages/Home'
import { AppDetail } from './pages/AppDetail'
import { NewsPage } from './pages/NewsPage'
import { ChangelogPage } from './pages/ChangelogPage'
import { NodeDetail } from './pages/NodeDetail'
import { NodeLogsPage } from './pages/NodeLogsPage'
import { BalanceDetail } from './pages/BalanceDetail'
import { HdWalletDetail } from './pages/HdWalletDetail'
import { OnChainDetail } from './pages/OnChainDetail'
import { ActivityDetail } from './pages/ActivityDetail'
import { MePage } from './pages/MePage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="apps/:id" element={<AppDetail />} />
              <Route path="news" element={<NewsPage />} />
              <Route path="changelog" element={<ChangelogPage />} />

              <Route path="node" element={<NodeDetail />} />
              <Route path="node/logs" element={<NodeLogsPage />} />

              <Route path="balance" element={<BalanceDetail />} />
              <Route path="wallet/hd" element={<HdWalletDetail />} />
              <Route path="wallet/onchain" element={<OnChainDetail />} />
              <Route path="wallet/activity" element={<ActivityDetail />} />

              <Route path="me" element={<MePage />} />
              <Route path="settings" element={<SettingsPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LocaleProvider>
    </ThemeProvider>
  )
}