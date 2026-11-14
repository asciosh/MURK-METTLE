# Apply Murk & Mettle v0.21 in Codespaces

This ZIP is an overlay patch for https://github.com/asciosh/MURK-METTLE at base commit `84d634ad70137b7713b765921b768e974a40dbd9` (v0.20). It contains changed/new source and documentation at the repository root, with no enclosing directory. It does not contain `.git`, account data, credentials, dependencies or build output.

## 1. Prepare

Open the repository's Codespace. Commit or stash your current work first if `git status --short` shows changes. If your repository has changed substantially since the base commit, review the patch before overwriting the same files.

Upload `murk-mettle-v0.21-upgrade.zip` into the repository root using the VS Code Explorer. Then run:

```bash
cd /workspaces/MURK-METTLE
git status --short
git switch -c upgrade/wildlands-v021
unzip -o murk-mettle-v0.21-upgrade.zip
npm ci
npm test
npm run build
```

The `cd` path assumes the default Codespaces folder name. `pwd` shows the actual path. Node 22.12+ is required. The package lock includes the existing Wrangler dependency.

## 2. Play locally with accounts and co-op

```bash
npx wrangler dev --local --ip 0.0.0.0 --port 8787
```

Open port **8787** in the Codespaces **Ports** tab. Create a local test account; local Wrangler data is independent of your production Cloudflare accounts. Test co-op in two separate browser profiles with separate accounts and the same room code (3–12 letters/numbers). A private forwarded port may require signing into GitHub in both profiles.

For a client build watcher plus the same complete Worker, use `npm run dev` instead. `npm run server` is the historical simplified Node server and does not provide the account API or the new gameplay protocol. `npm run preview` serves only static assets.

Controls: WASD move, Shift sprint, RMB aim, LMB fire (hold for rifle), 1/2 switch gun, R reload/restart, Space melee, E bond/pickup/resupply/extract, Q companion pulse, C cycle owned creatures, I backpack, Escape release mouse. The journal lets you select an owned companion after releasing the mouse. Graphics options are in FIELD MENU.

## 3. Review and save your branch

Stop the preview with Ctrl+C. Review before committing:

```bash
git diff --stat
git diff --check
git add -A -- . ':!*.zip'
git commit -m "feat: expand Wildlands graphics, firearms and evolving creatures (v0.21)"
git push -u origin upgrade/wildlands-v021
```

Create a pull request on GitHub and merge when satisfied. If GitHub auto-deploys `main`, merging may trigger that existing pipeline. No remote push or production deployment was performed when preparing this ZIP.

## 4. Optional production deployment

After verifying your branch, account restore, two-player rooms, combat and collection saves:

```bash
npx wrangler deploy --dry-run
# Deploy only when you intend to update the live game:
npm run deploy
```

Use the existing Cloudflare Worker/account and keep `wrangler.jsonc` bindings/migrations. Do not delete Durable Objects or production data. Deployment needs your own Cloudflare login/configuration.

## GitHub PR and Cloudflare branch previews

The upgrade is on branch `codex/wildlands-v021` in [PR #1](https://github.com/asciosh/MURK-METTLE/pull/1). A pull request proposes changes to `main`; opening it does not itself update the production branch.

1. In PR #1, open **Files changed** to review the code.
2. Wait for the Cloudflare branch preview/check to finish. If an earlier run failed with “needs a previews block”, retry the latest branch commit after this fix appears.
3. Open the preview URL shown by Cloudflare. Create a new test account: preview accounts and room data are isolated from production.
4. Test shooting, reloading, bonding, collection saves and co-op before merging.
5. When satisfied, click **Ready for review** (the PR starts as a draft), then **Merge pull request** or **Squash and merge**, and confirm. Required checks/rules may need to pass first.
6. If Cloudflare's Git integration deploys `main`, merging starts that production build. Otherwise deploy `main` manually.

Cloudflare Workers build settings for this Vite/Worker project:

- Build command: `npm run build`
- Production deploy command: `npx wrangler deploy`
- Non-production/branch preview command: `npx wrangler preview`
- Production branch: `main`

`wrangler preview` needs the `previews` block now included in `wrangler.jsonc`. Because the code uses `env.GAME_ROOMS`, `env.PLAYER_PROFILES` and `env.PLAYER_ACCOUNTS`, the preview must declare all three bindings, rather than just an empty object. Their local class bindings and existing migrations let Cloudflare create isolated preview namespaces; do not add a production `script_name` to them. Production bindings/migrations stay in their top-level locations.

References: [Cloudflare preview resources and Durable Objects](https://developers.cloudflare.com/workers/previews/resources/), [GitHub: merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request).

## Validation and limits

- TypeScript and Vite production build passed.
- 16 automated tests passed, including legacy account-save revision tests, per-species collection migration, ammo conservation, reload/cooldown rules, map cover and room validation.
- A real local Wrangler instance was exercised with two authenticated WebSocket clients: joining, bonding distance rejection, bonding, firearm kill, persistent creature XP, reload, and remote shot events.
- Chromium browser checks exercised account registration, the rendered game, pistol fire, reserve-consuming reload, weapon switching, RMB aiming, held automatic fire, and ammo/minimap separation. No JavaScript runtime errors were recorded.
- Production Cloudflare deployment, four-player load, mobile touch controls and hardware FPS benchmarking were not performed. The game remains keyboard/mouse oriented.
- Graphics use original procedural assets. Realistic rigged characters, scanned PBR art, building interiors, hordes and a full turn-based creature battle system are outside this update.
- Existing limitations around client-computed solo progress, PIN authentication and failed reward retries remain. Solo and co-op collection saves are separate.

For feature details and creature locations, read `docs/changelog/CHANGELOG-v0.21.md`. For the prior architecture and migrations, read `docs/V0.20-REFACTOR.md`.
