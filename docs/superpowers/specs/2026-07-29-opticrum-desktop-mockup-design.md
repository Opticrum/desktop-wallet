# Opticrum Desktop Mockup — Design Spec

**Date:** 2026-07-29  
**Location:** `opticrum-wallet/mockup/`  
**Status:** Approved in brainstorming (with thin-scaffolding preference)

## Goal

Ship a **static desktop wallet UI mockup** for Fiber / Opticrum: left–center–right workbench with realistic fake data. Primary visual real estate goes to an **app marketplace**. No chain, signing, or backend.

## Product decisions

| Decision | Choice |
|---|---|
| Product name | Opticrum Desktop |
| Stack | Vite + React + TypeScript |
| Visual | Dual light/dark (slate + teal), default dark |
| Chrome | **No top bar** |
| Left footer | Theme + language **on one row** |
| Secondary pages | Replace **center only**; sidebars stay |
| Locale | zh / en toggle (simple dictionary) |
| Effort bias | **Pages & content first**; keep framework scaffolding thin |

## Layout

```
┌──────────────┬────────────────────────────┬─────────────────┐
│ Left ~260px  │ Center (flex)              │ Right ~300px    │
│              │                            │                 │
│ Logo         │ Home: Banner + Marketplace │ Network overview│
│ Balance card │ Detail routes: center only │ News            │
│ Node/Channel │                            │ Changelogs      │
│ Node runtime │                            │                 │
│              │                            │                 │
│ [Theme|Lang] │                            │                 │
└──────────────┴────────────────────────────┴─────────────────┘
```

- Desktop-first (~1440×900+). Narrow/mobile collapse is out of scope for this mockup.
- Detail back control lives at the **top of the center panel**.

## Content & mock data

### Left — wallet / node (clickable → center detail)

1. **CKB balance** — total, available/locked, address short form. Detail: breakdown + recent txs.
2. **Node / channels** — online status, channel count, local capacity. Detail: channel table (peer, capacity, state, fees).
3. **Node runtime** — tip height, peers, CPU/mem stubs, uptime. Detail: peer list + recent log lines.

Footer: theme toggle | language toggle (single row).

### Center — marketplace (main visual)

- Auto-scrolling banner (3–5 slides).
- Category tabs + search.
- App cards (icon, name, blurb, tags). Click → center app detail.

### Right — read-only intel

- Network overview KPIs (nodes, channels, capacity, 24h settlements) — fake.
- Fiber / Lightning news list (5–8).
- Product changelogs (4–6 short entries).

All data in `src/mock/*.ts` with realistic amounts, txids, pubkey prefixes, timestamps.

## Technical approach (thin scaffolding)

**Recommended:** one Vite React SPA, minimal dependencies.

- **Routing:** `react-router` — `/`, `/balance`, `/channels`, `/node`, `/apps/:id`. Shell renders left + right; center is `<Outlet />`.
- **Theme:** `data-theme="dark|light"` + CSS variables in one tokens file; persist in `localStorage`.
- **i18n:** small `zh`/`en` dictionaries + React context — **not** react-i18next.
- **Styling:** plain CSS (or CSS modules) with design tokens. No Ant Design / heavy UI kit.
- **Deps to avoid unless needed:** component libraries, state managers, chart libs, i18n frameworks, CSS-in-JS runtimes.

### Directory sketch

```
mockup/
  package.json
  vite.config.ts
  index.html
  src/
    main.tsx
    App.tsx                 # providers + router
    styles/tokens.css
    styles/app.css
    i18n/{zh,en,context}.ts(x)
    mock/{wallet,channels,node,network,news,apps,changelogs}.ts
    layout/{AppShell,LeftSidebar,RightSidebar}.tsx
    pages/{Home,BalanceDetail,ChannelsDetail,NodeDetail,AppDetail}.tsx
    components/…            # page-local UI; prefer co-locating over deep trees
```

Keep file count low: merge tiny helpers; put polish into page components and mock copy, not into build config or abstractions.

## Interaction scope

**In:** navigate details, theme/lang toggle, banner autoplay, marketplace search/category filter, app detail.  
**Out:** real CKB/Fiber RPC, wallet unlock, signing, payments, Electron/Tauri shell (later).

## Visual language

- Slate neutrals + teal accent; light and dark equally finished.
- Avoid purple gradients, generic glassmorphism stacks, Inter-as-only-font defaults.
- Typography: one readable sans for UI (e.g. system stack or a single Google/fontsource face) — do not spend time on elaborate type systems.
- Marketplace should feel like a consumer wallet storefront, not an enterprise admin console.

## Success criteria

1. `cd mockup && npm i && npm run dev` shows the three-column shell with fake data.
2. Theme and language toggles work and persist.
3. Left cards and app cards open center detail routes; sidebars remain.
4. Most of the visual time went into layout, cards, banner, and copy — not tooling.

## Non-goals

- Pixel-perfect responsive mobile.
- Real API integration.
- Auth, HD wallet, or node process management.
- Exhaustive component library / Storybook.
