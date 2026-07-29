# DESIGN.md

## Reference: LN Wallet (Lightning Network desktop wallet) — design analysis

Source image: `/Users/vimchain/Desktop/LNWalletpng.png` — composite mockup showing the LN Wallet desktop app in both light and dark themes, plus a suite of secondary screens (Lightning Node, Wallet, My Page, Settings).

**Why this reference exists.** LN Wallet is a production-grade Lightning Network wallet for desktop with a well-finished light/dark theme pair, an established information architecture (Marketplace → Node → Wallet → Me), and a visual language aimed at consumer-grade fintech clarity rather than admin-console density. The Opticrum Desktop mockup is solving a similar problem — a desktop wallet for a different chain — so its layout, component vocabulary, and information hierarchy are useful reference points. This file catalogs what's worth borrowing and what's deliberately not.

> Read this file alongside `docs/superpowers/specs/2026-07-29-opticrum-desktop-mockup-design.md` (the approved Opticrum spec) when designing new screens.

---

## 1. Information architecture

LN Wallet organizes its app around **four primary destinations** reachable from the left sidebar, plus a footer tray for secondary tools:

| Sidebar item | What lives there |
|---|---|
| **Marketplace** | Hero + categories + dApp grid + network status sidebar |
| **Lightning Node** | Overview / Channels / Send-Receive / Peers (sub-tabs) |
| **Wallet** | Assets / HD Wallet / On-chain Assets (sub-tabs) |
| **My Page** | Profile + nav to Security / Preferences / Connected Apps / About |
| *(footer)* Settings, Tools, network badge ("Mainnet" + green dot), lock | Persistent across all routes |

The Opticrum mockup currently uses a different left-rail decomposition: Balance / Channels / Peers / Runtime. The LN Wallet pattern suggests two options worth considering for future Opticrum iterations:

- **Promote Marketplace to a top-level left-rail item** rather than burying it as the Home route only.
- **Reorganize around user intent ("Node", "Wallet", "Me")** instead of around the underlying primitive ("Channels", "Peers", "Runtime"). Opticrum's current decomposition is technically honest; LN Wallet's is more user-facing.

---

## 2. Window chrome

LN Wallet is rendered as a desktop application window with standard controls (minimize / maximize / close) in the top-right and the brand mark + product name "LN Wallet" in the top-left. The Opticrum mockup currently omits a top bar entirely (a deliberate decision in `docs/superpowers/specs/...` — "no top bar"). Both are valid; LN Wallet's chrome makes the app feel more like a native desktop binary, Opticrum's omission keeps the visual real estate for content. If Opticrum ever wraps in an Electron/Tauri shell, this is the one screen where a top bar might earn its keep.

---

## 3. Color system

