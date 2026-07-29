## Learned User Preferences

- Prefer Vite + React + TypeScript for the static wallet mockup under `mockup/`.
- Keep framework scaffolding thin; spend effort on page UI/content because the mockup will change often.
- Brand the product as Opticrum Desktop; support Chinese/English UI with a language toggle.
- Use dual light/dark themes with the soft fintech visual language in `DESIGN.md` (royal blue accent, default dark).
- Use a top bar for brand and main navigation; theme and language toggles live in the top bar.
- Secondary detail pages replace the center panel only; no right sidebar.
- **All UI changes must actively reference `DESIGN.md`.** Before editing layout, styling, copy placement, or visual hierarchy in `mockup/`, read the relevant sections of `DESIGN.md` and align implementation with that spec; do not rely on memory or ad-hoc guesses.

## Learned Workspace Facts

- `opticrum-wallet` is a Fiber desktop wallet + app marketplace front-end mockup (realistic predefined fake data).
- Main shell is a top bar plus full-width center content area (no right sidebar).
- Network overview (全网概况) lives on the node detail page, not a persistent sidebar.
- News and changelogs are center-panel pages linked from the marketplace home.
