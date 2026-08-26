# Opticrum Desktop

A **local-first desktop wallet** for the [Fiber Network](https://github.com/nervosnetwork/fiber) on [CKB](https://github.com/nervosnetwork/ckb). It pairs a self-custodial CKB wallet with a **built-in Fiber node** (and optional external nodes) and the **Opticrum liquidity marketplace** — a decentralized market where CKB holders earn yield by renting out channel capacity.

Opticrum Desktop is a [Tauri 2](https://v2.tauri.app/) application. The interface runs in the OS WebView; every wallet, channel, node, and liquidity operation runs as native Rust inside the host process. There is **no backend server** for the core experience — the app talks to CKB and Fiber directly, persists locally to SQLite, and only leaves the machine when the chain requires it.

The landing page is the **node console**. Closing the window hides it to the system tray; the embedded Fiber node keeps running until you quit from the tray.

## Highlights

- **Local-first by design.** Wallet, channels, node, and liquidity logic all run on-device as an embedded Rust library. No account, no hosted API, no data leaving your machine beyond the chain itself.
- **A real embedded Fiber node.** Start, stop, configure, and watchtower a Fiber node in-process, with live peers, channels, invoices, and a streaming log console. You can also attach **external Fiber RPC** targets and hot-switch the shared client without stopping the built-in process.
- **A live liquidity market, rendered.** Orders and matches are real on-chain cells, scanned and priced live. The market is drawn as a pool of floating cells — each encodes dwell age, remaining rent, and health at a glance — with a detail drawer for the full picture.
- **Wallet chain ≠ node chain.** The CKB wallet can hot-switch mainnet / testnet (same keys, re-encoded `ckb1…` / `ckt1…` addresses) independently of the Fiber node's chain. On-chain actions stay gated when the two disagree, or when the selected node is down.
- **Fast by construction.** Transaction history is backed by an on-chain trace-back cache in SQLite: confirmed transactions are immutable, so each refresh only re-traces *new* activity. Personal liquidity orders are cached the same way until you refresh.
- **Disciplined craft.** Two finished themes, two languages, a clippy-clean Rust core, and an offline unit-test suite.

## Features

### CKB Wallet

- Hierarchical-deterministic keys (BIP44, CKB coin type `309`), with a keystore encrypted with **AES-256-GCM** and key material held in RAM only while unlocked.
- Create, import mnemonic, or import a private key. Receive and send CKB; the transaction list derives each tx's direction and amount from its actual on-chain inputs and outputs (including Fiber channel and Opticrum rent activity).
- **Mainnet / testnet switch** in the wallet drawer — no re-entry of the mnemonic. Caches are partitioned by chain.
- **Trace-back cache.** Resolved transaction data is persisted to SQLite with a per-address "top" frontier. Refreshes read from the cache and stop at the newest previously-known transaction.

The wallet is a page-level drawer on the node console (not a standalone route). First launch is gated by a setup dialog.

### Fiber Node

- Start and stop the **built-in** node from the control panel, edit its config, and run it with a watchtower. Logs stream into a recessed console (built-in only).
- Attach **external** Fiber RPC endpoints (alias + URL, optional auth). Selecting one retargets `node.*` / `channels.*` and the liquidity node's pubkey; the built-in process and the tray status stay local.
- Peer grid with capacity feet; a right-hand channel drawer for gauges, open, and close. Connect / disconnect peers from the connection card.
- **Invoices** are signed by the selected node. Fiber *send* (pay an invoice) is still UI-only — there is no pay command on the IPC surface yet.
- Node-down and wallet/node **network-mismatch** gating: send / invoice, open / close channel, and liquidity writes are blocked; logs, start/stop, config, and peer management stay available.

### Liquidity Marketplace

Lives as a section tab on the node page (not a separate route). The TopBar chip is a **market overview** that follows the **wallet** CKB network — hover to load, click to refresh. On mainnet the market is shown as not yet open (contracts are not deployed) and scans are skipped.

- **Orders** — on-chain cells offering rent for inbound liquidity, priced by APY and rental term. Personal orders (`mine`) read from a SQLite cache until you refresh.
- **Matches** — orders fulfilled by real Fiber channels, accruing rent linearly over time. A **12-hour hesitation window** after matching: the buyer may only dump all rent; after the window they are committed (inject-only) and the seller may extract.
- Cells float on the field as the large background; publish / cancel / inject / withdraw / extract sit on the field. Click a cell for remaining rent, capacity, withdrawable, term, and the on-chain transaction.

## Architecture

```
app/   (React + TypeScript frontend — Vite, dev on :5174)
  │   invoke() — a documented <domain>.<verb> IPC surface
  ▼
src-tauri/   (Tauri 2 shell — thin command handlers, tray, fnn-cli / open-url)
  │
  ▼
core/   (opticrum-wallet-core — the Rust brain, embedded as a library)
  ├── backend/    domain backends behind traits (Wallet, Liquidity, Node, Channels)
  ├── chain/      ChainProvider + NetworkController (mainnet / testnet hot-swap)
  ├── wallet/     HD derivation, AES-256-GCM keystore, address + signing
  ├── node/       embedded Fiber node (fnn), external targets, logs, channels
  ├── db/         Diesel + SQLite — wallets, tx trace-back, personal-order cache
  └── wire/       the IPC wire types shared with the frontend
```

The desktop app is **Tauri-only**. The runtime mock layer is gone: every command is served by the real backends over `invoke`. `app/` on `:5174` in a plain browser is useful for layout work; wallet / node / liquidity calls need the native shell.

**Reads through a cache, writes through the chain.** Wallet history and personal-order reads resolve confirmed data from SQLite; every write (send CKB, publish, cancel, inject, withdraw, extract) is assembled, signed, and broadcast to CKB, resolving only once the transaction confirms on-chain.

IPC domains: `wallet` · `node` · `channels` · `liquidity` · `app` (locale + exit). The contract lives in [`docs/ipc/ipc-api.md`](docs/ipc/ipc-api.md).

## Project Layout

```
opticrum-wallet/
├── app/             # live frontend — Vite + React + TypeScript
├── core/            # opticrum-wallet-core — backends, wallet, node, chain, db
├── src-tauri/       # Tauri 2 Rust shell — commands, tray, window config
├── DESIGN.md        # visual spec — required reading for UI work
├── docs/            # specs + IPC contract (docs/ipc/ipc-api.md)
└── package.json     # orchestration — tauri:dev, tauri:build, clippy
```

Window: identifier `com.opticrum.wallet`, product name **Opticrum Desktop**, default 1440×900, minimum 1100×700 (desktop-only).

## Getting Started

### Prerequisites

- Rust (stable, edition 2021; the shell asks for 1.77.2+) and the platform build tools required by [Tauri 2](https://v2.tauri.app/start/prerequisites/)
- Node.js + npm
- **Local sibling checkouts.** This workspace currently uses path dependencies:
  - [`opticrum`](https://github.com/Opticrum/ckb-contract-script) and [`opticrum-sdk`](https://github.com/Opticrum/client-sdk) as siblings of this repo
  - [`ckb-cinnabar`](https://github.com/ashuralyk/ckb-cinnabar) two levels up (`../../ckb-cinnabar`)
  - a local [Fiber](https://github.com/nervosnetwork/fiber) checkout for `fnn` (fiber-lib) and `fiber-json-types` — paths are set in the workspace `Cargo.toml`

### Run the desktop app

```bash
npm install            # installs @tauri-apps/cli
npm run tauri:dev      # Vite on :5174 + native window
```

The dev loop starts the frontend and opens the desktop window pointed at it. Changes in `app/` hot-reload; Rust changes rebuild on the next launch.

Data files (keystore, SQLite, node config, `node-targets.json`, panic log) live under the OS app-data directory. Default chain is **testnet**; override the initial fallback with `OPTICRUM_NETWORK=mainnet` or point RPC/indexer at your own nodes via `OPTICRUM_CKB_RPC_{TESTNET,MAINNET}` and `OPTICRUM_CKB_INDEXER_{TESTNET,MAINNET}`.

### Frontend-only, in a browser

```bash
cd app && npm run dev  # :5174 — UI only; IPC needs the Tauri shell
```

### Build the bundle

```bash
npm run tauri:build    # builds app/ then produces the OS bundle
```

### Checks

```bash
npm run clippy                      # cargo clippy --workspace --all-targets -- -D warnings
cd app && npx tsc -b                # frontend type check
cargo test -p opticrum-wallet-core  # offline unit tests

# Optional: real testnet acceptance (ignored by default)
cargo test -p opticrum-wallet-core --test acceptance -- --ignored --nocapture
```

Every Rust change should pass `cargo clippy` with no warnings.

## Tech Stack

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Rust), close-to-tray |
| Frontend | React 18 · TypeScript · Vite · plain CSS with design tokens |
| Routing / state | react-router-dom · no state manager · no UI kit |
| i18n | homegrown dictionary swap — `zh` default, `en`, typed `Messages` contract |
| Persistence | Diesel + SQLite (bundled), versioned migrations |
| Chain | ckb-cinnabar (RPC + indexer) · opticrum-sdk / opticrum-calculator |
| Node | embedded Fiber node (`fnn`) + optional external Fiber RPC |
| Crypto | secp256k1 · BIP39 · AES-256-GCM |

## Design Language

Two themes — dark (default) and light — built from CSS variables in `tokens.css` (slate neutrals, a teal accent). Both themes are first-class: no inline colors, every visual decision in a token. Text is bilingual by contract: every visible string must exist in `types.ts`, `zh.ts`, and `en.ts` together.

## Related Projects

- [opticrum](https://github.com/Opticrum/ckb-contract-script) — on-chain contracts, transaction assembly, and the liquidity protocol
- [opticrum-sdk](https://github.com/Opticrum/client-sdk) — pure-Rust client SDK (WASM, Uniffi, CLI)
- [rust-server](https://github.com/Opticrum/daemon-server) — the managed REST API + web console for the same protocol
- [Fiber Network](https://github.com/nervosnetwork/fiber) — payment channel network on CKB
- [CKB](https://github.com/nervosnetwork/ckb) — Nervos Common Knowledge Base
- [ckb-cinnabar](https://github.com/ashuralyk/ckb-cinnabar) — CKB contract / calculator framework
