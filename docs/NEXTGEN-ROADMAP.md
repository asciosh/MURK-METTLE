# MURK & METTLE 2.0 — checkpoint roadmap

Read [vision](NEXTGEN-VISION.md), [progress](NEXTGEN-PROGRESS.md) and root `AGENTS.md` first. All M01–M11 checkpoints are **not started**. This is a plan, not permission to start them during recovery. Checkpoints are intentionally narrow; split any that cannot be verified and committed in one bounded change. Later milestones may reuse validated legacy systems.

For every checkpoint: verify the affected functionality, record commands/evidence and limitations in progress, record the exact next task, review the diff, and commit. A checkpoint is complete only after verification, progress update and commit. Visual work also needs browser inspection; multiplayer/economy work needs authoritative and persistence regression checks. Never merge into main or deploy automatically.

## M00 Recovery

- **M00.1 Inventory and preservation:** locate the actual source, inspect status/history/all available branches and documentation; establish the production baseline and dedicated nextgen branch; add permanent instructions, vision, roadmap and evidence-based progress. Verify baseline tree/refs and documentation consistency; commit recovery inventory. Explicitly record missing prior working-tree evidence.
- **M00.2 Baseline verification:** install from the existing lock, run Node tests, typecheck, web production build and local Worker dry-run; run available local browser regressions. Record exact outcomes, warnings and blocked checks without broadening into repairs or M01. Verify production/backend/desktop paths remain unchanged; commit results.
- **M00.3 Handoff and stop:** reconcile checkpoint status, old contradictory instructions, Git evidence and remaining gaps; save exact next task and branch/commit information. Verify links, clean checkpoint diff and unchanged production baseline. Commit the handoff and stop before M01.

Exit: recoverable source and honest limits, dedicated branch, four required documents, current checks and resumable handoff. Missing interrupted-session files remain a blocker to claiming complete recovery of uncommitted work.

## M01 Graphics engine

- **M01.1 Engine decision:** compare the existing Three.js foundation with viable browser options; document animation/PBR/postprocessing/asset support, licensing and migration cost. Choose one engine and explicit browser/reference-hardware budgets. Acceptance: reviewed decision and reproducible measurement plan; no production routing changes.
- **M01.2 Isolated boot:** add the chosen nextgen client entry and minimal rendered scene behind an explicit local development route. Acceptance: legacy boot and root build still pass; separate entry loads/disposes without console errors.
- **M01.3 Rendering foundation:** add lighting, camera, resize handling, quality settings and resource ownership to that scene. Acceptance: inspected low/high-quality renders, resize/context failure behavior and stable repeated mount/dispose counters.
- **M01.4 Slice baseline:** establish fixed-camera captures and frame/loading/resource telemetry on declared fixtures. Acceptance: reproducible baseline with actual measurements and stated hardware/software limits.

Exit: isolated, measured browser renderer ready for assets; production and security contracts intact.

## M02 Environments and assets

- **M02.1 Asset register:** define scale/orientation, mesh/material/texture budgets and provenance requirements; audit reusable legacy assets. Acceptance: every selected asset has verified source, license and redistribution rights; no paid jobs.
- **M02.2 Environment slice:** build one coherent exterior area with terrain, architecture and foliage. Acceptance: inspected compositions and third-person traversal; visuals align with collision/navigation.
- **M02.3 Materials and lighting:** integrate PBR surfaces, shadows, atmosphere and level-of-detail/fallback behavior for the slice. Acceptance: no missing assets/shaders across selected presets, licensed delivery and measured budgets.
- **M02.4 Loading and lifecycle:** implement bounded loading, caching and teardown for the slice. Acceptance: cold load, failed asset, repeated entry/exit and resource evidence captured.

Exit: one production-quality environment slice, not a prematurely expanded world.

## M03 Survivor and animations

- **M03.1 Survivor rig:** admit one original/properly licensed skinned survivor with compatible equipment anchors. Acceptance: rig, scale, grounding, skin deformation and provenance inspected in a browser gallery.
- **M03.2 Locomotion:** implement idle/walk/run/turn transitions and third-person movement. Acceptance: smooth transitions, foot contact and camera behavior under keyboard/mouse input.
- **M03.3 Action animation:** integrate aim/fire/reload/melee/hit/heal/death with interruption rules. Acceptance: animation timing matches gameplay events and aim rays; no stuck states.
- **M03.4 Equipment and regression:** attach equipment and verify remote actor/fallback lifecycle. Acceptance: several loadouts, missing-clip fallback and repeated spawn/despawn retain stable resources and legacy contracts.

Exit: one satisfying playable survivor in the environment slice.

## M04 Creatures

- **M04.1 Original creature slice:** choose one existing species and define its model/rig/animation and ability identity. Acceptance: licensed/original art, readable silhouette and three designed evolution forms.
- **M04.2 Companion behavior:** integrate follow/idle/command/ability/reaction states. Acceptance: readable feedback, grounded navigation and camera visibility in motion.
- **M04.3 Collection and evolution:** connect that species to compatible ownership, XP and evolution contracts. Acceptance: legitimate evolution survives save/reconnect; spoofed ownership/rewards rejected.
- **M04.4 Roster rollout:** expand remaining species in separately committed species checkpoints. Acceptance: all five species/fifteen forms inspected with distinct motion, fallback and lifecycle checks.

Exit: original collection/evolution loop at nextgen visual and gameplay quality.

## M05 Combat and zombies

