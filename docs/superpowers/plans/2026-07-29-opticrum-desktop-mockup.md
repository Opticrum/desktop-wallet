# Opticrum Desktop Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static three-column Opticrum Desktop wallet UI under `mockup/` with realistic fake data, dual theme, zh/en toggle, and a center app marketplace.

**Architecture:** Thin Vite + React + TypeScript SPA. `AppShell` keeps left/right sidebars; `react-router` swaps only the center `<Outlet />`. Theme via `data-theme` + CSS variables; i18n via a small dictionary context. All content from `src/mock/*.ts`. Prefer page polish over abstractions.

**Tech Stack:** Vite, React 18, TypeScript, react-router-dom v6, plain CSS. No UI kit, no i18n framework, no state library.

**Spec:** [`docs/superpowers/specs/2026-07-29-opticrum-desktop-mockup-design.md`](../specs/2026-07-29-opticrum-desktop-mockup-design.md)

**Verification style:** No unit-test suite for this mockup (YAGNI / thin scaffolding). Each task ends with `npm run build` and a short `npm run dev` visual check. Commits only if the user asks.

---

## File map

| Path | Responsibility |
|---|---|
| `mockup/package.json` | deps + scripts |
| `mockup/vite.config.ts` | Vite defaults |
| `mockup/tsconfig.json` / `tsconfig.app.json` | TS |
| `mockup/index.html` | mount point |
| `mockup/src/main.tsx` | bootstrap |
| `mockup/src/App.tsx` | providers + routes |
| `mockup/src/styles/tokens.css` | light/dark CSS variables |
| `mockup/src/styles/app.css` | shell + page layout |
| `mockup/src/i18n/types.ts` | `Locale`, message key types |
| `mockup/src/i18n/zh.ts` / `en.ts` | dictionaries |
| `mockup/src/i18n/LocaleContext.tsx` | provider + `useT()` |
| `mockup/src/theme/ThemeContext.tsx` | dark/light + `localStorage` |
| `mockup/src/mock/*.ts` | fake data |
| `mockup/src/layout/AppShell.tsx` | three columns |
| `mockup/src/layout/LeftSidebar.tsx` | logo, cards, theme\|lang row |
| `mockup/src/layout/RightSidebar.tsx` | network / news / changelog |
| `mockup/src/pages/Home.tsx` | banner + marketplace |
| `mockup/src/pages/BalanceDetail.tsx` | balance detail |
| `mockup/src/pages/ChannelsDetail.tsx` | channels table |
| `mockup/src/pages/NodeDetail.tsx` | peers + logs |
| `mockup/src/pages/AppDetail.tsx` | single app |
| `mockup/src/components/Banner.tsx` | autoplay carousel |
| `mockup/src/components/AppGrid.tsx` | search + categories + cards |
| `mockup/src/components/BackLink.tsx` | center-panel back control |

---

### Task 1: Scaffold Vite React TS in `mockup/`

**Files:**
- Create: `mockup/package.json`, `mockup/vite.config.ts`, `mockup/tsconfig.json`, `mockup/tsconfig.app.json`, `mockup/tsconfig.node.json`, `mockup/index.html`, `mockup/src/main.tsx`, `mockup/src/vite-env.d.ts`, `mockup/.gitignore`

- [ ] **Step 1: Create project files**

`mockup/package.json`:
```json
{
  "name": "opticrum-desktop-mockup",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.6.3",
    "vite": "^5.4.11"
  }
}
```

`mockup/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

`mockup/index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Opticrum Desktop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`mockup/tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`mockup/tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

