# v0.12 — Smooth Co-op & Cloud Backup (beta)

## Networking
- Server shared state raised from 5 to 10 Hz; client movement sends ~15 Hz.
- Remote characters and zombie movement interpolate between timed snapshots ~120ms behind live.
- 10 Hz simulation remains server-controlled; higher update frequency may increase Cloudflare active duration/CPU usage. Monitor metrics.

## Profile backup
- New SQLite-backed Durable Object `PlayerProfile`, one per 256-bit recovery key.
- Local progression, inventory, crafting, expedition totals and Lanternkin retreat state backed up to Cloudflare.
- Click CLOUD SAVE once to opt into a 60-second autosave while the tab is visible.
- COPY KEY: save your secret recovery key somewhere safe. Anyone with it can read/replace your save.
- RESTORE: enter key on another device; confirmation, save download and reload.
- Saves remain primarily local. This is an *untrusted backup*, not secure account auth or authoritative player progression.
- This is **not encrypted at rest by the application**, and is **not an account login**.
- A stolen recovery key gives access to the backup. Losing it and your browser storage makes recovery impossible.
- Multiplayer inventory, loot, XP and creature collection are still client-controlled and can be cheated; do not use this for public rankings/economies.
- Cloud profile data is durable through Cloudflare DO storage; no claim of zero cost or universal availability.

## Deployment
- Added `PLAYER_PROFILES` binding and `v2` SQLite Durable Object migration, preserving existing v1 GameRoom.
- `npm ci && npm run build && npx wrangler deploy`.
- Test two actual browsers on Cloudflare and back up before restoring on a second device.
