# NEXTGEN Progress Log

Running log for the Murk & Mettle 2.0 program. Newest entries first. Every entry records
what was done, how it was verified, and what remains. See the
[roadmap](nextgen/ROADMAP.md) for milestone definitions.

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