`mockup/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

`mockup/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`mockup/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Temporary stub `mockup/src/App.tsx` (replaced in Task 4):
```tsx
export default function App() {
  return <div style={{ padding: 24 }}>Opticrum Desktop</div>
}
```

Temporary stubs so CSS imports resolve:
```css
/* mockup/src/styles/tokens.css — filled in Task 2 */
```
```css
/* mockup/src/styles/app.css — filled in Task 2 */
```

`mockup/.gitignore`:
```
node_modules
dist
.DS_Store
*.local
```

- [ ] **Step 2: Install and verify build**

```bash
cd /Users/vimchain/Freelancer/fiber/opticrum-wallet/mockup
npm install
npm run build
```

Expected: build succeeds with no TS errors.

---

### Task 2: Design tokens, theme context, i18n context

**Files:**
- Create: `mockup/src/styles/tokens.css`, `mockup/src/styles/app.css`, `mockup/src/theme/ThemeContext.tsx`, `mockup/src/i18n/types.ts`, `mockup/src/i18n/zh.ts`, `mockup/src/i18n/en.ts`, `mockup/src/i18n/LocaleContext.tsx`
- Modify: `mockup/src/App.tsx` (wrap providers only; routes come in Task 4)

- [ ] **Step 1: Write `tokens.css`**

```css
:root,
[data-theme='light'] {
  --bg: #f4f6f8;
  --bg-elevated: #ffffff;
  --bg-muted: #eef1f5;
  --border: #e2e8f0;
  --text: #0f172a;
  --text-secondary: #64748b;
  --accent: #0f766e;
  --accent-soft: #ccfbf1;
  --success: #059669;
  --danger: #dc2626;
  --shadow: 0 1px 2px rgb(15 23 42 / 6%);
  --radius: 12px;
  --font: "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif;
}

[data-theme='dark'] {
  --bg: #0b0f14;
  --bg-elevated: #121821;
  --bg-muted: #0f141c;
  --border: #1e2a38;
  --text: #f1f5f9;
  --text-secondary: #94a3b8;
  --accent: #2dd4bf;
  --accent-soft: #134e4a;
  --success: #34d399;
  --danger: #f87171;
  --shadow: 0 1px 2px rgb(0 0 0 / 40%);
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }
button { font: inherit; cursor: pointer; }
```

- [ ] **Step 2: Write `ThemeContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

type ThemeCtx = { theme: Theme; toggleTheme: () => void }

const ThemeContext = createContext<ThemeCtx | null>(null)
const KEY = 'opticrum-theme'

