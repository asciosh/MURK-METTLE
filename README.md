# Murk & Mettle · v0.26

A third-person browser zombie-survival and creature-collection RPG. Built with Three.js, TypeScript, Vite and Cloudflare Durable Objects.

v0.26 adds Android touch controls, a compact phone HUD, a Mobile graphics preset, more articulated movement/attack/healing animations, creature wing/leg motion, falling leaves, curved ferns and moving water/clouds. Mouse and keyboard remain the PC default. See [v0.26 notes](docs/changelog/CHANGELOG-v0.26.md) and [mobile/PC testing](docs/V0.26-TESTING.md).

v0.25 makes a larger realism pass: layered PBR terrain, optional photographed CC0 materials, fuller tree crowns, weathered settlement detail, clouded daylight and more human infected silhouettes. See [v0.25 notes](docs/changelog/CHANGELOG-v0.25.md), [graphics checks](docs/V0.25-TESTING.md) and [asset credits](docs/V0.25-ASSETS.md).

v0.24 adds Mossback and Stormrook, bringing the collection to five species and fifteen evolution forms. The expanded journal shows evolution chains, XP progress, pulse stats and habitat tracking. See [v0.24 notes](docs/changelog/CHANGELOG-v0.24.md) and [testing steps](docs/V0.24-TESTING.md).

v0.23 adds infected groups, gunshot investigation, dodgeable melee wind-ups, sprint stamina and interruptible bandages in solo and co-op. See [v0.23 notes](docs/changelog/CHANGELOG-v0.23.md) and [testing steps](docs/V0.23-TESTING.md).

v0.22 adds articulated survivor/gun animations, shared co-op poses, natural foliage motion and an optional Cinematic graphics mode. See [v0.22 notes](docs/changelog/CHANGELOG-v0.22.md) and [testing steps](docs/V0.22-TESTING.md).

v0.21 added an expanded 180m sector, abandoned settlement and wetland, shoulder-camera firearms, and three collectible species with three evolution stages each. See [Codespaces upgrade guide](CODESPACES-UPGRADE.md) and [feature notes](docs/changelog/CHANGELOG-v0.21.md).

## Requirements

- Node.js 22.12+ (or an explicitly compatible newer version)
- Cloudflare account and Wrangler for deployed multiplayer/account features

## Run

```sh
npm ci
npm test
npm run build
npx wrangler dev --local --ip 0.0.0.0 --port 8787
```

Use the Wrangler command above for complete local gameplay, accounts and co-op. Its local storage is independent of production. `npm run dev` builds the client, watches it for changes and starts the same complete Wrangler development Worker on port 8787. The standalone `npm run server` is a historical simplified Node WebSocket prototype; it does not implement the expansion protocol or account API.

### Deploy to Cloudflare

```sh
npm install --save-dev wrangler
npm test
npm run build
npx wrangler deploy --config wrangler.jsonc
```

Wrangler is included in the package lock; `npm ci` installs it reproducibly. GitHub-integrated deploys must use the Cloudflare Worker configuration (`server/cloudflare/index.mjs`), not a Pages-only static deployment.

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
