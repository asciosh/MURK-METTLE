# v0.27 — The Visual Leap

Resume this branch, do not restart the upgrade. Base: `45b8e34` (merged Windows cleanup, PR #14). Branch: `codex/v0.27-visual-leap`. Release/PR version: **v0.27**. User merges; keep the eventual PR a source-only draft.

## Verified milestone 0 — baseline

- Inspected the current runtime, rendering/material/world systems, all actor builders, model manifest/GLB, presets, cosmetics, browser fixtures and cleanup documentation.
- Added repeatable real-Game captures plus frozen actor-gallery poses in `tests/browser/visual-leap.cjs`. 1366×768, DPR 1, Balanced, original local materials, seed 27027. No production accounts. `ARTIFACT_DIR=/workspace/work/visual-v027/before node tests/browser/visual-leap.cjs`.
- Baseline screenshots/counters: `/workspace/work/visual-v027/before/`. Images stay outside Git. Source fixtures are retained so baseline can be reproduced on this checkpoint.
- Visually inspected forest, settlement, wetland and Lanternkin. Five weaknesses: broad brown ground texture; uniform canopy silhouettes; flat light/ambient balance; repetitive facades; creature faces obscured by primitive petals (especially Lanternkin).
- Baseline `npm test`: 67 passing. `npm run typecheck`: passed.
- Survivor GLB remains original node animation/equipment, **not a skeletal rig**. Preserve compatible equipment loading and procedural fallback.

## Pending milestones

1. Environment/material/lighting showcase pass. Validate typecheck + world/browser captures; inspect before/after; commit this log with source.
2. Rebuild creature meshes and expressive animation, prioritizing Lanternkin and keeping all 15 forms/mod contracts. Validate lifecycle/actor/mod tests; commit.
3. Practical survivor/infected polish; full tests/typecheck/build/Cloudflare dry run, visual review, provenance/changelog/version update; publish a versioned draft PR.

## Constraints and known limitations

- Latest explicit user platform instruction is **Windows PC only**; the pasted brief's Android/Mobile language is stale. Preserve Performance/Balanced/Cinematic and Windows browser/Tauri support.
- Flat ground, collision, shared coordinates, combat, saves, accounts and protocol must remain unchanged. No new abilities or weapons.
- No source edits to gameplay have been made at this checkpoint. Browser automation is Chromium/SwiftShader on Linux: renderer counters are useful, hardware FPS/Windows installer claims are not.
- Asset-production skill read; `game-dev` CLI unavailable. Original reproducible TypeScript geometry/material authoring is available; Blender is installed. No external art acquisition or paid jobs.
- No native Windows visual/audio playtest is available here. A real co-op Windows session remains manual.

## Next exact steps

Implement lighting in `FieldGraphics.ts`/`Atmosphere.ts`, richer original ground and foliage materials, bounded merged habitat/settlement dressing with unchanged collision. Capture `after-world` using the same fixture, inspect images and counters, run relevant tests, then update this document and make the next focused commit.