function readTheme(): Theme {
  const saved = localStorage.getItem(KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  const value = useMemo(
    () => ({ theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme outside ThemeProvider')
  return ctx
}
```

- [ ] **Step 3: Write i18n dictionaries and context**

`mockup/src/i18n/types.ts`:
```ts
export type Locale = 'zh' | 'en'

export type Messages = {
  brand: string
  brandSub: string
  balance: string
  balanceHint: string
  available: string
  locked: string
  nodeChannels: string
  nodeOnline: string
  nodeOffline: string
  channelsActive: string
  localCapacity: string
  nodeRuntime: string
  peers: string
  synced: string
  theme: string
  themeDark: string
  themeLight: string
  language: string
  back: string
  marketplace: string
  searchApps: string
  allCategories: string
  networkOverview: string
  networkNodes: string
  networkChannels: string
  networkCapacity: string
  settlements24h: string
  news: string
  changelog: string
  recentTxs: string
  channelTable: string
  peerList: string
  recentLogs: string
  openApp: string
  category: string
}
```

`zh.ts` / `en.ts` must export `const zh: Messages` / `const en: Messages` covering every key. Example zh values:

```ts
import type { Messages } from './types'

export const zh: Messages = {
  brand: 'Opticrum Desktop',
  brandSub: 'Fiber Wallet',
  balance: 'CKB 余额',
  balanceHint: '点击查看明细',
  available: '可用',
  locked: '锁定',
  nodeChannels: '节点 / 通道',
  nodeOnline: '在线',
  nodeOffline: '离线',
  channelsActive: '活跃通道',
  localCapacity: '本地容量',
  nodeRuntime: '节点运行',
  peers: 'Peers',
  synced: '已同步',
  theme: '主题',
  themeDark: '深色',
  themeLight: '浅色',
  language: '语言',
  back: '返回',
  marketplace: '应用市场',
  searchApps: '搜索应用',
  allCategories: '全部',
  networkOverview: '全网概况',
  networkNodes: '节点',
  networkChannels: '通道',
  networkCapacity: '网络容量',
  settlements24h: '24h 结算',
  news: '资讯',
  changelog: '更新日志',
  recentTxs: '近期交易',
  channelTable: '通道列表',
  peerList: 'Peer 列表',
  recentLogs: '近期日志',
  openApp: '打开',
  category: '分类',
}
```

Mirror English in `en.ts` (`CKB Balance`, `App Marketplace`, etc.).

`LocaleContext.tsx`:
```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { en } from './en'
import { zh } from './zh'
import type { Locale, Messages } from './types'

type LocaleCtx = { locale: Locale; setLocale: (l: Locale) => void; t: Messages; toggleLocale: () => void }

const LocaleContext = createContext<LocaleCtx | null>(null)
const KEY = 'opticrum-locale'
const dict: Record<Locale, Messages> = { zh, en }

function readLocale(): Locale {
  const saved = localStorage.getItem(KEY)
  return saved === 'en' ? 'en' : 'zh'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale)

  const setLocale = (l: Locale) => {
    localStorage.setItem(KEY, l)
    setLocaleState(l)
  }

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: dict[locale],
      toggleLocale: () => setLocale(locale === 'zh' ? 'en' : 'zh'),
    }),
    [locale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale outside LocaleProvider')
  return ctx
}
```

- [ ] **Step 4: Minimal `app.css` shell skeleton**

```css
.app-shell {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 300px;
  height: 100%;
  min-width: 1100px;
}

.sidebar {
  background: var(--bg-elevated);
  border-color: var(--border);
  border-style: solid;
  display: flex;
  flex-direction: column;
  padding: 16px 14px;
  gap: 12px;
  overflow: auto;
}

.sidebar-left { border-right-width: 1px; }
.sidebar-right { border-left-width: 1px; }

.center-panel {
  padding: 16px 20px;
  overflow: auto;
  background: var(--bg);
}

.card {
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  box-shadow: var(--shadow);
}

.card-clickable { transition: border-color 0.15s ease, transform 0.15s ease; }
.card-clickable:hover { border-color: var(--accent); transform: translateY(-1px); }

.muted { color: var(--text-secondary); font-size: 12px; }
.accent { color: var(--accent); }

.footer-toggles {
  margin-top: auto;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.toggle-btn {
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  color: var(--text);
  text-align: center;
}

.toggle-btn strong { display: block; color: var(--accent); font-weight: 600; }

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  margin-bottom: 14px;
  font-size: 14px;
}
```

- [ ] **Step 5: Wire providers in `App.tsx`**

```tsx
import { BrowserRouter } from 'react-router-dom'
import { LocaleProvider } from './i18n/LocaleContext'
import { ThemeProvider } from './theme/ThemeContext'

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <BrowserRouter>
          <div style={{ padding: 24 }}>providers ok</div>
        </BrowserRouter>
      </LocaleProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 6: Verify**

```bash
cd mockup && npm run build
```

Expected: success. Optionally `npm run dev` and confirm `data-theme="dark"` on `<html>`.

---

### Task 3: Mock data modules

**Files:**
- Create: `mockup/src/mock/wallet.ts`, `channels.ts`, `node.ts`, `network.ts`, `news.ts`, `apps.ts`, `changelogs.ts`

Keep bilingual display fields where user-facing strings differ (`titleZh` / `titleEn`) so pages can pick by locale without growing the i18n dictionary for every news headline.

- [ ] **Step 1: `wallet.ts`**

```ts
export type Tx = {
  id: string
  type: 'receive' | 'send' | 'channel_open' | 'channel_close'
  amountCkb: number
  timestamp: string
  txHash: string
}

export const wallet = {
  address: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqds6edszer3w0fkx63kvxu6znl0z2vhrza3x9s2p',
  addressShort: 'ckt1…s2p',
  totalCkb: 12480.52134,
  availableCkb: 9820.12,
  lockedCkb: 2660.40134,
  fiatUsd: 1842.1,
  txs: [
    {
      id: 'tx1',
      type: 'receive' as const,
      amountCkb: 500,
      timestamp: '2026-07-28T09:14:00+08:00',
      txHash: '0x7a1c…e92f',
    },
    {
      id: 'tx2',
      type: 'channel_open' as const,
      amountCkb: -1200,
      timestamp: '2026-07-27T16:02:00+08:00',
      txHash: '0x91b0…44aa',
    },
    {
      id: 'tx3',
      type: 'send' as const,
      amountCkb: -42.5,
      timestamp: '2026-07-26T11:40:00+08:00',
      txHash: '0x33de…0c18',
    },
  ] satisfies Tx[],
}
```

- [ ] **Step 2: `channels.ts`**

```ts
export type Channel = {
  id: string
  peerAlias: string
  peerPubkeyShort: string
  capacityCkb: number
  localBalanceCkb: number
  remoteBalanceCkb: number
  state: 'active' | 'pending' | 'closing'
  baseFeeMshannons: number
  feeRatePpm: number
}

export const channelsSummary = {
  online: true,
  activeCount: 6,
  pendingCount: 1,
  localCapacityCkb: 4820.5,
}

export const channels: Channel[] = [
  {
    id: 'ch-01',
    peerAlias: 'Nervos Hub',
    peerPubkeyShort: '02ab…91f4',
    capacityCkb: 2000,
    localBalanceCkb: 1250.4,
    remoteBalanceCkb: 749.6,
    state: 'active',
    baseFeeMshannons: 1000,
    feeRatePpm: 120,
  },
  {
    id: 'ch-02',
    peerAlias: 'Fiber Relay East',
    peerPubkeyShort: '03cd…77a1',
    capacityCkb: 1500,
    localBalanceCkb: 620,
    remoteBalanceCkb: 880,
    state: 'active',
    baseFeeMshannons: 800,
    feeRatePpm: 90,
  },
  {
    id: 'ch-03',
    peerAlias: 'Opticrum LP-1',
    peerPubkeyShort: '02f1…0bb2',
    capacityCkb: 800,
    localBalanceCkb: 400,
    remoteBalanceCkb: 400,
    state: 'pending',
    baseFeeMshannons: 1000,
    feeRatePpm: 100,
  },
  // add 3–4 more realistic rows
]
```

Fill remaining rows similarly (total ~6–7 channels).

- [ ] **Step 3: `node.ts`**

```ts
export const nodeRuntime = {
  tipHeight: 12_804_221,
  peers: 48,
  cpuPercent: 12,
  memPercent: 38,
  uptimeHours: 186,
  synced: true,
}

export const peers = [
  { id: 'p1', alias: 'ckb-bot-sg', addr: '/ip4/18.142.…/tcp/8115', latencyMs: 42 },
  { id: 'p2', alias: 'fiber-seed-1', addr: '/ip4/104.21.…/tcp/8115', latencyMs: 88 },
  { id: 'p3', alias: 'relay-eu', addr: '/ip4/65.21.…/tcp/8115', latencyMs: 160 },
  { id: 'p4', alias: 'merchant-node', addr: '/ip4/47.98.…/tcp/8115', latencyMs: 55 },
]

export const logs = [
  { ts: '2026-07-29T10:01:12+08:00', level: 'INFO', msg: 'Channel ch-02 updated local balance +12.4 CKB' },
  { ts: '2026-07-29T09:58:03+08:00', level: 'INFO', msg: 'Peer fiber-seed-1 connected' },
  { ts: '2026-07-29T09:40:17+08:00', level: 'WARN', msg: 'Htlc timeout watchtower check delayed 1.2s' },
  { ts: '2026-07-29T09:12:44+08:00', level: 'INFO', msg: 'Synced to tip #12804221' },
]
```

- [ ] **Step 4: `network.ts`, `news.ts`, `changelogs.ts`, `apps.ts`**

`network.ts`:
```ts
export const networkOverview = {
  nodes: 1_284,
  channels: 6_902,
  capacityCkb: 18_420_550.22,
  settlements24h: 3_417,
}
```

`news.ts`: 6–8 items with `{ id, source, titleZh, titleEn, time, tag: 'Fiber' | 'Lightning' }`.

`changelogs.ts`: 4–6 items with `{ version, date, titleZh, titleEn, bodyZh, bodyEn }`.

`apps.ts`:
```ts
export type AppCategory = 'payments' | 'defi' | 'tools' | 'games'

export type MarketApp = {
  id: string
  nameZh: string
  nameEn: string
  blurbZh: string
  blurbEn: string
  category: AppCategory
  tags: string[]
  accent: string // css color for icon tile
  featured?: boolean
}

export const banners = [
  { id: 'b1', titleZh: 'Fiber 支付周', titleEn: 'Fiber Pay Week', subtitleZh: '体验即时小额支付应用', subtitleEn: 'Try instant micropayment apps', accent: '#0f766e' },
  { id: 'b2', titleZh: '流动性做市启航', titleEn: 'Liquidity Market Launch', subtitleZh: '在 Opticrum 上提供通道流动性', subtitleEn: 'Provide channel liquidity on Opticrum', accent: '#134e4a' },
  { id: 'b3', titleZh: '开发者工具包', titleEn: 'Developer Toolkit', subtitleZh: '调试节点与发票的一站式工具', subtitleEn: 'One-stop tools for nodes & invoices', accent: '#115e59' },
]

export const apps: MarketApp[] = [
  // at least 9 apps across categories — realistic Fiber/CKB flavored names
]
```

Populate ≥9 apps (e.g. Fiber Pay, Invoice Desk, Channel Scout, LN Bridge Watch, Opticrum LP Desk, UDT Tip Jar, Peer Map, HashTime Lab, Pixel Faucet).

- [ ] **Step 5: Verify TypeScript**

```bash
cd mockup && npx tsc -p tsconfig.app.json --noEmit
```

Expected: no errors.

---

### Task 4: AppShell, sidebars, router

**Files:**
- Create: `mockup/src/layout/AppShell.tsx`, `LeftSidebar.tsx`, `RightSidebar.tsx`, `mockup/src/components/BackLink.tsx`
- Modify: `mockup/src/App.tsx`
- Create stub pages if needed so routes compile (filled in Tasks 5–6)

- [ ] **Step 1: `BackLink.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'

export function BackLink({ to = '/' }: { to?: string }) {
  const { t } = useLocale()
  return (
    <Link className="back-link" to={to}>
      ← {t.back}
    </Link>
  )
}
```

- [ ] **Step 2: `LeftSidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'
import { useTheme } from '../theme/ThemeContext'
import { wallet } from '../mock/wallet'
import { channelsSummary } from '../mock/channels'
import { nodeRuntime } from '../mock/node'

export function LeftSidebar() {
  const { t, locale, toggleLocale } = useLocale()
  const { theme, toggleTheme } = useTheme()

  return (
    <aside className="sidebar sidebar-left">
      <div className="brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-title">{t.brand}</div>
          <div className="muted">{t.brandSub}</div>
        </div>
      </div>

      <NavLink to="/balance" className="card card-clickable nav-card">
        <div className="muted">{t.balance}</div>
        <div className="metric">{wallet.totalCkb.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        <div className="accent muted">≈ ${wallet.fiatUsd.toLocaleString()} · {t.balanceHint}</div>
      </NavLink>

      <NavLink to="/channels" className="card card-clickable nav-card">
        <div className="muted">{t.nodeChannels}</div>
        <div className="row">
          <span>{t.brandSub.replace('Wallet', 'Node')}</span>
          <span className="accent">{channelsSummary.online ? t.nodeOnline : t.nodeOffline}</span>
        </div>
        <div className="row">
          <span>{t.channelsActive}</span>
          <strong>{channelsSummary.activeCount}</strong>
        </div>
        <div className="row">
          <span>{t.localCapacity}</span>
          <strong>{channelsSummary.localCapacityCkb.toLocaleString()} CKB</strong>
        </div>
      </NavLink>

      <NavLink to="/node" className="card card-clickable nav-card">
        <div className="muted">{t.nodeRuntime}</div>
        <div>CPU {nodeRuntime.cpuPercent}% · {t.peers} {nodeRuntime.peers}</div>
        <div className="muted">
          {nodeRuntime.synced ? t.synced : '…'} · tip #{nodeRuntime.tipHeight.toLocaleString()}
        </div>
      </NavLink>

      <div className="footer-toggles">
        <button type="button" className="toggle-btn" onClick={toggleTheme}>
          <span className="muted">{t.theme}</span>
          <strong>{theme === 'dark' ? t.themeDark : t.themeLight}</strong>
        </button>
        <button type="button" className="toggle-btn" onClick={toggleLocale}>
          <span className="muted">{t.language}</span>
          <strong>{locale === 'zh' ? '中文' : 'EN'}</strong>
        </button>
      </div>
    </aside>
  )
}
```

Add CSS for `.brand`, `.brand-mark`, `.brand-title`, `.metric`, `.row`, `.nav-card` in `app.css` (teal gradient mark 28×28, flex rows with space-between). Fix the awkward `brandSub.replace` — use a dedicated `nodeLabel` message key instead (`节点` / `Node`) added to `Messages` / zh / en.

- [ ] **Step 3: `RightSidebar.tsx`**

Render three sections from `networkOverview`, `news`, `changelogs`. Pick `titleZh`/`titleEn` by `locale`. Compact list rows; no navigation required.

- [ ] **Step 4: `AppShell.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'

export function AppShell() {
  return (
    <div className="app-shell">
      <LeftSidebar />
      <main className="center-panel">
        <Outlet />
      </main>
      <RightSidebar />
    </div>
  )
}
```

- [ ] **Step 5: Routes in `App.tsx`**

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LocaleProvider } from './i18n/LocaleContext'
import { ThemeProvider } from './theme/ThemeContext'
import { AppShell } from './layout/AppShell'
import { Home } from './pages/Home'
import { BalanceDetail } from './pages/BalanceDetail'
import { ChannelsDetail } from './pages/ChannelsDetail'
import { NodeDetail } from './pages/NodeDetail'
import { AppDetail } from './pages/AppDetail'

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="balance" element={<BalanceDetail />} />
              <Route path="channels" element={<ChannelsDetail />} />
              <Route path="node" element={<NodeDetail />} />
              <Route path="apps/:id" element={<AppDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LocaleProvider>
    </ThemeProvider>
  )
}
```

Create empty page components returning `<div />` if Task 5/6 not done yet — prefer implementing Task 5 next in the same session so Home is real.

- [ ] **Step 6: Verify**

```bash
cd mockup && npm run build && npm run dev
```

Expected: three columns visible; theme/lang toggles flip UI; clicking left cards changes URL while sidebars stay.

---

### Task 5: Center marketplace (Home + Banner + AppGrid)

**Files:**
- Create: `mockup/src/components/Banner.tsx`, `mockup/src/components/AppGrid.tsx`, `mockup/src/pages/Home.tsx`
- Modify: `mockup/src/styles/app.css`

- [ ] **Step 1: `Banner.tsx`**

Props: slides from `banners`. Auto-advance every 4s; pause on hover; dots to jump. Show title/subtitle by locale. Full-width rounded strip with `accent` gradient background.

```tsx
import { useEffect, useState } from 'react'
import { banners } from '../mock/apps'
import { useLocale } from '../i18n/LocaleContext'

