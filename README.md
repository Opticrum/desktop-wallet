# Opticrum Desktop

A **local-first desktop wallet** for the [Fiber Network](https://github.com/nervosnetwork/fiber) on [CKB](https://github.com/nervosnetwork/ckb). It pairs a self-custodial CKB wallet with a **built-in Fiber node** and the **Opticrum liquidity marketplace** — a decentralized market where CKB holders earn yield by renting out channel capacity.

Opticrum Desktop is a [Tauri 2](https://v2.tauri.app/) application. The interface runs in the OS WebView; every wallet, channel, node, and liquidity operation runs as native Rust inside the host process. There is **no backend server** for the core experience — the app works against the chain directly, persists locally to SQLite, and only talks to the network when the chain requires it.

## Highlights

- **Local-first by design.** Wallet, channels, node, and liquidity logic all run on-device as an embedded Rust library. The app marketplace is the only networked component — a plain fetch to a remote catalog. No server to run, no account, no data leaving your machine beyond the chain itself.
- **A real embedded Fiber node.** The node isn't a stub or a remote proxy — a Fiber node runs inside the app, controllable from a native panel (start / stop / config / watchtower), with live peers, channels, and a streaming log console.
- **A live liquidity market, rendered.** Orders and matches are real on-chain cells, scanned and priced live. The market is drawn as a pool of floating cells — each encodes dwell age, remaining rent, and health at a glance — with a detail drawer for the full picture.
- **Fast by construction.** Transaction history is backed by an on-chain trace-back cache in SQLite: confirmed transactions are immutable, so each refresh only re-traces *new* activity, not the entire history.
- **Disciplined craft.** A frozen visual reference, a written design spec, two themes, two languages, and a clippy-clean Rust core with a fully offline test suite.

## Features

### CKB Wallet

- Hierarchical-deterministic keys (BIP44, CKB coin type `309`), with a keystore encrypted with **AES-256-GCM** and key material held in RAM only while unlocked.
- Receive and send CKB; the transaction list derives each tx's direction and amount from its actual on-chain inputs and outputs.
- **Trace-back cache.** Resolved transaction data is persisted to SQLite with a per-address "top" frontier. Refreshes read from the cache and stop at the newest previously-known transaction — so history loads in a fraction of the RPC work as the chain grows.

### Built-in Fiber Node

- Start and stop an embedded Fiber node from the control panel, configure it, and run it with a watchtower.
- Live peer list with expandable channel rows — capacity, local/remote balance, state — plus one-click channel open / close and peer connect / disconnect.
- A streaming log console that mirrors the node's runtime output.

### Liquidity Marketplace

- **Orders** — on-chain cells offering rent for inbound liquidity, priced by APY and rental term.
- **Matches** — orders fulfilled by real Fiber channels, accruing rent linearly over time.
- A per-tab KPI dashboard (total demand, average APY, dwell time, deposits, exhaustion horizon) beside a pool of animated order/match cells whose faces encode dwell age and remaining rent.
- Click a cell for a detail drawer: remaining rent, capacity, withdrawable, rental term, and the on-chain transaction (click to copy). Actions — cancel, inject, withdraw, extract rent — all resolve once the transaction confirms on-chain.

### App Marketplace

- A catalog of applications, news, and changelogs served as remote content — the one part of the app that is networked by design.

## Architecture

```
app/   (React + TypeScript frontend — Vite, dev on :5174)
  │   invoke() — a documented <domain>.<verb> IPC surface (~30 commands)
  ▼
src-tauri/   (Tauri 2 shell — thin command handlers, no business logic)
  │
  ▼
core/   (opticrum-wallet-core — the Rust brain, embedded as a library)
  ├── backend/    domain backends behind traits (Wallet, Liquidity, Node, Channels)
  │               each has a real implementation and an in-memory mock
  ├── chain/      ChainProvider abstraction — real RPC vs. test doubles
  ├── wallet/     HD derivation, AES-256-GCM keystore, address + signing
  ├── node/       embedded Fiber node (fnn), config, log ring
  ├── db/         Diesel + SQLite — wallets, tx trace-back cache, migrations
  └── wire/       the IPC wire types shared with the frontend
```

**Three parts, one source of truth.** `mockup/` is a frozen static reference that fixes the visual layout and copy. `app/` is the live frontend, a byte-for-byte port of that reference. `src-tauri/` and `core/` are the thin shell and the embedded logic behind it. All UI work is measured against `DESIGN.md`, a written high-fidelity spec (layout, tokens, spacing, typography, component anatomy).

**Mock and real, side by side.** Every backend has a real implementation (live CKB RPC / indexer, embedded node) and an in-memory mock. The IPC surface is identical for both — which is how the entire app works in a plain browser (`OPTICRUM_BACKEND=mock`), and how the real paths are tested offline.

**Reads through a cache, writes through the chain.** Wallet history and liquidity reads resolve confirmed data from SQLite; every write (publish, cancel, inject, withdraw, extract) is assembled, signed, and broadcast to CKB, resolving only once the transaction confirms on-chain.

## Project Layout

```
opticrum-wallet/
├── app/             # live frontend — Vite + React + TypeScript
├── core/            # opticrum-wallet-core — backends, wallet, node, chain, db
├── src-tauri/       # Tauri 2 Rust shell — commands, window config
├── mockup/          # frozen visual reference (never modified)
├── DESIGN.md        # visual spec — required reading for UI work
├── docs/            # specs + IPC contract docs (docs/ipc/ipc-api.md)
└── package.json     # orchestration — dev, build, clippy
```

## Getting Started

### Prerequisites

- Rust (stable) + the platform build tools required by [Tauri 2](https://v2.tauri.app/start/prerequisites/)
- Node.js + npm

### Run the desktop app

```bash
npm install            # installs @tauri-apps/cli
npm run tauri:dev      # Vite on :5174 + native window
```

The dev loop starts the frontend dev server and opens the desktop window pointed at it. Any change to `app/` hot-reloads; Rust changes rebuild on the next launch.

### Frontend-only, in a browser

```bash
cd app && npm run dev  # :5174 in a plain browser (uses the in-browser mock)
```

For the frozen visual reference, `npm run mockup:dev` serves `mockup/` on `:5173`.

### Build the bundle

```bash
npm run tauri:build    # builds app/ then produces the OS bundle
```

### Checks

```bash
npm run clippy                    # cargo clippy --workspace --all-targets -- -D warnings
cd app && npx tsc -b              # frontend type check
cargo test -p opticrum-wallet-core  # offline Rust test suite
```

## Tech Stack

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Rust) |
| Frontend | React 18 · TypeScript · Vite · plain CSS with design tokens |
| Routing / state | react-router-dom · no state manager · no UI kit |
| i18n | homegrown dictionary swap — `zh` default, `en`, typed `Messages` contract |
| Persistence | Diesel + SQLite (bundled), versioned migrations |
| Chain | ckb-cinnabar (RPC + indexer) · opticrum-sdk / opticrum-calculator |
| Node | embedded Fiber node (`fnn`) |
| Crypto | secp256k1 · BIP39 · AES-256-GCM |

## Design Language

Two themes — dark (default) and light — built from CSS variables in `tokens.css` (slate neutrals, a teal accent). Both themes are first-class: no inline colors, every visual decision in a token. Text is bilingual by contract: every visible string must exist in `types.ts`, `zh.ts`, and `en.ts` together.

## Related Projects

- [opticrum](https://github.com/nervosnetwork/fiber) — on-chain contracts, transaction assembly, and the liquidity protocol
- [opticrum-sdk](https://github.com/nervosnetwork/fiber) — pure-Rust client SDK (WASM, Uniffi, CLI)
- [rust-server](https://github.com/nervosnetwork/fiber) — the managed REST API + web console for the same protocol
- [Fiber Network](https://github.com/nervosnetwork/fiber) — payment channel network on CKB
- [CKB](https://github.com/nervosnetwork/ckb) — Nervos Common Knowledge Base
