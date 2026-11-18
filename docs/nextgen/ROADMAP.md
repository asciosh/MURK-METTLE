# NEXTGEN Roadmap

Milestones are sequential. Each milestone is broken into tasks completed one at a time,
each with its own verified commit and progress-log entry. Scope may be adjusted in the
progress log with a recorded reason; acceptance criteria only shrink with operator
approval.

Status legend: ☐ not started · ◐ in progress · ☑ complete.

## M00 — Project Foundation & Documentation ☑

Establish the permanent program documentation and working rules.

- [x] `AGENTS.md` with hard constraints, workflow and verification commands.
- [x] `docs/nextgen/README.md` with vision, pillars and verified baseline inventory.
- [x] `docs/nextgen/ROADMAP.md` (this file) with milestone definitions.
- [x] `docs/NEXTGEN-PROGRESS.md` running log, started with M00 evidence.
- [x] Permanent `nextgen` development branch created from `main`.
- [x] Baseline verification recorded: `npm test`, `npm run typecheck`, `npm run build`.
- [x] M00 reconciliation checkpoint: consolidated documentation from the `cline/m00-reconcile`
      and `codex/nextgen-development` branches, added cosmetic mod security and asset
      licensing rules, database compatibility rules, engineering rules, and the session
      workflow; recorded M01 Task 1 as the next unfinished task.

**Done when:** all documents exist, the branch is pushed, and the baseline checks pass
on the `nextgen` line.

## M01 — Graphics Engine Foundation ☑

A modern rendering base that visibly outclasses the legacy client while keeping the
legacy game runnable.

- [x] Nextgen renderer scaffold (`src/nextgen/`) with a fixed, testable render loop and
      clean scene/renderer lifecycle (context loss, resize, teardown).
- [x] Physically based lighting: sun/sky, image-based ambient, shadow strategy with
      quality presets.
- [x] Post-processing stack (tonemapping, bloom, color grading) toggleable per preset.
- [x] Terrain and environment foundation: heightfield terrain, material system,
      instanced vegetation/props with distance culling.
- [x] Performance budget: stable ≥60 FPS at 1080p on Balanced preset hardware profile,
      measured with a reproducible benchmark, not estimated.
- [x] Automated checks: renderer unit tests plus a browser smoke fixture.

**Done when:** a nextgen scene renders PBR-lit terrain/vegetation at the perf budget
with tests and a recorded benchmark.

## M02 — Character & Animation Foundation ☐

- [x] Third-person character controller: camera-relative movement, sprint/dodge/stamina,
      pointer-lock aim, collision against nextgen terrain.
- [ ] Original survivor and infected character models with rigged skeletons and
      locomotion/attack/hit/death animation sets (provenance recorded).
      Remaining: survivor hit and death animations.
- [x] Animation state machine with blending, layering for aim/upper-body actions.
- [x] Third-person camera with collision, aim zoom and feel tuning.

**Done when:** a player character runs, aims, fights a melee infected in a nextgen scene
at the M01 perf budget.

**Remaining acceptance check:** hardware performance benchmark during combat.

## M03 — Combat & Survival Core ☐

- [ ] Melee and firearm combat: hit detection, damage, stagger, feedback (VFX/audio).
- [ ] Creature combat: creature attacks, special abilities, companion participation.
- [ ] Weapon transformations: visual and functional weapon form changes.
- [ ] Infected AI: spawning, senses, pursuit, attack, group pressure, difficulty scaling.
- [ ] Survival rules on the nextgen client reusing `shared/survival.mjs` server-validated
      contracts (health, bandaging, downed/revive).
- [ ] Loot, inventory and equipment interactions.

**Done when:** co-op-validated combat and survival rules pass both unit and browser
tests against the nextgen client.

## M04 — Creatures: Collection & Evolution ☐

- [ ] Five original species re-presented with nextgen models, animation and habitats.
- [ ] Capture/befriending gameplay, journal UI, evolution forms.
- [ ] Companion behavior that participates in combat and survival.
- [ ] Optional cosmetic creature asset packs imported locally in the browser
  (original or appropriately licensed only, provenance recorded).

**Done when:** collection state round-trips through existing cloud saves without schema
changes.

## M05 — Four-Player Co-op ☐

- [ ] Nextgen client against the unchanged room Durable Object protocol.
- [ ] Remote player representation, interpolation, shared world state.
- [ ] Server-validated co-op combat, revives and rewards.
- [ ] Private access for friends.

**Done when:** four browser clients share one room through the local Wrangler stack
with the existing security tests passing.

## M06 — Extraction Missions & Difficulty ☐

- [ ] Mission structure: deploy, objectives, extraction timer/zone, loss conditions.
- [ ] Difficulty levels with scaled threat and reward.
- [ ] Mission reward pipeline into permanent progression.

**Done when:** a full deploy→objectives→extract loop is playable solo and in co-op with
validated rewards.

## M07 — Survivor Headquarters ☐

- [ ] Hub base scene with upgradeable structures.
- [ ] Base upgrade gameplay loop tied to mission earnings.
- [ ] Persistence through the existing account schema (no migration unless approved).

**Done when:** base upgrades persist across sessions for a real account.

## M08 — Economy, Crafting & Progression ☐

- [ ] Shops, currencies, crafting stations and recipes.
- [ ] Permanent progression (unlocks, upgrades) server-validated.
- [ ] Legacy save/progression compatibility.

**Done when:** economy actions are server-validated and legacy accounts keep their value.

## M09 — UI/UX, Audio & Polish ☐

- [ ] Nextgen HUD, menus, journal, settings; accessibility and rebindable input.
- [ ] Adaptive music and SFX pass.
- [ ] Visual polish and art-direction consistency pass.

**Done when:** the full loop is presentable to new players without documentation.

## M10 — Hardening & Release Readiness ☐

- [ ] Performance and memory soak tests on target hardware profiles.
- [ ] Security review (mods, GLB, protocol abuse, session handling).
- [ ] Four-player full-loop playtest checklist executed and recorded.
- [ ] Final optimization and release audit: asset optimization, bundle size, render
  profile verification, licensing provenance audit for all added assets.
- [ ] Release candidate build and operator deployment handoff (deployment itself is a
      separate approved action).

**Done when:** all release checks are recorded in the progress log and the operator
approves deployment.