export function Banner() {
  const { locale } = useLocale()
  const [i, setI] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setI((x) => (x + 1) % banners.length), 4000)
    return () => window.clearInterval(id)
  }, [])

  const slide = banners[i]
  return (
    <section
      className="banner"
      style={{ background: `linear-gradient(90deg, ${slide.accent}, #0b0f14)` }}
      onMouseEnter={() => {/* optional: setPaused */}}
    >
      <h1>{locale === 'zh' ? slide.titleZh : slide.titleEn}</h1>
      <p>{locale === 'zh' ? slide.subtitleZh : slide.subtitleEn}</p>
      <div className="banner-dots">
        {banners.map((b, idx) => (
          <button key={b.id} type="button" className={idx === i ? 'active' : ''} onClick={() => setI(idx)} />
        ))}
      </div>
    </section>
  )
}
```

Style `.banner` ~120–140px tall, large type; dots as small pills.

- [ ] **Step 2: `AppGrid.tsx`**

State: `query` string, `category: 'all' | AppCategory`. Filter `apps`. Category chips use i18n labels (add keys `catPayments`, `catDefi`, `catTools`, `catGames` to Messages). Each card is a `Link` to `/apps/:id` with colored icon tile (`accent`), name, blurb, tags.

- [ ] **Step 3: `Home.tsx`**

```tsx
import { Banner } from '../components/Banner'
import { AppGrid } from '../components/AppGrid'
import { useLocale } from '../i18n/LocaleContext'

