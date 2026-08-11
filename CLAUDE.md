# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Opticrum Desktop** — the Fiber desktop wallet + app marketplace, now a **Tauri 2 desktop application**. It sits alongside the three Rust siblings (`opticrum/`, `opticrum-sdk/`, `rust-server/`) in the parent Fiber monorepo.

The app is **local-first**: the Tauri shell (`src-tauri/`) hosts the frontend in the OS WebView, and Rust IPC commands are the bridge to wallet/chain logic. **No backend server is planned for wallet/channels/node/liquidity** — Rust is embedded in the host process as a library. The **app marketplace is the only networked part** (plain `fetch` to a remote catalog).

```
opticrum-wallet/
├── mockup/          # FROZEN visual reference — independent, never modified
├── app/             # Live desktop frontend (ported from mockup; Vite + React + TS)
├── src-tauri/       # Tauri 2 Rust shell (thin IPC commands; will embed core crate)
├── DESIGN.md        # High-fidelity visual spec — required for all UI work
├── docs/superpowers/ (specs/ + plans/)
├── AGENTS.md        # Learned user preferences + workspace facts
└── CLAUDE.md
```

### The three parts

- **`mockup/`** — the original static SPA that nails the visual layout and copy. It is a **frozen reference**: do not modify it. Run it standalone in a browser to compare against the desktop app. All design/spec docs refer to this project's structure.
- **`app/`** — the desktop app's frontend (byte-for-byte port of `mockup/`: same components, styles, i18n). This is the **live** frontend: all future UI work happens here. It consumes data through the `app/src/api/` IPC layer (`client.ts` → `transport.ts` → Rust or the browser fallback); pure formulas live in `app/src/lib/`.
- **`src-tauri/`** — the Tauri 2.x Rust host. **Thin commands only** — validate args, call the core, serialize. Business logic belongs in a testable crate (a `opticrum-wallet-core` crate that embeds `opticrum-sdk` and reuses `rust-server`'s wallet code is planned), not in command bodies.

## Build & Run

Root `package.json` holds the Tauri CLI + orchestration scripts:

```bash
npm install                        # root: installs @tauri-apps/cli

# Desktop app — main dev loop (vite on :5174 + native window)
npm run tauri:dev

# Build the desktop bundle (builds app/ first, then bundles)
npm run tauri:build

# Live frontend in a plain browser (:5174) — for UI work without the shell
cd app && npm install && npm run dev

# Frozen reference mockup standalone (:5173) — visual comparison only
npm run mockup:dev

# Rust shell static check
cd src-tauri && cargo check
```

- `npm run tauri:dev` auto-starts `app/`'s vite dev server (`beforeDevCommand`) and opens the native window at `http://localhost:5174`.
- `npm run tauri:build` runs `beforeBuildCommand` (build `app/`) then produces the OS bundle from `app/dist`.
- **Ports: mockup = 5173, app = 5174 — keep them distinct.** The WebView in dev loads `:5174`; in production it loads `../app/dist` over the tauri custom protocol.
- Window config lives in `src-tauri/tauri.conf.json` (identifier `com.opticrum.wallet`, min 1100×700, default 1440×900).
- No test suite exists. `tsc -b` (part of `app/`'s `npm run build`) and `cargo check` are the only static checks.

## High-Level Architecture

Thin scaffolding + rich pages. React tree, no router beyond `react-router-dom`, no state manager, no UI kit. `app/`'s provider stack (ported unchanged from mockup):

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

**Shell ↔ frontend boundary:**
- Dev: OS WebView loads `http://localhost:5174` (vite). Production: WebView loads `../app/dist` over the tauri protocol.
- Frontend talks to Rust only through `@tauri-apps/api` `invoke()` (IPC commands). The 30-command surface from `docs/ipc/ipc-api.md` is implemented in `src-tauri/src/commands.rs` (wire types in `wire.rs`, mock datasets in `mock_data.rs`, shared store in `state.rs`); the frontend transport lives in `app/src/api/` (`transport.ts` maps the docs' `<domain>.<verb>` names to Tauri's underscore fn names).
- The app marketplace is the only part that should `fetch` a remote catalog; wallet/channels/node/liquidity stay local (invoke → Rust).

**Styling:** plain CSS in `app/src/styles/` — `tokens.css` (CSS variables for both `[data-theme='light']` and `[data-theme='dark']`, slate gray + teal accent, default dark) and `app.css` (single stylesheet). Never hardcode colors.

**i18n:** homegrown dictionary swap. `app/src/i18n/types.ts` = strict `Messages` shape; `zh.ts` + `en.ts` parallel; `LocaleContext.tsx` provides `t`. Default `zh`.

**Mock data:** wallet/channels/node/liquidity datasets live in `src-tauri/src/mock_data.rs` (served over IPC) with a DEV-ONLY wire-shaped mirror in `app/src/api/browserMock.ts` for the standalone browser workflow; marketplace content (apps/banners/news/changelogs) stays in `app/src/content/` (HTTP content domain). Pages consume everything through `app/src/api/client.ts`; pure formulas live in `app/src/lib/`.

## Conventions & Constraints

- **All UI changes must actively reference `DESIGN.md`.** Read the applicable sections (layout, tokens, spacing, typography, component specs) before editing components, pages, or styles in `app/` (or reading `mockup/` as reference). Treat it as the visual source of truth.
- **Pages and copy first, scaffolding last.** Do not introduce abstractions, component libraries, state managers, chart libs, CSS-in-JS, or i18n frameworks.
- **Desktop-only.** Layout collapses below 1100px (window enforces `minWidth: 1100`); mobile is explicitly out of scope.
- **Locale parity:** every new visible string must be added to **all three** of `app/src/i18n/types.ts`, `zh.ts`, `en.ts`. The `Messages` type is the contract.
- **Theme parity:** light and dark themes must look finished. Add tokens to both blocks in `tokens.css`; never inline a color that should be a token.
- **No top bar.** Logo, theme, and language toggles live where the design says — left sidebar brand + footer toggles.
- **Visual language:** slate neutrals + teal accent. Avoid purple gradients, generic glassmorphism, Inter-as-only-font defaults. System font stack already declared in `tokens.css`.
- **Mock data realism:** fake but plausible — real-shaped txids, pubkey prefixes, CKB amounts, timestamps. New datasets go in `app/src/mock/`.
- **Rust shell discipline:** keep `src-tauri/` commands thin; put logic in a testable crate following the sibling repos' patterns (generic over traits, in-memory fakes for tests).

## Reference Files

1. **`DESIGN.md`** — **required for all UI changes.** High-fidelity visual spec (layout, density, colors, typography, shadows, component anatomy).
2. `docs/superpowers/specs/2026-07-29-opticrum-desktop-mockup-design.md` — scope, shell architecture, theming/locale rules, in/out of scope.
3. `AGENTS.md` — accumulated user preferences and workspace facts; updated as decisions get made.
4. `mockup/` — the frozen reference; diff `app/` work against it visually before shipping UI changes.
5. `src-tauri/tauri.conf.json` — window + build configuration.
6. `docs/ipc/` — IPC 契约文档：`ipc-api.md`（30 个命令的完整命令面 + wire type + 约定）、`sdk-coverage-gap.md`（以 wallet 渲染数据为基线的 SDK 覆盖缺口矩阵）。
