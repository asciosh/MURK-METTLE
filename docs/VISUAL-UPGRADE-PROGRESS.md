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

## Verified milestone 2 — original creature art and animation

- All five species / 15 forms rebuilt in `CreatureArt.ts`: Lanternkin's clear ivory face, lantern ribs, layered leaf crown and curved bud stems; Emberling's leaf ears, ruff and curled articulated tail; Mossback's fitted shell scutes and growth caps; Stormrook's layered feathers; Reedwisp's fins, whiskers and flowing tail.
- Shared per-creature materials, merged rigid parts, smooth eye geometry, brief blinks, restrained emissive breathing, leaf/wing/tail motion and pulse response. Grounded forms compensate growth/pulse scale without changing root positions or cosmetic-mod normalization. Nearby wild creatures turn toward the player visually.
- New `creature-art` browser regression validates every form, finite geometry, budgets, growth/pulse ground contact, blink recovery, unchanged bonding radius, attention without habitat displacement and stable GPU counts over 45 form builds. Typecheck passed.
- Existing actor gallery/lifecycle/GLB cache checks and cosmetic import/preview/enable/disable/removal/persistence/disposal checks passed. No shader/page errors. Same-camera captures are in `/workspace/work/visual-v027/after-creatures/`; inspected all species' final forms and Lanternkin's base form, then corrected antler height, intersecting bibs/ear liners and shell scutes.
- No binary asset, external texture, dependency, new rig or gameplay rule added.

## Verified milestone 3 — character polish and release validation

- Survivor: round scarf/gloves/mask, respirator details, field blanket/bindings, tailored hem and softer, lighter GLB equipment. Infected: distinct original bark/fungal/rag growth. Existing pose/state machines and the six legacy GLB clips remain.
- Root package/lock and HTML labels now say **0.27.0 / v0.27**. Desktop host remains its independent 0.1.0 version. Added release notes, source provenance, reproducible capture command and measured baseline/candidate counters.
- Windows PR builds still compile/package but never execute the unsigned installer; execution requires an explicit manual workflow opt-in. No installer execution, deployment or merge was performed.

| Final validation | Result |
| --- | --- |
| `npm test` | 67 passed, 0 failed/skipped; includes server/account/mod security and original GLB validation |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; existing Three core >500 kB warning remains |
| `wrangler deploy --dry-run` | Passed; 16 static files and all three existing Durable Object bindings |
| `npm run test:browser` | All seven suites passed: interface, characters, creature-art, combat, world, mods, performance-safety; no reported page/shader errors |
| Production browser suite | Passed: deferred engine/cinematic loading, compiled mod worker/preview, original demo and four authenticated local WebSocket sessions |
| Desktop launcher browser suite/build | Passed keyboard/retry/layout/offline-recovery tests and standalone launcher production build |
| Portable Rust `cargo test --locked --lib` | 4 policy tests passed; not a native Windows compilation |
| Real-Game baseline/final captures | Passed; three locations, 15 forms and survivor/infected gallery; same cameras, seed, viewport and preset |
| Resource lifecycle | Full Game teardown returned to 0 geometries / 0 textures; repeated evolution and cosmetic import/removal stable |
| Native Windows hardware / full human co-op expedition | Pending manual acceptance, not claimed |

Final images/logs are under `/workspace/work/visual-v027/` and `/workspace/work/visual-v027-*.log`. Final renderer counters are committed in `docs/performance/visual-v0.27/`. Inspected forest, settlement, wetland, creature forms and aim/heal/death poses. Fixed-view rendering costs increased 20–37% in triangles and 15–29% in draw calls; texture counts stayed at 38. This is not a performance-speedup claim. See [release notes](changelog/CHANGELOG-v0.27.md) for exact counts and remaining bottlenecks.

Operational retries: the source server stopped during the interruption and was restarted before the successful final suite. Wrangler initially tried an unwritable home config; the successful dry run/local Worker used `XDG_CONFIG_HOME=/workspace/work/visual-v027/wrangler-config`. No production or security setting was bypassed.

## Pending handoff

1. Environment/material/lighting showcase pass: completed above.
2. Creature rebuild: completed above.
3. Character/release validation: completed above. Publish the validated branch as a source-only **draft** PR with v0.27 in its title, then record its URL here. User merges.

## Constraints and known limitations

- Latest explicit user platform instruction is **Windows PC only**; the pasted brief's Android/Mobile language is stale. Preserve Performance/Balanced/Cinematic and Windows browser/Tauri support.
- Flat ground, collision, shared coordinates, combat, saves, accounts and protocol must remain unchanged. No new abilities or weapons.
- No authoritative gameplay edits. Browser automation is Chromium/SwiftShader on Linux: renderer counters are useful, hardware FPS/Windows installer claims are not.
- Asset-production skill read; `game-dev` CLI unavailable. Original reproducible TypeScript geometry/material authoring is available; Blender is installed. No external art acquisition or paid jobs.
- No native Windows visual/audio playtest is available here. A real co-op Windows session remains manual.

## Next exact steps

Commit milestone 3, push `codex/v0.27-visual-leap`, create a draft PR against `main` titled `v0.27 — The Visual Leap: botanical world and expressive creatures`, and save the PR URL in this document. Then the next implementation session should address only review findings or Windows playtest evidence; do not rebuild completed milestones. Full Windows hardware/co-op checks remain in the release checklist. Never run the unsigned installer, deploy or merge as part of this task.
