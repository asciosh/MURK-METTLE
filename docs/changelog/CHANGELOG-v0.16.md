# Murk & Mettle v0.16 — Verified Co-op Economy

## What changed
- Verified co-op kills now award one account-owned material, rotating Scrap → Fiber → Spore. Duplicated event IDs never grant XP or materials twice.
- Account-owned co-op crafting offers Sharpened Blade, Balanced Grip and Bloom Antidote. Materials are checked and deducted transactionally inside the PlayerAccount Durable Object.
- Upgrades affect room-validated melee damage/reach after server-side equipment sync. Browser packets cannot assert upgrade ownership.
- A compact co-op wallet and crafting control are included in Field Menu; co-op kills no longer drop exploitable local salvage.
- Added authenticated API endpoints `/api/account/coop-state` and `/api/account/coop-craft`.
- New regression tests for duplicate rewards, insufficient materials, upgrade replay, and verified inventory balances.

## Data model and limits
- Keeps the existing Durable Object classes and migration tags. Co-op data is stored under separate `coop-inventory` and `coop-upgrades` keys in the player's account object.
- This release does **not** merge solo XP or inventory into the trusted co-op economy. Solo activity is still client-computed and remains untrusted.
- Only the player who lands the verified finishing hit is rewarded; shared party rewards are future work.
- Co-op `restorative` consumes server-owned materials and applies local companion relief. Companion strain and collection are not yet server-authoritative.
- Username + PIN authentication is private-beta only. No public trading, leaderboards or PvP.

## Test
```bash
npm install
npm test
npm run build
npx wrangler deploy
```
On deployed Cloudflare, use two different authenticated accounts. Join the same room, confirm kill awards and materials in Field Menu, craft a Blade, rejoin or wait for equipment-sync confirmation, and verify melee damage. Check isolation between player accounts. Regression-test solo combat and saved cloud data. Do not commit or deploy without testing first.

## v0.20 refactor milestone (reserved)
Full audit and reorganization of `src/game/`, server/shared domain schemas, CSS, worker classes, game loop separation, CI and integration tests. No broad architectural rewrite before v0.20.
