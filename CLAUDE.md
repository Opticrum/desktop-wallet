# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Opticrum Desktop** — a **static UI mockup** of the Fiber desktop wallet + app marketplace. Sits alongside the three Rust siblings (`opticrum/`, `opticrum-sdk/`, `rust-server/`) in the parent Fiber monorepo but is **fully independent**: no Rust toolchain, no chain/signing/backend, just a Vite + React + TypeScript SPA driven by predefined fake data.

```
opticrum-wallet/
├── mockup/                       # Vite + React + TS SPA (the only runnable code)
├── docs/superpowers/specs/       # Design spec (approved)
├── docs/superpowers/plans/       # Implementation plans
├── AGENTS.md                     # Learned user preferences + workspace facts
└── .cursor/hooks/state/          # Cursor continual-learning state
```

The parent monorepo's Rust projects are *not* built or referenced from here — this mockup exists to nail the visual layout and copy before a real Electron/Tauri shell wraps the Rust backend.

## Build & Run

All commands run from `mockup/`:

```bash
cd mockup
npm install
npm run dev        # http://127.0.0.1:5173 — use viewport ≥1100px (left/center/right layout)
npm run build      # tsc -b && vite build  →  mockup/dist/
npm run preview    # serve the built bundle
```

There are no Rust tools, no test suite, no linter configured. TypeScript's own `tsc -b` (run as part of `npm run build`) is the only static check.

## High-Level Architecture

The mockup is intentionally **thin scaffolding + rich pages**. The architecture is a small, opinionated React tree — no router library beyond `react-router-dom`, no state manager, no UI kit.

**Provider stack** (`src/main.tsx` → `src/App.tsx`):
```
StrictMode
└── ThemeProvider                # data-theme="dark|light" on <html> + localStorage
    └── LocaleProvider           # zh | en dictionary + localStorage
        └── BrowserRouter        # routes registered in App.tsx
            └── AppShell         # grid: 260px | 1fr | 300px (min-width 1100px)
                ├── LeftSidebar
                ├── <Outlet />   # center — pages/Home, BalanceDetail, ChannelsDetail, NodeDetail, AppDetail
                └── RightSidebar
```

**Routes:** `/`, `/balance`, `/channels`, `/node`, `/apps/:id` (any unknown path → `/`).

**Layout principle (from design spec):** no top bar. The center `<Outlet />` swaps detail content; `LeftSidebar` and `RightSidebar` stay mounted so wallet/node/network context is always visible. The `BackLink` component lives at the top of each center detail page.

**Styling:** plain CSS files in `src/styles/`:
- `tokens.css` — CSS variables for both `[data-theme='light']` and `[data-theme='dark']` (slate gray + teal accent, default dark). All components consume these tokens; never hardcode colors.
- `app.css` — single CSS file for the entire app (no CSS modules / no Tailwind).

**i18n:** homegrown dictionary swap, not `react-i18next`. `src/i18n/types.ts` defines the strict `Messages` shape; `zh.ts` and `en.ts` are parallel dictionaries; `LocaleContext.tsx` provides `t` (the current `Messages`) plus `toggleLocale`. Default locale is `zh`; falls back to `zh` when `localStorage` is empty.

**Theme:** `src/theme/ThemeContext.tsx` toggles `data-theme` on `document.documentElement` and persists to `localStorage['opticrum-theme']`. Default is `dark`.

**Mock data:** `src/mock/` holds every realistic-looking fake dataset (wallet balances, channels, node runtime, network overview, news, changelogs, marketplace apps + banners). Pages and sidebars import directly from these modules — there is no fetch layer.

**Marketplace components:**
- `Banner` — auto-rotating carousel (4s interval, pauses on hover) over slides in `mock/apps.ts`.
- `AppGrid` — search input + category chips (`payments` / `defi` / `tools` / `games`) filtering `apps`. Card click → `/apps/:id`.

## Conventions & Constraints

These come from the approved design spec (`docs/superpowers/specs/2026-07-29-opticrum-desktop-mockup-design.md`) and the learned-preferences file (`AGENTS.md`):

- **Pages and copy first, scaffolding last.** Do not introduce abstractions, component libraries, state managers, chart libs, CSS-in-JS, or i18n frameworks.
- **Desktop-only.** Layout collapses below 1100px; mobile responsive is explicitly out of scope.
- **Locale parity:** every new visible string must be added to **all three** of `i18n/types.ts`, `i18n/zh.ts`, `i18n/en.ts`. The `Messages` type is the contract.
- **Theme parity:** light and dark themes must look finished. Add tokens to both blocks in `styles/tokens.css`; never inline a color that should be a token.
- **No top bar.** Logo, theme, and language toggles live where the design says — left sidebar brand + footer toggles.
- **Visual language:** slate neutrals + teal accent. Avoid purple gradients, generic glassmorphism, Inter-as-only-font defaults. Use the system font stack already declared in `tokens.css`.
- **Mock data realism:** fake but plausible — real-shaped txids, pubkey prefixes, CKB amounts, timestamps. New datasets go in `src/mock/`.

## Reference Files

When changing behavior, consult these in order:

1. `docs/superpowers/specs/2026-07-29-opticrum-desktop-mockup-design.md` — the source of truth for layout, theming, locale, and what's in/out of scope.
2. `AGENTS.md` — accumulated user preferences and workspace facts; updated by the user as decisions get made.
3. `mockup/README.md` — quick-start commands for running the dev server.