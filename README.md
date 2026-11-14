# Murk & Mettle · v0.20

A third-person browser co-op creature-collection RPG. Built with Three.js, TypeScript, Vite and Cloudflare Durable Objects.

## Requirements

- Node.js 22.12+ (or an explicitly compatible newer version)
- Cloudflare account and Wrangler for deployed multiplayer/account features

## Run

```sh
npm ci
npm test
npm run build
npm run dev
```

`npm run dev` runs the **local WebSocket server** and the Vite frontend. Account login and persistent cloud progression require Cloudflare; use `npx wrangler dev` after building, or deploy.

### Deploy to Cloudflare

```sh
npm install --save-dev wrangler
npm test
npm run build
npx wrangler deploy --config wrangler.jsonc
```

Wrangler is **not pinned in the bundled lockfile**: install it as shown and commit the resulting `package.json` and `package-lock.json` updates after verification. GitHub-integrated deploys must use the Cloudflare Worker configuration (`server/cloudflare/index.mjs`), not a Pages-only static deployment.

**Do not delete or recreate existing Durable Objects, migration tags, or account data.** v0.20 changes source paths, not stored data formats or object class names.

## Project layout

- `src/client/game/`: browser gameplay, rendering, networking client, account screen
- `src/client/ui/`: layout helpers
- `src/styles/`: ordered CSS split (foundation → components → screens → polish)
- `src/main.ts`: boot and screen/menu wiring
- `server/cloudflare/`: Worker router and persistent Durable Objects
- `server/local/`: local WebSocket development server (not for Cloudflare)
- `shared/`: pure server game-rule constants and validation helpers
- `public/models/`: original survivor GLB and asset manifest
- `tests/`: Node regression and architecture tests
- `docs/`: migration guide, audit, archived changelogs

## Current limitations

- Co-op kills, salvage, crafting and creature ownership have server validation. **Solo progression is still computed by the browser**, then revision-saved to a Cloudflare account.
- PIN-only login (6–8 digits) is private-beta quality, not recommended for a public game without stronger authentication and rate limiting.
- Mission XP currently credits connected participants only; partial award failures require operator intervention.
- Cloud account save requests can conflict if the same account is open on multiple devices. The newer save is not overwritten.
- WebSocket movement updates and Cloudflare CPU usage need real multiplayer performance testing.

See `docs/V0.20-REFACTOR.md` and `docs/V0.20-TESTING.md` before deployment.
Historical changelogs are in `docs/changelog/`.
