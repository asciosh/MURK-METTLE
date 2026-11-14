# v0.15 — Verified Co-op Rewards (beta)

- Account identity is checked by the edge Worker before each room join, then passed internally to GameRoom.
- One connected socket per account per room.
- Room validates melee/pulse hit, cooldown, enemy death, and chooses the recipient of a kill reward.
- The winning account receives +50 **server-owned co-op XP**, +1 **server-owned kill**, and +40 creature XP when the killing hit is a pulse.
- Account Durable Object uses a unique encounter ID as an idempotency key.
- `GET /api/account/me` exposes authoritative co-op totals.
- Client no longer awards local XP for co-op kills; a server-confirmed reward appears in a toast.
- Fixes PBKDF2 iteration count to 100,000 for Cloudflare compatibility.

## Important scope boundary

Existing solo XP, inventory, crafting, and creature data remain client-calculated account saves. Trusted co-op stats are stored **separately** so user-uploaded saves cannot overwrite them. They do not yet affect player level or weapon damage. Zombie loot in rooms remains client-side and is **not** a trusted reward. No public leaderboard, trading, or paid items until all progression is authoritative.

## Required tests

1. `npm test` and `npm run build`.
2. Create an account; verify login and room join on Cloudflare.
3. Two distinct accounts join one room, kill a zombie; only the credited killer gets a trusted reward.
4. Log out and back in; account status reflects persisted co-op totals.
5. Confirm a second simultaneous socket on the same account is rejected.
6. Verify solo save and Lanternkin still work, and old cookies remain valid.

Deploy from Codespaces with `npx wrangler deploy`, only after testing; no Durable Object migration needed for the new storage keys.
