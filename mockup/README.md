# Opticrum Desktop Mockup

Static desktop wallet + app marketplace UI mockup for Fiber / Opticrum (Vite + React + TypeScript, fake data only).

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173 — use a wide viewport (≥1100px) to see left / center / right together.

```bash
npm run build   # tsc -b && vite build
```

## Routes (13)

The mockup organises content into four user-intent sidebar destinations. The center column swaps by route; the left and right sidebars stay mounted. Theme and language controls live in `/me` → `/settings`, not in the sidebar footer.

| Sidebar | Hub | Deeper routes |
|---|---|---|
| Marketplace | `/` | `/apps/:id`, `/news`, `/changelog` |
| Node | `/node` | `/channels`, `/peers`, `/runtime` |
| Wallet | `/balance` | `/wallet/hd`, `/wallet/onchain` |
| Me | `/me` | `/settings` |

Unknown paths redirect to `/`.

## Sidebar

Four `.sidebar-block` items grouped in `.sidebar-stack`. Each block shows a small uppercase label plus one key metric (count, total, or display name). Hover reveals the block's filled background; the active route gets an accent-soft fill plus a 3 px inset teal bar.

Active matching uses a `useLocation`-backed predicate per block so `/apps/foo` lights up Marketplace, `/channels` lights up Node, etc.

## Right rail

Only network-overview KPIs (4 numbers in a 2×2 grid). News and Changelog moved to dedicated routes (`/news`, `/changelog`).

## Mock data

`src/mock/` contains every fake dataset:
- `wallet.ts` — address, balance, transactions, **HD accounts** (2)
- `channels.ts` — channel list + summary
- `node.ts` — runtime KPIs + peers + log lines
- `network.ts` — aggregate network stats
- `news.ts` — **7 articles with full bilingual bodies**
- `changelogs.ts` — 5 versions
- `apps.ts` — 11 apps + 4 banners