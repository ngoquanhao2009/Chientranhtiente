# Project Guidelines

## Code Style
- Keep this project dependency-free unless a change clearly requires a new library.
- Prefer small, focused functions and preserve existing vanilla JS + ES module style.
- Keep `data/*.json` as source-of-truth game content; avoid hardcoding values already in data files.

## Architecture
- `src/game.js` owns core game rules and state mutations (economy, shop, merge, combat, synergy).
- `src/ui.js` owns rendering and UI interactions (DOM paint, drag/drop, click/touch bindings).
- `src/app.js` bootstraps app startup, storage hydration, event wiring, and initial render.
- `src/storage.js` owns localStorage persistence and snapshot key/version handling.
- Keep data flow consistent: action -> game method -> `renderAll(game)` -> user feedback.

## Build And Test
- This is a static web app; there is no build pipeline or test runner.
- Run locally with a static server to avoid JSON import/CORS issues:
  - `npx serve .`
- Direct file open of `index.html` may work in some browsers, but prefer server-based run during development.

## Conventions
- Preserve save compatibility expectations in `src/storage.js` (`SNAPSHOT_VERSION` and save key `cttt_save_v7`).
- Keep board/bench semantics intact (`board` has 9 slots, `bench` has 8 slots).
- Maintain drag/drop payload format `"{kind}:{index}"` and related `data-*` attributes used by UI handlers.
- Keep combat and synergy calculations in `src/game.js`; avoid leaking game rules into UI layer.
- Boss rounds are every 5 rounds (`round % 5 === 0 && round > 0`); preserve this behavior unless intentionally changing design.

## Documentation
- Project overview, quick play, and deploy steps are documented in [README.md](README.md).
- Follow link-not-embed: add deeper docs only when needed, and reference them here instead of duplicating long content.