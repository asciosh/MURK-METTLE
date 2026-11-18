# NEXTGEN Progress Log

Running log for the Murk & Mettle 2.0 program. Newest entries first. Every entry records
what was done, how it was verified, and what remains. See the
[roadmap](nextgen/ROADMAP.md) for milestone definitions.

---

## 2026-11-18 — M02 Final Acceptance

**Status:** Complete.

- Survivor and infected rigged character models.
- Survivor Hit and Death animations.
- Damage reactions and terminal death pose.
- Restart restores normal character animations.
- Automated combat performance benchmark.

**Hardware benchmark:**

- GPU: Intel Arc (Xe-LPG).
- Native WebGPU, 1920 × 1080, Balanced.
- Duration: 30.08 seconds.
- Average FPS: 60.
- P95 frame time: 16.8 ms.
- Worst frame time: 17.1 ms.
- Frames over 25 ms: 0.
- Peak draw calls: 325.
- Peak triangles: 428,643.
- Three active infected and 36 automated shots.
- Benchmark-only player damage protection.

**Next:** M03 — Combat & Survival Core.

## 2026-11-18 — M02/M03: Infected, Combat and Hordes

**Status:** Implemented.

- Integrated the rigged infected model with six animations.
- Authored an original zombie attack animation.
- Implemented infected pursuit, attack, hit reactions and death.
- Added pistol combat, ammunition, reloading and player health.
- Added progressive infected waves, enemy separation and restart.
- Implemented cumulative damage from simultaneous infected attacks.
- Refined the infected model with skeletal proportions and decayed textures.

**Verification:**
- 234 NEXTGEN unit tests passed.
- Combat and horde browser smoke tests passed.
- Redesigned infected manually verified in gameplay.

**Remaining M02 work:**
- Survivor hit and death animations.
- Hardware performance benchmark during combat.

## 2026-11-17 — M02 Task 4C: Vertical Aim Animation

**Status:** Complete.

- Retargeted upward and downward pistol aiming poses.
- Integrated smooth camera-driven vertical skeletal blending.
- Preserved locomotion and weapon recoil at different aim angles.
- Preserved all ten existing animation tracks.
- Added eight regression tests and browser verification.

**Verification:**

- 67 legacy tests passed.
- 169 NEXTGEN tests passed.
- Both browser smoke tests passed.
- Typecheck and production build passed.
- GLB validation: zero errors.

## 2026-11-17 — M02 Task 4B: Pistol Animations

**Status:** Complete.

- Retargeted pistol shooting and reload animations.
- Added independent upper-body weapon animation layer.
- Preserved locomotion during weapon actions.
- Added LMB shooting and R reload while aiming.
- Jump and dodge interrupt weapon actions.
- Enabled upward camera viewing with terrain protection.
- Preserved existing animations and legacy gameplay.

**Verification:**

- 67 legacy tests passed.
- 161 NEXTGEN tests passed.
- Typecheck and production build passed.
- Both browser smoke tests passed.
- GLB validation: zero errors.

## 2026-11-17 — M02 Task 4A: Weapon Attachment

**Status:** Complete.

- Created an original procedural pistol model.
- Attached the pistol to the survivor's right-hand bone.
- Calibrated grip alignment against the Aim animation.
- Added a muzzle attachment point.
- Integrated weapon visibility with aim blending.
- Added deterministic resource disposal.
- Preserved the existing survivor GLB and legacy gameplay.

**Verification:**

- 67 legacy tests passed.
- 152 NEXTGEN tests passed.
- Typecheck and production build passed.
- Avatar and playable browser smoke tests passed.
- Manual grip alignment verified.

## 2026-11-17 — M02 Task 3B: Upper-Body Aim Animation

**Status:** Complete.

- Retargeted the Quaternius pistol aiming pose.
- Integrated masked upper-body skeletal blending.
- Preserved independent lower-body locomotion.
- Added smooth 150 ms aim transitions.
- Preserved jump, landing and dodge animation priority.
- Added aim-layer telemetry and automated verification.
- Preserved all seven existing animation tracks and legacy gameplay.

**Verification:**

- Typecheck and production build passed.
- 67 legacy tests passed.
- 147 NEXTGEN tests passed.
- Avatar and playable browser smoke tests passed.
- GLB validation: zero errors.

## 2026-11-17 - M02 Task 3A: Aim Mode & Camera Zoom

