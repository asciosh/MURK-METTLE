# MURK & METTLE 2.0 — verified progress and handoff

Recovery date: 2026-11-15. Source: `https://github.com/asciosh/MURK-METTLE`. Working checkout: `/workspace/work/MURK-METTLE`. Development branch: `codex/nextgen-development`. Read [vision](NEXTGEN-VISION.md), [roadmap](NEXTGEN-ROADMAP.md) and root `AGENTS.md` before implementation.

## Current scope and stop condition

**M00 recovery only. M01 has not started.** No renderer implementation, dependency upgrades, main merge, deployment or native work is authorized in this session. Record recovery evidence and checks, save the handoff and stop. The old v0.27 progress file describes an earlier session; its open-PR and Windows/Tauri directions are superseded for nextgen.

## Recovery evidence and limits

- The supplied `/workspace` had no checkout or source files. `.git` was an empty protected placeholder; `git status`, `git branch` and `git log` returned “not a git repository”. Local searches found no prior project or AGENTS instructions in available workspace/home/opt/mnt locations. No uploaded recovery files were present.
- Connected GitHub installed-repository search identified `asciosh/MURK-METTLE`; cloned it without modifying the original workspace placeholder. This recovers **committed remote work only**. Interrupted-session uncommitted/staged/untracked files and local-only branches/reflogs are unavailable and cannot be claimed recovered or absent. Obtain that original workspace before treating recovery of unfinished work as complete. Never overwrite it with this clone.
- Clone began clean on `main` at `1bb0cd2` (`v0.27 — The Visual Leap: botanical world and expressive creatures (#15)`). Dedicated branch created from that exact baseline. Local `main` and `origin/main` retained at baseline.
- All 15 historical remote development branches retained (table below). `git log --all --not origin/main` has 17 commits outside main ancestry; most correspond to squash-merged PR work, not proven abandoned implementation. Do not delete or blindly cherry-pick them.
- `git diff origin/main origin/codex/v0.27-visual-leap` is empty. Its five commits were incorporated as main's squash commit `1bb0cd2`. The older handoff's claim that PR #15 is open/unmerged is stale according to actual Git history/tree. Production deployment SHA/status has **not** been inspected; main is the source preservation baseline, not proof of what is live.
- Inspected README, architecture, setup/testing/Cloudflare guides, v0.27 visual progress/provenance, package scripts, asset manifest, shared rules, client feature modules, Worker/account/room source, tests and legacy Windows workflow. No NEXTGEN documents or AGENTS.md existed in the cloned source.

### Retained historical branch tips

All names below are under `origin/codex/`; hashes are abbreviated snapshot identities. Remote-tracking refs and original commits remain untouched.

| Branch suffix | Tip |
| --- | --- |
| botanical-ui-v027 | 2541635 |
| combat-feel-v028 | c3c1f37 |
| creature-journal-v024 | dd0d453 |
| graphics-animation-v022 | b18a8f2 |
| grounded-graphics-v025 | 359dfa6 |
| horde-survival-v023 | 6ceae18 |
| local-creature-cosmetics | c524e5e |
| measured-performance | bee5892 |
| mobile-motion-v026 | 9ec3054 |
| ui-graphics-v027 | 1c6f814 |
| v0.27-visual-leap | 3792b17 |
| wildlands-v021 | bc0de35 |
| windows-cleanup | 98fa62a |
| windows-desktop | 25c44e7 |
| world-composition | 8a532ec |

## Actual baseline capability versus 2.0

These are source findings, not new playtest claims or completed nextgen milestones.

