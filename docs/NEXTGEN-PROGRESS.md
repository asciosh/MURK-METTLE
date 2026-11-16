# NEXTGEN Progress Log

Running log for the Murk & Mettle 2.0 program. Newest entries first. Every entry records
what was done, how it was verified, and what remains. See the
[roadmap](nextgen/ROADMAP.md) for milestone definitions.

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
  - `heightAt(x, z)` sampling matches rendered mesh surface (bilinear interpolation)
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
