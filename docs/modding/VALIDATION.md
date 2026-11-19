# Creature cosmetics v1 · validation record

The change is based on the merged Windows host and graphics/UI/combat/world/performance work. No server, multiplayer message types, account/progression schemas, Cloudflare configuration or Tauri capabilities changed.

Passed:

- `npm test`: **63 tests**, including ten adversarial package/model/image cases and the existing server-authority/account/room regressions.
- `npm run typecheck` and `npm run build`. The existing large Three.js core-chunk warning remains; no warning limit was hidden or relaxed.
- JSON-schema validation of the original demo manifest and SHA-256 agreement with its actual GLB/provenance record.
- `node tests/browser/mods.cjs`: actual Game/Companion/CoopVisuals integration, import/preview, local enable/disable/restore/removal, reload persistence, missing-clip idle/static fallback, corrupt cached-mod fallback, late-preview cancellation, shared geometry, inert metadata text and full license viewing.
- PC layouts at 1366×768 and 1920×1080; Pixel 7 touch emulation at 390×844 and 844×390. Desktop and mobile preview screenshots were captured; desktop and mobile landscape were inspected after layout corrections. These are browser/emulation checks, not physical-device results.
- Existing interface, character and combat/audio browser fixtures passed with no reported page errors.
- `GAME_URL=http://localhost:8788 node tests/browser/mods-production.cjs` against a fresh isolated local Wrangler Worker serving the production build: fingerprinted validation-worker/preview chunks, original demo download, enable, restore and removal passed. Account requests were stubbed; no production account writes occurred. This smoke fixture keeps the title scene idle and hides its cover to verify production asset delivery without software-rendered gameplay load.

The browser used Chromium 156 / ANGLE SwiftShader on Linux. No Windows/Android hardware FPS, thermal or memory-byte claim is made.

## GPU resource ownership check

A separate real WebGL renderer exercised an original companion and a textured variant of the original demo:

| State | Tracked geometries | Tracked textures |
| --- | ---: | ---: |
| Official actor baseline | 17 | 1 |
| Textured cosmetic enabled | 27 | 2 |
| Cosmetic disabled | 17 | 1 |
| Actor disposed | 0 | 1 |
| Renderer disposed | 0 | 0 |

The baseline texture is Three.js's internal DFG lighting lookup; it belongs to the renderer. Mod geometry/maps return to baseline on disable, image bitmaps are closed, and full renderer teardown leaves zero tracked resources. Counts are resource counts, not GPU memory bytes or a performance benchmark.

The isolation fixture renders the same official peer state with and without a local registry. Only the mod-enabled client uses its replacement. The peer snapshot, official species ID, player collection, creature power and bonding result remain unchanged. This is a renderer/isolation fixture plus existing authoritative room tests, not a live four-browser expedition.

## Still manual

- Actual Android and WebView2 operating-system file chooser flows (Playwright supplies selected files directly), storage permissions/quota behavior and repeated real imports.
- Full co-op play with three PC clients and one Android client, including a player with no installed pack. Inspect actual WebSocket frames/cloud saves for official IDs and no cosmetic payloads.
- Windows fullscreen/focus/pointer-lock recovery and physical phone rotation/touch behavior while the manager is open.
- Sustained device rendering with large permitted packs, all stages/species, and quality switching. M04-C9 adds a strict skeletal subset; arbitrary rigs, morphs and extensions remain unsupported. Run the new original-rig solo and room browser tests before acceptance.

The game-dev CLI was not available. The demo was authored with original source code, validated from real bytes, parsed by Three.js and rendered in-browser; it is not a sealed game-dev asset package or a professional skeletal rig.
