# MURK & METTLE — permanent agent instructions

Before planning or implementing any change, read, in order:

1. `AGENTS.md` (this file).
2. `docs/NEXTGEN-VISION.md`.
3. `docs/NEXTGEN-ROADMAP.md`.
4. `docs/NEXTGEN-PROGRESS.md`, including the exact next task and stop condition.
5. `docs/ARCHITECTURE.md`, `docs/development/TESTING.md` and `docs/development/CLOUDFLARE.md` for affected systems.

The latest user instruction governs scope. The NEXTGEN documents govern the 2.0 direction; older Windows/Tauri and v0.27 handoff instructions are historical baseline context. Do not interpret an unchecked roadmap entry as authorization to implement it. This recovery session stops after M00. **Do not begin M01 without a subsequent user instruction.**

## Preserve and isolate

- Inspect status, staged/unstaged/untracked work, branches, history and current documents before edits. Never reset, clean, discard, overwrite unfinished work, force-push, delete historical branches or rewrite existing commits.
- Work on `codex/nextgen-development` or a dedicated nextgen child branch. Never implement on or merge into `main`. Do not deploy automatically, change hosting, publish a release, trigger a native build or create an installer.
- Preserve the existing production client while the nextgen client is developed in isolation. A ground-up graphical client rebuild is authorized for future milestones; routing/cutover is a separate explicit decision after validation. Do not replace the production entry during recovery.
- Target a **web-only third-person action RPG**. No native application, Tauri development or Windows installer. Preserve existing `desktop/` files and historical workflows as legacy evidence; do not execute or extend them for nextgen. Browser keyboard/mouse is the initial control baseline; additional browser/device support requires an explicit tested scope.
- Preserve the Cloudflare Worker, account data, secure room authority and save compatibility. Keep Worker `murk-mettle`, bindings/classes `GAME_ROOMS/GameRoom`, `PLAYER_PROFILES/PlayerProfile`, `PLAYER_ACCOUNTS/PlayerAccount`, migrations `v1/v2/v3`, storage keys, session/origin checks and isolated preview bindings. Never migrate/reset production data as a test. Any later compatible schema/protocol extension needs a documented migration and regression evidence first.
- No unauthorized copyrighted assets, franchise copies, paid services or paid generation jobs. Record source, author, license, redistribution rights and modifications for every admitted asset. Preserve existing provenance and original assets.

## Checkpoint discipline (mandatory)

Take one small checkpoint from the roadmap at a time. After **every** checkpoint:

1. Verify affected functionality with relevant existing tests/builds; inspect visual changes in a browser. Do not claim checks that were not run. Record failures, warnings, environment limits and historical evidence separately.
2. Update `docs/NEXTGEN-PROGRESS.md` with checkpoint status, changed paths, commands/results, preserved work, evidence locations and remaining blockers.
3. Record one exact next task, including its scope, verification and stop condition. Keep unfinished work explicit.
4. Review `git diff --check` and staged paths; create a focused Git commit on the dedicated development branch. Stage only owned checkpoint files. If a commit is blocked, record the reason; never mark the checkpoint complete without it.

Keep a clean, resumable handoff; retain unrelated user changes without staging them. Record commit subjects in the checkpoint being committed and hashes in subsequent checkpoints (avoid self-referential commit hashes). No fabricated AA quality, hardware FPS, production connectivity or full co-op acceptance claims. Automated local WebSocket bootstrap is not a four-human gameplay session.

## Local validation

Node 22.12+ and the committed root lock are required. Use `npm ci`, `npm test`, `npm run typecheck`, `npm run build`. Use writable caches/config directories under the task workspace when needed; do not change HOME or commit machine caches. Browser suites use local Vite/Worker servers only. Never run `npm run deploy`, `wrangler deploy` without `--dry-run`, remote storage commands or production account fixtures during development checks. Optional `wrangler deploy --dry-run` is local bundle validation only. Do not modify tests to hide recovery failures.