**Status:** Complete.

- Added right-mouse hold-to-aim controls.
- Added smooth camera zoom from 5.5m to 3m.
- Added FOV transition from 58 to 45 degrees.
- Added over-the-shoulder aiming with lateral terrain collision.
- Added centered aiming crosshair.
- Character faces the camera aim direction while aiming.
- Preserved jump and dodge direction behavior.
- Aim resets on pointer lock loss, window blur and release.
- Preserved existing animations, movement and legacy gameplay.

**Verification:**

- Typecheck and production build passed.
- 67 legacy tests passed.
- 139 NEXTGEN tests passed.
- 12 new aim-specific tests passed.
- Avatar and playable browser smoke tests passed.
- Manual aim and camera verification passed.

---

## 2026-11-17 - M02 Task 2C: Action Animations

**Status:** Complete.

- Added JumpStart, JumpLoop, JumpLand and Dodge animations.
- Refined jogging and sprinting animation selection.
- Synchronized locomotion playback with actual movement speed.
- Corrected jump arm poses and animated ground alignment.
- Reduced excessive dodge elevation.
- Added visual dodge recovery without changing gameplay physics.
- Preserved the procedural fallback and legacy gameplay.
- Optimized the seven-animation GLB to 2.70 MiB.

**Verification:**

- Typecheck and production build passed.
- 67 legacy tests passed.
- 127 NEXTGEN tests passed.
- Avatar and playable browser smoke tests passed.
- Complete jump sequence verified in browser.
- Dodge and recovery verified in browser.
- Manual visual verification passed.

---

## 2026-11-17 — M02 Task 2B: Skeletal Survivor

**Status:** Complete.

- Integrated a realistic female survivor with skeletal animations.
- Retargeted Idle, Walk and Run animations.
- Optimized GLB from 16.34 MiB to 2.49 MiB.
- Corrected opaque material rendering.
- Documented CC0 asset provenance.
- Preserved the legacy game and procedural fallback.

**Verification:**

- Typecheck and production build passed.
- 67 legacy tests passed.
- 119 NEXTGEN tests passed.
- Avatar and playable browser smoke tests passed.
- GLB validation: zero errors.

### M02 Task 2A — GLB Model and Animation Foundation

Status: COMPLETE

- Reused original bundled survivor GLB.
- Automatic model height normalization and ground alignment.
- Idle, Walk and Run animation blending.
- Procedural fallback when model loading fails.
- Avatar browser smoke: PASS.
- Playable browser smoke: PASS.
- Existing model uses rigid node animation; skeletal model pending.
- Legacy gameplay and asset manifest unchanged.

### M02 Task 1C — Playable Character

Status: COMPLETE

- WASD keyboard input.
- Third-person mouse camera with terrain collision protection.
- Fixed-timestep character simulation and render interpolation.
- Procedural placeholder survivor.
- Sprint, dodge and jump controls.
- Live stamina HUD.
- Independent playable demo mode.
- Playable browser smoke: PASS.
- Original graphics browser smoke: PASS.
- Legacy gameplay and server protocols unchanged.

### M02 Task 1B — Advanced Character Movement

Status: COMPLETE

- Sprint with stamina consumption and regeneration.
- Exhaustion and recovery.
- Directional dodge with stamina cost and cooldown.
- Jump physics with gravity and terrain-aware landing.
- Airborne directional movement.
- Protection against repeated and incompatible actions.
- Local simulation only; server protocols unchanged.

Verification:
- Legacy tests: 67/67 PASS.
- NEXTGEN tests: 92/92 PASS.
- Typecheck and production build: PASS.

## 2026-11-17 — M02 Task 1A: Character Controller Foundation

**Status:** Complete.

**Delivered:**
- Deterministic camera-relative movement.
- Analog movement and diagonal normalization.
- Configurable spawn and character radius.
- Terrain boundary collision and height following.
- Character facing direction.
- Invalid input protection and bounded simulation steps.
- Independent position and facing snapshots.
- 20 dedicated character controller tests.

**Next:** M02 Task 1B — Sprint, Stamina and Dodge.

---

## 2026-11-17 — M01: Final Acceptance Review Complete

**Status:** M01 complete. All milestone acceptance criteria met.

