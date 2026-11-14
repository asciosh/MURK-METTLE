# MURK & METTLE — v0.16 (Verified co-op economy)

A third-person co-op browser RPG, built with Three.js, TypeScript, Vite and Cloudflare Workers/Durable Objects.

## Version 0.16 changes

- Progression is loaded from the authenticated Cloudflare account **before** starting the game.
- No guest gameplay, legacy recovery-key UI, or `localStorage` persistence for XP, creatures, inventory, crafting or expeditions.
- Progress is held in memory, uploaded every 12 seconds while visible, and can be uploaded manually via **Field Menu → Player Account → SAVE NOW**.
- Save requests use revision checking; a conflict pauses sync rather than overwriting another session.
- Multiplayer rooms require an authenticated account session. Shared combat state still lives in the room Durable Object.
- Co-op kills grant **one verified material per unique kill** to the finishing player’s account. Co-op loot is never awarded by local pickups.
- Verified co-op crafting checks account inventory, deducts resources atomically, and stores crafted equipment in the account.
- The room validates equipped co-op melee upgrades by querying account storage (`sync-equipment`), rather than trusting the browser.
- Open **Field Menu → VERIFIED CO-OP PROGRESSION** for XP, materials and upgrade crafting. Solo backpack and crafting remain separate.
- No database migration is required: the account Durable Object stores new inventory and equipment keys lazily.

## Run and deploy

```bash
npm install
npm run build
npm test
npm install -D wrangler
npx wrangler deploy
```

For local account and Cloudflare Durable Object testing, use `npx wrangler dev` after building. The normal Vite development server does **not** provide the account endpoints.

## Cautions

- **This is a private beta**, not production-grade authentication. PINs have only 6–8 digits.
- **Solo progression remains client-computed and can still be modified before upload.** Only co-op kill rewards, co-op loot and co-op crafting are server-validated. Do not enable trading, rankings or competitive rewards.
- Closing a tab can lose up to 12 seconds of unsynchronized changes. Use SAVE NOW before leaving.
- Logging in as the same account in multiple tabs can result in a revision conflict; one session must reload.
- Historical Durable Object classes and migration tags are retained for Cloudflare migration compatibility. The old recovery-key endpoint is disabled.
- This update intentionally ignores any historical browser saves because there was no progress to preserve.

See `CHANGELOG-v0.16.md` for details.

## v0.19 co-op field expedition

In a Cloudflare room (up to 4 authenticated players), defeat 3 infected together, collect both blue field samples (press **E** at **X -5, Z -7** and **X 6, Z -13**), and reach the extraction beacon at **X 0, Z -18**. Press **E** there to complete the mission. All alive, connected players receive **150 verified Cloudflare XP** once per completed mission. Shared objectives and pickups are room-owned; they are not client inventory items. Disconnecting before extraction means no party reward. Existing solo missions remain separate.

See `CHANGELOG-v0.19.md` for limitations and testing. Run `npm test`, `npm run build`, then `npx wrangler deploy` in Codespaces.
