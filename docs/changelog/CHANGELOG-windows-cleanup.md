# Windows PC repository consolidation

Base: merged creature cosmetics `bee7752`. This is an architecture cleanup plus the requested removal of mobile support. Cloudflare accounts, Durable Object migrations, authoritative combat, XP/economy, five creatures/fifteen forms, mod format and Tauri native security are preserved.

## Before / after

- Two client implementations → one canonical `src/client/` implementation.
- Two Worker implementations and two obsolete Node prototypes → one complete `server/cloudflare/` runtime for local/hosted play.
- Journal mixed into a 257-line touch controller → independent `ui/FieldJournal` with the same live HUD nodes and keyboard behavior.
- Game-owned lighting/environment/Cinematic lifecycle → cohesive `rendering/FieldGraphics`, with async cancellation and idempotent cleanup. `Game.ts`: 1640 → 1549 lines; no gameplay-rule extraction or rebalancing.
- Touch controller/joystick/mobile polling/phone CSS/control-mode override/Mobile preset → mouse/keyboard desktop controls and Performance/Balanced/Cinematic. Retired local `mobile` preference maps to Performance; explicit photographic-surface preference remains.
- Undeclared Playwright imports and hard-coded Linux browser executable → pinned Playwright dev dependency, common cross-platform browser launcher and reproducible suite scripts.
- Windows `.cmd` subprocess launching in `scripts/dev.mjs` → direct Node tool entrypoints. Windows native startup still requires native acceptance; the script was smoke-tested on Linux.
- Scattered old setup/testing docs → indexed `docs/archive/`; current architecture, setup, testing and deployment guides under `docs/`. All version changelogs and original benchmark evidence remain.

## Deleted files and evidence

Each old `src/game/` module below was part of an internally linked older client; the actual boot/main, build and browser fixtures exclusively use `src/client/`. It was not a compatibility-export tree:

`Account.ts`, `AnimationController.ts`, `CloudSave.ts`, `Companion.ts`, `CoopProgress.ts`, `Crafting.ts`, `Expedition.ts`, `Game.ts`, `InputController.ts`, `Inventory.ts`, `Loot.ts`, `Minimap.ts`, `Multiplayer.ts`, `Player.ts`, `ProgressStore.ts`, `Progression.ts`, `VisualDetail.ts`, `World.ts`, `Zombie.ts`.

Other deletions:

| Paths | Reason |
| --- | --- |
| `worker/index.mjs`, `worker/account.mjs`, `worker/profile.mjs`, `worker/room.mjs` | Old parallel runtime; Wrangler and all tests use canonical `server/cloudflare`. Canonical implementations/migrations unchanged. |
| `server/index.mjs`, `server/local/index.mjs` | Identical unauthenticated 96-line prototypes incompatible with current accounts/expansion protocol. `npm run server` now runs the full Worker. |
| `src/client/game/VisualDetail.ts` | No active inbound reference; replaced actor decoration exists in current Player/Zombie. |
| `src/client/game/TouchControls.ts` | Requested touch support retirement; desktop journal extracted before deletion. |
| `shared/touch-rules.mjs`, `shared/touch-rules.d.mts` | Only joystick consumer removed. |
| `src/styles/touch.css` | Phone/touch layout retired; required journal foundation consolidated into botanical CSS. |
| `tests/mobile-motion.test.mjs` | Retired joystick/preset cases removed; leg/foot correctness tests preserved as `tests/actor-motion.test.mjs`. |
| Root `TESTING-v0.13.1.md` duplicate | Exactly duplicated the docs copy; keep one canonical archived text. |

Unused welcome-card CSS and obsolete phone-width/touch selectors were removed after checking markup and runtime selectors. No runtime model, texture, icon, license/provenance, demo ZIP or original asset-generation source was deleted. No tracked build artifacts were found; existing ignore rules are retained.

## Consolidated / moved documentation

- Root `CODESPACES-UPGRADE.md` → `docs/archive/CODESPACES-UPGRADE-v0.21.md` (historical overlay guide).
- One v0.13.1 testing document → `docs/archive/TESTING-v0.13.1.md`; duplicate removed.
- Version-specific `docs/V0.20-{REFACTOR,TESTING}.md`, `V0.22-TESTING.md`, `V0.23-TESTING.md`, `V0.24-TESTING.md`, `V0.25-{ASSETS,TESTING}.md`, `V0.26-TESTING.md`, `V0.27-{CHARACTERS,UI}.md` → same names under `docs/archive/` with archival notices. Local Markdown links updated/verified.
- Stable `src/client/mods/`, `desktop/src-tauri/` and world/material paths retained; no aesthetic mass move of live systems.

## Dependencies and regression protection

Removed direct `ws` and `@types/ws`, used only by the removed Node prototype. Added pinned dev-only `playwright` for existing real-browser fixtures; it is absent from client/Worker runtime bundles. Root lock regenerated; desktop npm/Cargo locks unchanged. Existing TypeScript/Vite/Wrangler/Three and desktop dependencies remain active.

Regression coverage now guards canonical paths, relative-import closure/reachability, dynamic model/mod/desktop assets, CSS order, local Markdown links, retired graphics preference fallback, keyboard/journal focus and graphics/mod teardown. Windows CI also runs on shared game source/assets/test changes; native capabilities/permissions are unchanged.

See [audit](../audit/CLEANUP.md) for classifications and retained risks, and [exact validation/manual checklist](../development/TESTING.md) for checks and limitations. Three's existing >500 kB core-chunk warning remains; removing dormant sources is not a measured FPS optimization.