**Delivered:**
- Unified WebGPU and WebGL2 device-loss notification handling.
- Safe render-loop shutdown on graphics device loss.
- Improved renderer disposal.
- Runtime switching between Low, Balanced and Cinematic presets.
- Dynamic shadow resolution and coverage.
- Correct TSL bloom uniform updates.
- Bloom and color grading bypass on Low.
- Browser verification of quality switching, resize,
  WebGL context loss and idempotent disposal.

**Final hardware benchmark:**
- GPU: Intel Arc (Xe-LPG), native WebGPU.
- Resolution: 1920 × 1080, Balanced preset.
- Duration: 30 seconds.
- Average FPS: 60.
- Mean frame time: 16.67 ms.
- P95 frame time: 16.8 ms.
- P99 frame time: 16.9 ms.
- Worst frame time: 17.2 ms.
- Frames over 25 ms: 0.
- Peak draw calls: 299.
- Peak triangles: 155301.

**Verification:**
- Legacy tests: 67/67 pass.
- NEXTGEN tests: 34/34 pass.
- Typecheck and build: pass.
- WebGL2 browser smoke: pass.
- All three graphics presets: pass.
- Native WebGPU hardware benchmark: pass.

**Next:** M02 Task 1 — Third-person character controller.

---

## 2026-11-17 — M01 Task 5: Performance Benchmark Complete

**Status:** Performance budget achieved on hardware-accelerated WebGPU.

**Delivered:**
- Accurate frame timing and frame timestamps.
- Correct per-frame draw-call instrumentation.
- Frame-rate-independent camera orbit.
- Reproducible 1080p Balanced hardware benchmark.
- Five-second warm-up and 30-second measurement.
- JSON benchmark reports with GPU identification.
- Seven additional performance instrumentation tests.

**Hardware benchmark:**
- Browser: Microsoft Edge 157, Windows.
- GPU: Intel Arc (Xe-LPG).
- Backend: native WebGPU, no software fallback.
- Resolution: 1920 × 1080, pixel ratio 1.
- Quality: Balanced, shadows enabled.
- Measurement: 30.02 seconds, 1802 frames.
- Average FPS: 60.00.
- Mean frame time: 16.67 ms.
- P95: 16.8 ms.
- P99: 16.9 ms.
- Worst frame: 18.3 ms.
- Frames exceeding 25 ms: 0.
- Peak draw calls: 299.
- Peak triangles: 155301.

**Verification:**
- Typecheck: pass.
- Legacy tests: 67/67 pass.
- NEXTGEN tests: 34/34 pass.
- Production build: pass.
- WebGL2 fallback browser smoke: pass.
- Native WebGPU hardware benchmark: pass.
- Git diff check: pass.

**Next:** M01 final acceptance review, then M02 —
Character & Animation Foundation.

---

## 2026-11-16 — M01 Task 4B: Vegetation & Environment Foundation

**Status:** Complete.

**Delivered:**
- Deterministic procedural vegetation placement.
- Pine trees, deciduous trees, bushes and grass.
- Procedural rocks and fallen logs.
- Instanced rendering and shared geometries.
- Spatial chunking and distance culling.
- Quality-dependent vegetation density.
- Improved ambient lighting.
- Terrain-following object placement.

**Verification:**
- Typecheck and build passed.
- 67/67 legacy tests passed.
- 27/27 NEXTGEN tests passed.
- WebGL2 browser smoke test passed.
- Manual visual inspection passed.

**Known limitations:** Placeholder models, distance culling pop-in, performance benchmark pending.

**Next:** M01 Task 5 — Performance Benchmark.

---

## 2026-11-16 — M01: Graphics Engine Foundation — Tasks 1–4A Complete

**Status:** M01 Tasks 1–3 complete — Graphics Engine Foundation with PBR lighting and RenderPipeline-based cinematic post-processing. All acceptance criteria verified.

**Context found on arrival:**

- `cline/m01-task2-lighting` at `600c6aa`: M01 Task 2 complete — PBR lighting system with quality-dependent shadow presets, directional sunlight, PMREM image-based ambient, and instanced vegetation. Verified: 67/67 checks, typecheck, build, 9/9 nextgen unit tests.
- `cline/m01-task3-postprocessing` (current): M01 Task 3 complete — cinematic post-processing pipeline using `THREE.RenderPipeline` (replacing legacy EffectComposer), ACESFilmic tone mapping, bloom, color grading, quality-dependent effect settings, and improved demo lighting. Same verification suite passes.