export function Home() {
  const { t } = useLocale()
  return (
    <div className="home">
      <Banner />
      <h2 className="section-title">{t.marketplace}</h2>
      <AppGrid />
    </div>
  )
}
```

- [ ] **Step 4: Verify visually**

`npm run dev` — banner rotates; search filters; category chips filter; cards navigate to `/apps/:id` (detail may still be stub).

---

### Task 6: Detail pages

**Files:**
- Create/fill: `BalanceDetail.tsx`, `ChannelsDetail.tsx`, `NodeDetail.tsx`, `AppDetail.tsx`

- [ ] **Step 1: `BalanceDetail`**

`BackLink` + total/available/locked cards + address short/full + table of `wallet.txs` (type, amount signed, time, txHash).

- [ ] **Step 2: `ChannelsDetail`**

`BackLink` + summary strip + HTML table of `channels` (peer, capacity, local/remote, state badge, fees).

- [ ] **Step 3: `NodeDetail`**

`BackLink` + runtime KPIs + peers list + log lines (`level` colored).

- [ ] **Step 4: `AppDetail`**

```tsx
import { useParams } from 'react-router-dom'
import { apps } from '../mock/apps'
import { BackLink } from '../components/BackLink'
import { useLocale } from '../i18n/LocaleContext'

export function AppDetail() {
  const { id } = useParams()
  const { locale, t } = useLocale()
  const app = apps.find((a) => a.id === id)
  if (!app) return <div><BackLink /><p>Not found</p></div>
  return (
    <div>
      <BackLink />
      <div className="app-hero" style={{ borderColor: app.accent }}>
        <div className="app-icon" style={{ background: app.accent }} />
        <div>
          <h1>{locale === 'zh' ? app.nameZh : app.nameEn}</h1>
          <p className="muted">{locale === 'zh' ? app.blurbZh : app.blurbEn}</p>
          <div className="tags">{app.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <button type="button" className="primary-btn">{t.openApp}</button>
        </div>
      </div>
    </div>
  )
}
```

`openApp` button is visual-only (no-op or `alert` stub — prefer no-op).

- [ ] **Step 5: Verify**

Click left cards and an app card; center content changes; sidebars unchanged; back returns home.

```bash
cd mockup && npm run build
```

---

### Task 7: Visual polish pass

**Files:**
- Modify: `mockup/src/styles/app.css`, light tweaks to sidebars/pages as needed

- [ ] **Step 1: Polish checklist (do in CSS / small markup fixes)**

1. Active `NavLink` gets teal border or soft accent background.
2. Light theme: elevated cards readable, banner text contrast OK.
3. Tables: compact, zebra or hairline rows, no enterprise Ant look.
4. Marketplace grid: 3 columns, gap 12px, card hover.
5. Right sidebar hierarchy: overview → news → changelog, clear section labels.
6. No purple gradients; stick to slate + teal.

- [ ] **Step 2: Final acceptance**

```bash
cd mockup && npm install && npm run build && npm run dev
```

Manual:
- [ ] Three-column shell, no top bar
- [ ] Theme | language one row in left footer; persist reload
- [ ] zh/en copy switches
- [ ] Banner autoplay
- [ ] Marketplace search + categories
- [ ] `/balance`, `/channels`, `/node`, `/apps/:id` center-only

---

## Spec coverage check

| Spec item | Task |
|---|---|
| Vite React TS under `mockup/` | 1 |
| Dual theme, default dark, localStorage | 2 |
| zh/en dictionary toggle | 2 |
| No top bar; theme\|lang one row | 4 |
| Left cards → center details | 4, 6 |
| Marketplace banner + grid | 5 |
| Right network/news/changelog | 4 |
| Realistic mock data | 3 |
| Thin scaffolding / no UI kit | all |
| Desktop-first | CSS min-width |

## Placeholder scan

No TBD/TODO left in tasks. Channel list asks to “add 3–4 more rows” — implementer must write full concrete objects (copy pattern from first three). Apps list must include ≥9 concrete entries before Task 5.
