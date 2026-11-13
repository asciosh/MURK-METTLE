# v0.13.1 verification and rollout

## Automated checks

```sh
npm ci
npm test
npm run build
node --check worker/account.mjs
node --check worker/index.mjs
```

## Local manual acceptance checklist

- [ ] With a guest and no account, move, fight, craft, collect and reload: progress remains.
- [ ] Open FIELD MENU, focus room code / username / PIN and type WASD/E/Q/I/R/space: no movement, attacks, inventory toggle or abilities.
- [ ] Open FIELD MENU and legacy details on a narrow viewport: controls remain usable. Check desktop scroll wheel and touch scrolling for the HUD.
- [ ] Register account A, upload existing progress with an explicit confirmation, reload; sync resumes only if the revision matches.
- [ ] On a second browser logged into account A, restore A, change progress and upload. In browser 1, a subsequent autosync must show a conflict and never overwrite browser 2.
- [ ] Sign out of A and sign into B in the same browser: no automatic upload; a manual upload warns when browser progress belongs to A. Cancel and restore B.
- [ ] Use old recovery key to restore legacy backup, then explicitly decide whether to upload to the current account.
- [ ] Try reconnecting existing co-op room in two desktop browsers; room semantics are otherwise unchanged.
- [ ] Validate Cloudflare staging Worker after running `npm run build`; deploy production only after manual checklist.

## Rollback safety

Back up the current deployment and Durable Object data before release. Keep existing `wrangler.jsonc` bindings and migration tags; **never delete/recreate Durable Objects**. New save protocol rejects old-client PUT uploads with HTTP 400, so deploy the matching frontend and Worker together. If rolling back the Worker, note that v0.13 clients do not understand revision conflicts and can overwrite newer cloud data; do not leave old and new clients concurrently autosyncing.

## Verification in this artifact environment

`node --check` and `npm test` passed. A full TypeScript/Vite build was **not** completed because dependencies (`three`, `vite`, typings) are not installed in this environment. Cloudflare and multi-client tests were **not** run.
