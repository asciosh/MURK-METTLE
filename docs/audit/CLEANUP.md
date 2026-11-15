# Repository consolidation audit

Baseline: `bee7752` (merged cosmetics PR #13), clean working tree. Cleanup branch: `codex/windows-cleanup`.

The complete tracked tree, static/dynamic imports, package scripts, Vite/TypeScript/Wrangler configuration, HTML/CSS selectors, model and photo manifests, mod package/generator/provenance, Rust `include_str!` resources, Tauri capabilities/packaging and Windows workflow were inspected before source changes. No service worker or alternative production entry was found. The latest direct instruction removes Android/mobile support; it overrides the pasted checklist's request to preserve Android controls. Windows 10/11 with keyboard/mouse is the supported player target, through desktop browsers or the existing Tauri host. The Cloudflare web build remains first class.

## Classification and decisions

| Classification | Finding and evidence | Decision |
| --- | --- | --- |
| Confirmed unused | Entire `src/game/` legacy client (19 files). `index.html` → `src/main.ts` → `src/client/game/Game.ts`; no active code imports the old tree. These are old implementations, not compatibility re-exports. Old CloudSave has no boot hook or matching UI. | Remove old tree. Canonical ProgressStore/account compatibility code retained. |
| Confirmed unused | `worker/{index,account,room,profile}.mjs`. Wrangler main and all tests use `server/cloudflare`; references in old testing instructions are historical. | Remove old Worker copies. Preserve canonical classes, exports, bindings and migrations byte for byte. |
| Duplicate / obsolete | `server/index.mjs` and `server/local/index.mjs` are identical 96-line prototype servers. Only the `server` npm script points to one; neither implements accounts/current room protocol. Full local development already uses Wrangler. | Remove both; redirect `npm run server` to the complete local Worker command. |
| Confirmed unused | `src/client/game/VisualDetail.ts` has no live inbound import; only deleted legacy actors used this decoration implementation. Current actors author their own geometry. | Remove unused decoration helper. |
| Duplicate | Root `TESTING-v0.13.1.md` exactly matches `docs/TESTING-v0.13.1.md`. | Keep one archived copy; update its index. |
| Removed by requested platform change | TouchControls, joystick rules/types, touch CSS, control-mode selector, mobile graphics profile and touch-only HUD polling. | Remove; preserve PC journal as independent UI, keyboard/mouse semantics, reduced-motion and small desktop-window resizing. Map old local Mobile preference to Performance. |
| Actively required | Browser boot, canonical client/Worker, shared rules, authenticated local Wrangler, Tauri launcher/host/policy, optional Cinematic chunk and dev profiler. | Keep. Extract graphics lifecycle from oversized Game without moving gameplay rules. |
| Actively required, dynamic | Survivor GLB/manifest, optional pinned CC0 photo URLs, Copperbloom model/icon/LICENSE/provenance/public ZIP, validation worker and lazy preview, desktop icons/art/network banner, browser gallery HTML. | Keep every asset and license record. Dynamic asset and import contracts covered by regression tests. |
| Potentially unused / compatibility-sensitive | `PlayerProfile` class looks unreachable through today's router but is a deployed SQLite Durable Object with old save keys. Account normalization and legacy collection/save keys protect existing users. | Keep class/export, binding, migration and compatibility code. No database changes. |
| Generated / archival | dist/node_modules/Tauri target and generated permissions/schemas are ignored, none tracked. Historical version notes, changelogs and performance JSON are evidence rather than active setup instructions. | Retain history, group old setup/testing under docs/archive, index separately from current instructions. |

## Dependencies

`three` is used by rendering, demo production and browser fixtures; `typescript`, `@types/three`, `vite`, `wrangler` are active build tools. `ws` was used only by the removed Node prototype; `@types/ws` had no live typed consumer. Remove those two direct dependencies and regenerate the npm lock. Wrangler's own transitive `ws` may legitimately remain. The existing browser fixtures imported undeclared Playwright; add pinned dev-only `playwright` and a shared browser launcher so the checks are reproducible on Windows/Linux. Desktop npm/Rust dependencies are all used by the launcher, scoped host, URL policy or build; keep their locks unchanged.

## Baseline

`npm ci --cache /workspace/work/npm-cache` passed (66 packages); the initial default-cache invocation failed because the environment's home cache was unwritable. `npm test`: 63 passed. `npm run typecheck` and `npm run build`: passed. Existing build warning: Three core chunk >500 kB (624.12 kB). No baseline gameplay failures established. Windows native toolchain is unavailable in this Linux environment; native verification remains a Windows CI/manual check.

## Boundaries and risks

Game and World remain large orchestration/procedural modules. Graphics lifecycle is a useful cohesive extraction; deeper combat/room/account rewrites would increase cleanup risk. Keep `src/client/mods/` and `desktop/src-tauri/` at stable paths rather than moving for naming alone. Ordered CSS still has intentional historical base/presentation overrides; remove proven unreachable/mobile rules, retain the rest until computed-style evidence supports further consolidation. Historical benchmark JSON still contains the removed Mobile preset: those measurements must not be rewritten as Performance results.

See [current architecture](../ARCHITECTURE.md), [developer setup](../development/SETUP.md) and [validation/manual checklist](../development/TESTING.md). The cleanup changelog lists each deleted path and extraction.