- **M05.1 Combat slice:** integrate one ranged weapon and one melee attack with readable hit/recoil/impact feedback. Acceptance: aim, range, reload and interruption agree with validated rules.
- **M05.2 Zombie slice:** add one production-quality zombie rig and readable chase/attack/stagger/death behavior. Acceptance: fair telegraphs, collision and hit timing in motion.
- **M05.3 Survival interactions:** integrate healing, creature combat, pickups and defeat/retry. Acceptance: resource consumption and action interruption match solo/co-op authority rules.
- **M05.4 Encounter variants:** add bounded zombie variants and one designed encounter; each variant is separately verified/committed. Acceptance: fun/readability playtest plus authority and lifecycle regressions.

Exit: enjoyable small combat encounter; no client-authority regression.

## M06 Multiplayer

- **M06.1 Protocol adapter:** connect nextgen presentation to existing authenticated account/room contracts. Acceptance: unchanged security, origin/session, input validation and four-player cap tests pass.
- **M06.2 Remote presentation:** render interpolation and action/creature states for four players. Acceptance: local four-client visual/action checks under simulated latency; distinguish transport from gameplay evidence.
- **M06.3 Disconnect and persistence:** verify reconnect, stale session, room lifecycle and authoritative rewards. Acceptance: no duplicate rewards, lost ownership or silent save overwrite; failure cases explicit.
- **M06.4 Cooperative acceptance:** run a complete four-player combat session and document issues. Acceptance: human playtest on declared browsers with join/leave/rejoin, cooperation and persistence evidence.

Exit: secure and tested nextgen co-op, not merely four open sockets.

## M07 Expeditions and extraction

- **M07.1 Expedition lifecycle:** define preparation, entry, objectives, defeat and return; adapt the existing mission authority. Acceptance: all lifecycle transitions and persistence boundaries documented/tested.
- **M07.2 Extraction slice:** implement one objective route and extraction interaction. Acceptance: successful/failed/abandoned runs and simultaneous extraction cannot duplicate rewards.
- **M07.3 Difficulty levels:** define at least three selectable difficulty tiers with explicit enemy, resource and reward rules. Acceptance: server validates selection and reward scaling; measured balance and telegraphs remain fair.
- **M07.4 Risk/reward playtest:** test a full party expedition including disconnect near extraction. Acceptance: clear retained/lost inventory rules, replay-safe rewards and documented human feedback.

Exit: repeatable extraction loop with multiple gameplay difficulties (separate from graphics presets).

## M08 Sanctuary and economy

- **M08.1 Sanctuary slice:** build a navigable 3D home with clear preparation/return points. Acceptance: inspect navigation, creature presence and persistent-state boundaries.
- **M08.2 Sanctuary upgrades:** implement one visible, persistent facility upgrade; expand upgrades through separate checkpoints. Acceptance: cost, ownership and visual state survive reload/reconnect without duplication.
- **M08.3 Shops and equipment:** add one shop and one equipment upgrade path. Acceptance: server-validated prices/inventory, insufficient funds and concurrent purchase cases.
- **M08.4 Crafting integration:** connect legacy recipes/resources and add a small coherent nextgen recipe set. Acceptance: atomic consumption/grant, no replay/exploit, compatible inventory and save tests.

Exit: functional sanctuary, shop, crafting and equipment loop with a tested economy.

## M09 RPG progression

- **M09.1 Progression contract:** audit existing XP/collection/save data and specify compatible survivor/creature progression extensions. Acceptance: old fixtures load unchanged; migration/rollback strategy documented before changes.
- **M09.2 Survivor growth:** implement a bounded level/stat/skill path. Acceptance: explicit caps, authoritative grants and meaningful combat choices verified.
- **M09.3 Creature growth:** connect evolution/ability growth to expedition and sanctuary rewards. Acceptance: no reset of legacy ownership/XP and no duplicate unlocks.
- **M09.4 Long-term validation:** exercise new/old accounts, conflicts and interrupted rewards across repeated runs. Acceptance: deterministic progression, abuse checks and multi-account reconciliation evidence.

Exit: durable, meaningful RPG growth with tested compatibility.

## M10 UI and audio

- **M10.1 UI language:** define nextgen menu/HUD typography, icons, focus and accessibility rules. Acceptance: readable at declared browser window sizes and reduced-motion settings.
- **M10.2 Flow slice:** implement preparation → expedition → extraction → sanctuary screens and feedback. Acceptance: keyboard focus, pointer lock, overlays, error/retry and account conflict flows work end to end.
- **M10.3 Audio slice:** admit licensed/original environment, creature and combat audio with spatial mixing and volume controls. Acceptance: provenance, browser autoplay handling and clear combat cues.
- **M10.4 Integration polish:** inspect all supported views and mix under four-player combat. Acceptance: no clipped critical UI/audio, accessible cues and saved settings; commit fixes in small checkpoints.

Exit: coherent, understandable and responsive complete game presentation.

## M11 Optimization and release

- **M11.1 Measured audit:** measure loading/frame time/resources on declared hardware/browsers and compare to M01 budgets. Acceptance: reproducible scenarios and explicit bottlenecks; no software-rendered hardware FPS claims.
- **M11.2 Bounded optimization:** fix one measured bottleneck per checkpoint. Acceptance: same-scenario before/after metrics, visual quality and gameplay/security regressions pass.
- **M11.3 Release hardening:** complete authentication/abuse review, save/reward reconciliation, browser compatibility and long-session co-op checks. Acceptance: unresolved risks triaged with release-blocking criteria.
- **M11.4 Reviewable candidate:** prepare a web-only release/cutover/rollback plan and reviewed source candidate. Acceptance: complete evidence, provenance and owner review; merge/deploy/cutover require separate explicit authorization.

Exit: verified release candidate. Never auto-merge or auto-deploy.
