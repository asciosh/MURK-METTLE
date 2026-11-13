# v0.11 — Cloudflare Co-op (beta)

- Cloudflare Worker serves Vite assets and routes `/room` to a room-specific Durable Object.
- Durable Object handles up to four active WebSocket clients and authoritatively simulates shared zombie HP, movement and attack damage.
- Shared position snapshots (5 Hz) with client-side smoothing; movement messages reduced to approximately 8 Hz to manage free-tier usage.
- Keeps existing client game UI and networking message protocol; existing Node.js Codespaces server remains available for `npm run dev`.
- WebSocket attachment state supports reinitialization while connections exist; disconnected players do not automatically resume their prior session.
- Fixes unused `headRig`/`torsoRig` fields that caused the v0.10 TypeScript build failure.

## Limits
- No account authentication, reconnect tokens, server-side XP/inventory, shared missions, shared companion state or anti-cheat-grade validation yet.
- The room server has a per-room active timer and cannot hibernate while players are connected. Monitor Workers/Durable Objects usage, especially under the free plan.
- Room codes are not passwords; share them only with friends. Four-player rooms are capped at four active sockets.
- Durable Object zombie state is held in memory; a runtime restart can reset an ongoing fight.

## Cloudflare
The Wrangler config includes a SQLite-backed Durable Object migration (compatible with Workers Free plan). Run `npm install -D wrangler` if not already installed and use `npm run deploy`. If your Cloudflare repository integration deploys automatically, keep its deploy command `npx wrangler deploy` and build command `npm run build`.
