# AGENTS.md

## Learned User Preferences

- **`mockup/` is a frozen visual reference — never modify it.** The live frontend is `app/` (byte-for-byte port of mockup). All new UI work happens in `app/`; use `mockup/` only for reading/diffing.
- Prefer Vite + React + TypeScript for the frontend (`app/`); **Tauri 2** (`src-tauri/`) for the desktop shell; **Rust** for all wallet/chain logic.
- Keep framework scaffolding thin; spend effort on page UI/content and on the data layer (mock → IPC).
- Brand the product as Opticrum Desktop; support Chinese/English UI with a language toggle.
- Use dual light/dark themes with the soft fintech visual language in `DESIGN.md` (**slate neutrals + teal accent**, default dark). *(Supersedes the earlier "royal blue accent" note.)*
- **No top bar.** Brand + theme + language toggles live where the design says (left sidebar brand, footer toggles). *(Supersedes the earlier "top bar" note — the redesign removed it.)*
- Detail pages replace the center panel only; `LeftSidebar` stays mounted and `RightSidebar` shows node/network context. *(Supersedes the earlier "no right sidebar" note.)*
- **Local-first desktop wallet:** no backend server for wallet/channels/node/liquidity — Rust is embedded in the Tauri host and reached via IPC (`invoke()`). The **app marketplace is the only networked part** (plain `fetch` to a remote catalog).
- **All UI changes must actively reference `DESIGN.md`.** Before editing layout, styling, copy placement, or visual hierarchy in `app/`, read the relevant sections of `DESIGN.md` and align implementation with that spec; do not rely on memory or ad-hoc guesses.

## Learned Workspace Facts

- `opticrum-wallet` is a Fiber desktop wallet + app marketplace, now a Tauri 2 desktop app: `mockup/` (frozen reference) + `app/` (live frontend) + `src-tauri/` (Rust shell).
- Dev ports: **mockup = 5173, app = 5174** (kept distinct). `npm run tauri:dev` opens the desktop window and auto-starts `app/`'s vite; `npm run mockup:dev` runs the reference in a browser.
- Tauri identity: identifier `com.opticrum.wallet`, productName "Opticrum Desktop", window min 1100×700 (desktop-only layout). Config: `src-tauri/tauri.conf.json`.
- `src-tauri/src/lib.rs` registers a `hello` smoke-test IPC command. Next layers (in order): frontend transport module in `app/` (`api.ts`, mock + `invoke()` impls, verify with `hello`), then a `opticrum-wallet-core` Rust crate (extract `rust-server`'s wallet/keystore/signer + reuse `opticrum-sdk` + local SQLite), then swap `app/src/mock/` imports module-by-module.
- The parent monorepo already has the Rust building blocks: `opticrum-sdk` (chain interaction, orders/matches/dashboard, generic over `T: RPC`, unsigned-tx API — no key management) and `rust-server` (HD wallet BIP39/32/44, AES-256-GCM keystore, SQLite, Fiber RPC client, chain cache) — all reusable/embeddable.
- Network overview (全网概况) lives on the node detail page, not a persistent sidebar.
- News and changelogs are center-panel pages linked from the marketplace home.