**Delivered (branch `cline/m01-task3-postprocessing`):**

- `src/nextgen/demo/SimpleDemo.ts` — Replaced incompatible `EffectComposer` + `three/examples/jsm/postprocessing/` passes with `THREE.RenderPipeline`, the modern Three.js r187 post-processing API that works natively with both WebGPU and WebGL2:
  - **RenderPipeline post-processing** — replaces the legacy `EffectComposer` pipeline that couldn't resolve `ColorCorrectionPass` and was incompatible with `WebGPURenderer`. `RenderPipeline` is the supported API in Three.js r187 for post-processing.
  - **ACESFilmic tone mapping** with configurable exposure per quality preset (low/balanced/cinematic).
  - **Bloom** — cinematic glare with quality-tuned strength, threshold, and radius settings.
  - **Color grading** — subtle cool tint for post-apocalyptic atmosphere, configured via RenderPipeline settings.
  - **Quality-dependent effect settings**: low (soft exposure/bloom), balanced (medium), cinematic (intense exposure and bloom).
  - **WebGPU and WebGL2 compatibility** — `RenderPipeline` works with `three/webgpu` single module instance; fallback to WebGL2 preserved.
  - **Uses the existing renderer loop** — `pipeline.render()` called within the `onFrame` callback, no separate render loop needed.
  - **Improves the excessively dark demo lighting** — ACESFilmic exposure control and bloom fill create properly exposed, atmospheric PBR lighting.
  - **Corrects inverted placeholder tree geometry** — verified cone winding ensures correct front-face orientation.
  - **Proper resource disposal** — `RenderPipeline.dispose()` called in `dispose()`, along with `PMREMGenerator.dispose()` and all tracked Three.js resources.
  - **Visually demonstrated** — the nextgen demo scene now renders with atmospheric, cinematic post-apocalyptic styling, properly exposed PBR-lit terrain and vegetation, bloom glare, and cool color-graded tone mapping.

- `docs/NEXTGEN-PROGRESS.md` — Updated M00 and M01 entries to reflect Tasks 1–3 complete; added verification details and next steps for M02.

**Verification:**

- `npm run typecheck` — pass (no TypeScript errors; fixed TS7053 indexing issue with type assertion, TS2339 pipeline property declaration).
- `npm run build` — pass (Vite build + typecheck).
- `npm test` — 67/67 checks pass (21 suites).
- `node --experimental-strip-types --test tests/nextgen/nextgen-renderer.test.mjs` — 9/9 nextgen unit tests pass.

**Next:** M01 complete — next steps for M02 (Character & Animation Foundation): third-person character controller, survivor/infected models with rigged skeletons, animation state machine, third-person camera.

## 2026-11-16 — M01: Graphics Engine Foundation — Tasks 1–4A Complete

**Status:** M01 Tasks 1–4A complete — Terrain Foundation with deterministic procedural terrain, heightfield height sampling, PBR terrain material with elevation-dependent blending, and demo integration. All acceptance criteria verified.

**Context found on arrival:**
- `cline/m01-task3-postprocessing` at `600c6aa`: M01 Task 3 complete — cinematic post-processing pipeline. Verified: 67/67 checks, typecheck, build, 9/9 nextgen unit tests.

**Delivered (branch `cline/m01-task4-terrain`):**

- `src/nextgen/core/TerrainGenerator.ts` — Deterministic, seeded procedural terrain generator.
  - 200m × 200m terrain with 257 × 257 heightfield sample grid
  - Natural rolling hills, slopes and valleys via multi-octave noise
  - Elevations bounded between 0 and 20 metres
  - Efficient indexed geometry with correct vertex normals and bounding volumes
  - `heightAt(x, z)` sampling matches rendered mesh surface (triangle interpolation)
  - Identical seeds generate identical terrain; different seeds produce different terrain
  - No external assets or paid dependencies

- `src/nextgen/core/TerrainMaterial.ts` — Physically based terrain material with smooth elevation-dependent blending.
  - Low elevation (0–7m): brown soil
  - Medium elevation (7–13m): natural green grass
  - High elevation (13–20m): grey exposed rock
  - Uses `MeshStandardMaterial` from `three/webgpu` with elevation-based uniforms
  - No `onBeforeCompile`, no custom GLSL shader injection
  - Compatible with both WebGPU and WebGL2 backends