### Light theme
- **App background:** white / very pale gray (#f7f8fa-ish), cards sit on white with hairline borders.
- **Brand purple:** vibrant indigo `#5b4dff`-ish used for active sidebar item, hero gradient, and accent fills.
- **Action blue:** `#3b82f6`-ish used for primary buttons ("Open", "Send Payment").
- **Status colors:** green `#16a34a`-ish for positive deltas and "Mainnet" dot; red `#dc2626`-ish for negative deltas; amber/orange for warn.
- **DApp icons:** deliberately varied brand colors (yellow Bolt.fun, green LnMarkets, purple Zebedee, orange Stacker News) — these are brand-as-supplied, not part of the system palette.

### Dark theme
- **App background:** near-black `#0d0d12`-ish.
- **Surfaces (cards):** `#1a1a24`-ish, slightly lifted from the page.
- **Brand purple:** same hue family, slightly more saturated for dark-mode contrast.
- **Action blue:** lighter, more cyan-leaning blue for legibility on dark.
- **Status colors:** desaturated — green and red shift toward `#34d399` / `#f87171` for AA contrast.

### Token system comparison

| | LN Wallet | Opticrum mockup |
|---|---|---|
| Brand hue | Indigo / purple `#5b4dff` | Teal `#0f766e` / `#2dd4bf` |
| Neutrals | Cool slate | Warm slate |
| Surface elevation | Cards via lighter fill on bg | Cards via lighter fill on bg (same pattern) |
| Status colors | Green / red / amber | Green / amber / red (same pattern) |
| Theme parity | Both themes fully finished | Both themes fully finished |

The Opticrum palette decision (teal + slate, no purple gradients) is documented in the design spec as an explicit anti-pattern to avoid ("Avoid purple gradients, generic glassmorphism stacks"). Don't import LN Wallet's purple wholesale — but the *technique* (single accent hue, dual-theme parity, lifted card surfaces) transfers cleanly.

---

## 4. Typography

LN Wallet uses a clean modern sans-serif throughout. Hierarchy is built from three levers stacked: weight (regular / 600 / 700), size (11 / 12 / 14 / 16 / 20 / 24+), and color (text / secondary / accent). No decorative or display fonts. The Opticrum mockup follows the same discipline via the system-font stack declared in `styles/tokens.css` (`Segoe UI, PingFang SC, Hiragino Sans GB, Noto Sans SC, sans-serif`).

Numbers (balances, BTC amounts, latency counts) are rendered **bolder and slightly larger** than surrounding labels — Opticrum's `.metric` (20px / 700 / -0.02em letter-spacing) is the same idea. Worth keeping in mind when designing new KPI cards.

---

## 5. Component vocabulary

The LN Wallet screens reuse a small, predictable set of building blocks. The Opticrum mockup's current vocabulary already maps onto most of them; below is a side-by-side.

| LN Wallet pattern | Where | Opticrum equivalent |
|---|---|---|
| KPI card grid (3-up: Total Capacity / Local / Inbound) | Lightning Node → Overview | `.detail-grid` + `.card` (in `BalanceDetail`, `ChannelsDetail`, `NodeDetail`) |
| Donut/ring chart with legend breakdown | Lightning Node → Overview | None yet — would need a chart lib or inline SVG |
| Tab strip ("UTXOs (8) / History") with active underline | Wallet → On-chain Assets | None yet — would be a new `.tabs` component |
| Two-column dashboard (main content + narrow status sidebar) | Marketplace (main + LN Status) | AppShell (left rail + center + right rail) |
| DApp card (icon left, name+blurb, primary action right) | Marketplace "All DApps" | `.app-card` in `components/AppGrid.tsx` |
| Status pill (Connected / Active / Inactive) with color | Channels, Peers tables | `.badge` in `app.css` (state-aware color) |
| Hero banner with gradient + 3D illustration + pagination dots | Marketplace top | `components/Banner.tsx` (auto-rotating, accent-gradient) |
| Category chip row (icon + label, active filled) | Marketplace categories | `.chip` + `.chip.active` in `app.css` (text-only currently) |
| Settings row (label left + control right, divider lines between rows) | Settings | Not yet present — pattern to copy when adding Settings screen |
| Avatar + name + sub-line + chevron | My Page | Not yet present |
| Window controls (min/max/close) in top-right | Window chrome | Not present (no top bar) |
| Footer status indicator ("● Mainnet") + lock icon | Sidebar footer | Not present — but the current `footer-toggles` row is the right place |

---

## 6. Layout & grid

LN Wallet's primary screens follow a **two-column inside the main panel** pattern: main content on the left, narrow status/news panel on the right (~340 px in the Marketplace). The Opticrum mockup already does this at the *shell* level (`.app-shell { grid: 260px minmax(0,1fr) 300px }`). LN Wallet places its right column inside the route, not at the shell — meaning different routes can have different right-rail content. Worth considering: when Opticrum adds new routes (e.g., `/apps/:id` already replaced the right rail with center detail), it follows this pattern naturally.

Card spacing: 8 / 12 / 16 / 24 px rhythm. No card ever directly touches another — there's always 8–12 px of gutter. Matches Opticrum's `gap: 12px` on `.sidebar-stack` and `.app-grid`.

---

## 7. Specific screens worth borrowing

### Marketplace (top of image)

- **Hero with 3D isometric illustration** — Opticrum's current `Banner` is a flat gradient with text. Adding isometric / 3D-style illustrations (or even flat geometric placeholders) would feel more "storefront" per the Opticrum design spec's "consumer wallet storefront, not enterprise admin console" intent.
- **Pagination dots** under the hero — Opticrum's `Banner` already has them.
- **Categories chip row** — Opticrum's `.chip` row is text-only with no icons; LN Wallet puts an icon *inside* a rounded square above each label. Adopting this pattern would make categories more scannable.
- **Right-rail status panel** — Live BTC amount, line chart, KPI list with delta indicators (green +2.45% / red −0.15%). Opticrum's `RightSidebar` already has a `kpi-grid` for network stats; add delta arrows + color when those numbers gain a "vs. 24h ago" axis.
- **"Recently Used" rail** — horizontal row of small app icons. Opticrum doesn't have this; could be added to the AppDetail or Home page footer for quick re-launch.

### Lightning Node → Overview

- **KPI 4-up** with monetary values. Opticrum's detail pages use 3-up; 4-up would fit a node overview's metric density.
- **Donut chart with side legend** — Opticrum has no charts. If charts ever land, this is the smallest viable one — no axes, just a 3-segment ring with a center label.
- **Node Info as a vertical key-value list** (Alias / Pubkey / Network / Version / Uptime). Opticrum's existing `.row` label:value pattern is the same thing.

### Lightning Node → Channels / Peers

- **Header KPI strip** above the table (Total / Active / Inactive / Pending). Opticrum's `ChannelsDetail` has this. Peers page should add the same (Total / Connected / Inactive).
- **Status pill column** at the right edge of each row. Opticrum already uses `.badge` for channel state — same pattern, identical placement.

### Wallet → HD Wallet

- **Wallet list rows with truncated mnemonic preview** + ellipsis menu. Opticrum has no HD wallet screen yet but the pattern (icon + name + sub-line + trailing menu) is a strong template for any list-of-items screen.

### Settings

- **Single-column settings list** with: label on left, control on right, full-width hairline divider between rows. Toggle switches (on/off), radio (Light/Dark), and dropdown (Currency/Language) all share the same row geometry. This is the cleanest settings pattern in the image and worth copying verbatim when Opticrum adds a settings screen.

---

## 8. Anti-patterns to avoid

These are present in LN Wallet but contradict the Opticrum design spec:

- **Purple gradient hero** — Opticrum explicitly bans purple gradients. If the hero evolves, keep teal/slate.
- **Generic glassmorphism / 3D blob backgrounds** — Opticrum bans these too.
- **Mixed icon styles in nav** — LN Wallet uses outline icons in the sidebar but filled icons for dApps (because they're brand-supplied). Opticrum's left rail currently uses no icons — if icons are added later, keep one consistent stroke style throughout.
- **Tiny "View all" links everywhere** — LN Wallet has "View all" links in three places (Popular dApps, News & Updates, Recently Used). Opticrum should keep these to ≤2 per screen.

---

## 9. Quick checklist for new Opticrum screens

When adding a new route, the LN Wallet screens above suggest this checklist:

1. Does the page have a **header KPI strip** (3 or 4 cards) above the main content? Add it if it does.
2. Does the page have a **narrow right-rail** for live status / news? Consider one if the data is read-only and time-sensitive.
3. Does any data have a **time delta**? Color it green for positive, red for negative, add a `+X.XX%` / `-X.XX%` label.
4. Are there **status pills** in tables? Use the existing `.badge.<state>` color system (`active` / `pending` / `closing` already defined in `styles/app.css`).
5. Are there **tabs** inside the page? Use a top tab strip with active underline (no rounded pill — that pattern fights the desktop aesthetic).
6. Are there **lists of items with a trailing menu** (wallet list, peer list)? Use a `flex space-between` row + trailing `⋯` icon button.

---

## 10. Reference screenshots in this analysis

The source image shows the following screens (top-to-bottom, left-to-right):

| # | Screen | Variant |
|---|---|---|
| 1 | Marketplace | Light |
| 2 | Marketplace | Dark |
| 3 | Lightning Node – Overview | Light |
| 4 | Lightning Node – Channels | Light |
| 5 | Lightning Node – Send/Receive | Light |
| 6 | Lightning Node – Peers | Light |
| 7 | Wallet – Assets | Light |
| 8 | Wallet – HD Wallet | Light |
| 9 | Wallet – On-chain Assets | Light |
| 10 | My Page | Light |
| 11 | Settings | Light |

When in doubt, return to this image and the source files at `/Users/vimchain/Freelancer/fiber/opticrum-wallet/docs/superpowers/specs/2026-07-29-opticrum-desktop-mockup-design.md` together.