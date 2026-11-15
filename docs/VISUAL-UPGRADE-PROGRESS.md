# v0.27 — The Visual Leap

Resume this branch, do not restart the upgrade. Base: `45b8e34` (merged Windows cleanup, PR #14). Branch: `codex/v0.27-visual-leap`. Release/PR version: **v0.27**. User merges; keep the eventual PR a source-only draft.

## Verified milestone 0 — baseline

- Inspected the current runtime, rendering/material/world systems, all actor builders, model manifest/GLB, presets, cosmetics, browser fixtures and cleanup documentation.
- Added repeatable real-Game captures plus frozen actor-gallery poses in `tests/browser/visual-leap.cjs`. 1366×768, DPR 1, Balanced, original local materials, seed 27027. No production accounts. `ARTIFACT_DIR=/workspace/work/visual-v027/before node tests/browser/visual-leap.cjs`.
- Baseline screenshots/counters: `/workspace/work/visual-v027/before/`. Images stay outside Git. Source fixtures are retained so baseline can be reproduced on this checkpoint.
- Visually inspected forest, settlement, wetland and Lanternkin. Five weaknesses: broad brown ground texture; uniform canopy silhouettes; flat light/ambient balance; repetitive facades; creature faces obscured by primitive petals (especially Lanternkin).
- Baseline `npm test`: 67 passing. `npm run typecheck`: passed.
- Survivor GLB remains original node animation/equipment, **not a skeletal rig**. Preserve compatible equipment loading and procedural fallback.

## Verified milestone 1 — environment and atmosphere

- Added original curved leaf/stem mesh authoring (`BotanicalGeometry.ts`) and bounded merged world dressing (`ShowcaseArt.ts`): climbing leaves, low tree roots, reclaimed facade bands/awnings/louvres, five habitat motifs and raised reedwater blooms.
- Rebalanced warm sunlight/cool ambient fill, sky and distance fog. Curved canopy cards, lower varied crowns and stronger branches preserve the original 7,130 cards/713 tree placements and quality restoration.
- Original moss/leaf-litter ground blend and greener wetland surfaces. No added runtime texture download or light. Fixed overly speckled distant hills after screenshot review; reduced canopy subdivisions and small decorative mesh density after measuring cost.
- `npm test`: 67 passed. Typecheck passed. World browser suite passed all ten viewpoints, flat-ground/anchor/trail checks and three presets with no page/shader errors. Repeated real-Game comparison captures passed.
- Inspected forest, settlement and wetland before/after at identical cameras/settings. Captures: `/workspace/work/visual-v027/after-world/`. Increased geometry is an intentional art cost, not an FPS optimization; final comparison will include the complete release.

## Pending milestones

1. Environment/material/lighting showcase pass: completed above.
2. Rebuild creature meshes and expressive animation, prioritizing Lanternkin and keeping all 15 forms/mod contracts. Validate lifecycle/actor/mod tests; commit.
3. Practical survivor/infected polish; full tests/typecheck/build/Cloudflare dry run, visual review, provenance/changelog/version update; publish a versioned draft PR.

## Constraints and known limitations

- Latest explicit user platform instruction is **Windows PC only**; the pasted brief's Android/Mobile language is stale. Preserve Performance/Balanced/Cinematic and Windows browser/Tauri support.
- Flat ground, collision, shared coordinates, combat, saves, accounts and protocol must remain unchanged. No new abilities or weapons.
- No authoritative gameplay edits. Browser automation is Chromium/SwiftShader on Linux: renderer counters are useful, hardware FPS/Windows installer claims are not.
- Asset-production skill read; `game-dev` CLI unavailable. Original reproducible TypeScript geometry/material authoring is available; Blender is installed. No external art acquisition or paid jobs.
- No native Windows visual/audio playtest is available here. A real co-op Windows session remains manual.

## Next exact steps

Wire the new, not-yet-committed `CreatureArt.ts` builder into `Companion.ts`; add blink/ground-contact/secondary motion. `tests/browser/creature-art.cjs` is prepared but not yet runnable against the old Companion. Validate all 15 forms and repeated disposal, inspect close-ups and fix clipping before committing milestone 2. Do not mark these unfinished files complete.