| Area | Existing v0.27 implementation/evidence | Remaining nextgen work |
| --- | --- | --- |
| Graphics/world | Three.js 0.187, TypeScript/Vite, quality presets, atmospheric botanical environments, PBR/procedural surfaces, batching; prior reproducible visual fixtures | Engine decision, isolated client, coherent professional assets and measured visual budgets |
| Survivor/animation | Procedural articulated body; original 39,496-byte GLB used for equipment with six rigid-node clips; no skins | Professional skinned survivor, animation blending/action coverage and equipment integration |
| Creatures | Lanternkin, Emberling, Mossback, Stormrook, Reedwisp; three forms each; original botanical mesh/motion, collection/ownership/evolution and local cosmetic validation | Nextgen models, expressive rigs/behaviors and integrated progression quality |
| Survival/combat | Infected groups, ranged/melee weapons, healing, companion pulse and audiovisual feedback; shared survival rules | Nextgen zombie rigs/AI presentation, combat feel and encounter acceptance |
| Co-op | Authenticated Cloudflare room WebSockets, cap four, shared combat/loot/crafting/rewards and reconnect handling | Nextgen adapter/presentation, latency evidence and complete four-human session |
| Extraction | Solo and shared expedition rules; three kills/two salvage and extraction zone; party reward persistence | Rich expedition lifecycle, risk/reward rules and selectable gameplay difficulty tiers |
| Sanctuary/economy | Field camp, inventory and three recipes (two permanent melee upgrades, restorative consumable) | Upgradeable 3D sanctuary, shops and broader equipment economy; no implemented sanctuary/shop system found |
| RPG/data | XP/levels, creature growth and account saves with revision compare-and-swap; co-op rewards validated | Deeper permanent choices and compatible extensions; solo progress remains client-computed |
| UI/audio | Botanical HUD/journal/menu, keyboard/mouse focus rules and synthesized combat audio | Complete nextgen flows, licensed/original audio content and accessibility acceptance |
| Performance/release | Historical renderer counters and automated suites | New hardware/browser targets, sustained benchmarks and release security acceptance |

Graphics presets Performance/Balanced/Cinematic are **not gameplay difficulty levels**. Existing source does not establish the requested difficulty system. Existing rendering/progression systems should be reused where appropriate, not counted as nextgen completion.

## Protected source and operational risks

Worker `murk-mettle`; static root `dist/`; entry `server/cloudflare/index.mjs`. Bindings/classes: `GAME_ROOMS/GameRoom`, `PLAYER_PROFILES/PlayerProfile`, `PLAYER_ACCOUNTS/PlayerAccount`; SQLite migration tags `v1/v2/v3`. Preserve account schema/keys, origin/session checks, revision conflicts, room authority, collection normalization and isolated preview bindings. Legacy `PlayerProfile` remains required compatibility history.

Known inherited risks: username/PIN authentication is private-beta quality; solo progress is client-computed; cloud conflicts pause saving; failed multi-account rewards require operator reconciliation. No hardening or migration was attempted in recovery. Existing desktop files/workflow and Windows-only historical instructions remain preserved but do not define 2.0 scope. No native/installer commands are run.

## Checkpoint ledger

| Checkpoint | Status | Evidence / commit |
| --- | --- | --- |
| M00.1 Inventory and preservation | Complete with missing-workspace limitation above | Commit subject: `docs(nextgen): recover baseline and define guarded 2.0 roadmap`; four required documents, clean clone, retained refs, baseline tree comparison |
| M00.2 Baseline verification | Pending | Run locked install/tests/typecheck/build/local checks; record outcomes before commit |
| M00.3 Handoff and stop | Pending | Final consistency, Git preservation evidence and exact resumption task |
| M01–M11 | Not started | Each milestone/checkpoint is defined in the roadmap; no 2.0 runtime implementation claimed |

## Current validation

Environment: Linux, Node `v24.22.1`, npm `11.9.0`; satisfies package requirement Node >=22.12.0. System Chromium is available. Lockfile installation: `npm ci --cache /workspace/work/npm-cache` passed, 68 packages installed; no lock/dependency edits. Remaining checks pending at this checkpoint. Older documents report 67 passing Node tests and browser suites; those are historical evidence until rerun here.

## Exact next task

**M00.2:** run `npm test`, `npm run typecheck`, `npm run build` against the untouched v0.27 runtime. Bundle locally with `wrangler deploy --dry-run`, using writable XDG config/output directories. Run available local source and built-Worker browser suites, keeping accounts/storage local. Record results, warnings and limitations here; verify no runtime/Cloudflare/desktop changes; commit verification results. Then complete M00.3 and stop. **Do not begin M01.**
