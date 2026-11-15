# Architecture

## Application entries and build targets

`index.html` loads `src/main.ts`, which imports the ordered CSS, initializes account/focus/menu behavior and dynamically imports `src/client/game/Game.ts` after authentication. Vite produces root `dist/`; model/demo files in `public/` retain their paths. No service worker or offline game bundle is present.

`wrangler.jsonc` points to `server/cloudflare/index.mjs`, which serves `/api/account/*` and authenticated `/room` WebSockets before static assets. `server/cloudflare/{account,room,profile}.mjs` export the three existing Durable Object classes. The same Worker runs locally: there is no second Node implementation to maintain. Vite's source development proxy forwards API and room requests to local Wrangler.

`desktop/ui/index.html` → `desktop/ui/main.ts` is the separate Vite launcher. `desktop/src-tauri/src/main.rs` → `app.rs` builds the Windows host, using `policy.rs` and `desktop/deployment.json`. The game is the top-level trusted HTTPS document, so its relative API/WS URLs and secure session cookies retain same-origin behavior. `desktop/dist/` is launcher output only, never Cloudflare's asset directory. Keep the independent locks and desktop-relative `src-tauri` path.

## Client boundaries

- `Game` coordinates simulation/actions, camera constraints, authoritative events and HUD updates. It owns actors and calls their teardown. It remains intentionally substantial; combat/economy logic was not redistributed during cleanup.
- `rendering/FieldGraphics` owns atmosphere, sunlight/environment targets, desktop quality rendering, asynchronous Cinematic loading/generation guards, resizing and teardown. It receives the presentation camera; gameplay rays still use Game's original camera.
- `game/World` and its existing detail/material/batch modules generate flat visual terrain, spatial instance groups, habitats and landmarks. Shared coordinates/collision/navigation remain in `shared/expansion.mjs` and `shared/survival.mjs`.
- `game/InputController` handles keyboard, mouse and pointer lock. Editing fields, open panels, blur, hidden tabs and capture loss clear/guard gameplay actions.
- `ui/FieldJournal` temporarily relocates existing live HUD panels using placeholders. It restores the exact nodes on close/dispose. It has no gameplay state and no touch input dependency. Interface focus trapping and menu/backpack/account/mod coordination use the same journal selectors.
- `game/AnimationController` owns reference-counted GLB sources and per-actor animation/material state. Procedural fallbacks, original survivor clips and the five creature species/forms remain.
- `mods/` validates untrusted local packages in a bounded static worker before GLTF parsing, then uses separate IndexedDB and per-instance leases. Models cannot change shared combat, ownership, progression, saves or protocol. See the [mod guide](modding/README.md).
- `debug/PerformancePanel` is imported only in development with `?perf=1`. It reports observed arrival age/jitter rather than fabricated RTT.

## Persistence and security invariants

The Worker, account/room/profile implementation, all binding/class names, migration tags `v1/v2/v3`, storage keys, account schema, origin checks and session behavior are unchanged. Keep `PlayerProfile` even though the current router does not expose the old backup API: its deployed class/binding/migration is compatibility history. Client collection normalization and old progress keys also remain.

Cosmetic cache and graphics preferences are device-local, outside cloud account saves. The retired `mobile` graphics preference maps to `low` (Performance), preserving its explicit photo-material choice; new desktop sessions default to Balanced. No mobile device detection or touch-control override remains.

Remote WebView content receives no Tauri capabilities. Only the local launcher can invoke its fixed no-argument launch command. No new native permissions, filesystem scans, URLs or authentication shortcuts were added.

## Styles, assets and evidence

CSS order: foundation → components → screens → polish → botanical → mods. The first files contain established structural bases; botanical supplies shared tokens/final presentation. Proven dead welcome-card and phone/touch rules are removed. Further cascade consolidation requires screenshots and computed-state coverage; overrides alone do not prove a rule dead.

Public GLB/manifest/demo ZIP, external pinned CC0 photo manifest, source mod assets/LICENSE/provenance, desktop icons/SVG and gallery HTML have dynamic consumers. Keep them even if a TS import scanner misses them. The `tests/repository-contracts.test.mjs` graph/asset checks supplement model/mod security tests.

Generated `dist`, caches, dependencies and Tauri `target/gen` remain ignored. Historical documents/benchmark JSON are evidence, not current setup or FPS guarantees. See [audit](audit/CLEANUP.md) and [test guide](development/TESTING.md) for remaining risks and acceptance checks.