- `src/nextgen/demo/SimpleDemo.ts` — Demo integration of terrain foundation.
  - Replaced flat ground with generated heightfield terrain mesh
  - Applied the new terrain material with elevation-based color/roughness/metalness blending
  - Positioned tree trunks using `terrain.heightAt(x, z)` to prevent floating or buried trees
  - Positioned tree crowns 2m above their trunks
  - Removed redundant `pipeline.render()` from `onFrame` callback (rendering owned by `NextGenRenderer`)
  - Adjusted orbit camera to remain above terrain and target to account for elevation
  - Preserved PBR lighting, fog, shadows, ACESFilmic tone mapping, bloom and color grading
  - Preserved existing quality presets (low/balanced/cinematic)
  - Initialized resources before starting the render loop
  - Properly disposes all terrain resources

**Verification:**
- `npm run typecheck` — pass
- `npm run build` — pass (Vite build + typecheck)
- `npm test` — 67/67 checks pass (21 suites)
- `node --experimental-strip-types --test tests/nextgen/nextgen-renderer.test.mjs` — 9/9 nextgen unit tests pass
- `git diff --check` — no whitespace errors

**Next:** M01 Task 4B — Vegetation and Environment Foundation; then M01 Task 5 — Performance Benchmark.

--

---

## 2026-11-15 — M00: Project Foundation & Documentation (task 1 of 1)

**Status:** M00 complete — all acceptance criteria met.

**Context found on arrival:**

- No `AGENTS.md`, no `docs/nextgen/` documents, no progress log existed anywhere in the
  repository; no `nextgen` branch existed (only `main`).
- Repository baseline is v0.27 (`1bb0cd2`), working tree clean.
- No open issues or unfinished PRs; previous sessions' work is merged through PR #15.

**Delivered (branch `vibe/m00-nextgen-foundation-8bdf77`, PR → `nextgen`):**

- Created the permanent `nextgen` development branch from `main` and pushed it to origin.
- `AGENTS.md`: hard constraints (web-only, Cloudflare/data preservation, asset
  provenance, server authority, no unapproved merges/deploys), workflow rules and
  verification commands.
- `docs/nextgen/README.md`: program vision, six gameplay pillars, non-negotiable
  constraints, and a baseline inventory verified against the actual tree (client/server/
  shared/tests structure, 21 node:test suites, tooling).
- `docs/nextgen/ROADMAP.md`: milestones M00–M10 with per-milestone tasks and done-when
  acceptance criteria.
- `docs/NEXTGEN-PROGRESS.md`: this log.
- `docs/README.md`: indexed the NEXTGEN program documents.

**Verification:**

- `npm test` — 67/67 checks pass (21 suites) before and after the change.
- `npm run typecheck` — pass.
- `npm run build` — pass.
- Documentation-only change; no runtime code touched, Cloudflare infrastructure and
  player data unaffected.

**Next:** begin M01 (Graphics Engine Foundation), first task: nextgen renderer scaffold
under `src/nextgen/` with fixed render loop and lifecycle tests.

---

## Baseline (pre-NEXTGEN)

- v0.27 "The Visual Leap" merged as PR #15; `main` deployable and playable.
- Verified at M00 start: `npm test` (67 pass), `npm run typecheck` (pass),
  `npm run build` (pass) on `main` = `1bb0cd2`.


### M03 — equipment and field inventory (2026-11-18)

- Added local NEXTGEN primary/secondary slots, pistol/rifle/shotgun behavior, independent ammunition reserves, weapon pickups/drops preserving loaded magazines, and a keyboard field-inventory panel.
- Added original procedural rifle/shotgun props, back/belt holsters, support-hand alignment, retimed compatible aim/fire/reload poses, distinct synthesized firing audio, recoil, and terrain-aware grouped shotgun pellets. Existing character GLBs and license records are unchanged.
- Verification: 32 focused pure Node tests passed against the supplied source archive; TypeScript syntax and new browser test syntax parsed. Full repository typecheck/build and real browser equipment/loot/combat regression tests remain operator verification tasks.
- NEXTGEN-only changes; no changes to shared/server rules, legacy gameplay, save schemas, room protocol or deployment. M03 remains open; these local equipment rules are not authoritative co-op validation.
- Exact next unfinished task: weapon transformations and creature combat foundation (plus dedicated rifle/shotgun animation polish), then co-op validation according to the roadmap.
