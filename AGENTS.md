# AGENTS.md — Murk & Mettle 2.0 (NEXTGEN)

Working rules for any agent or contributor on this repository. Read this file and the
[NEXTGEN documentation](docs/nextgen/README.md) before making changes.

## Project objective

Rebuild Murk & Mettle into a polished, AA-inspired, **browser-only** 3D game:

- Third-person action RPG with zombie survival.
- Original collectible and evolving creatures.
- Four-player cooperative multiplayer.
- Extraction missions with difficulty levels.
- Upgradeable survivor sanctuary, shops, crafting and permanent progression.

The current `main` line (v0.27) is the **legacy baseline**: it stays playable and
deployable while NEXTGEN work happens on the `nextgen` branch.

## Hard constraints

- **Web only.** No new native desktop work. `desktop/` (Tauri) is legacy; do not extend it.
- **Preserve Cloudflare infrastructure and player data.** Never rename or remove
  `server/cloudflare` Durable Object classes, bindings, migration tags `v1/v2/v3`,
  storage keys, account schema or the room WebSocket protocol. See
  [Cloudflare invariants](docs/development/CLOUDFLARE.md).
- **Assets:** original or legally licensed free assets only. Record provenance for every
  added model/texture/audio file. Never purchase assets or paid services.
- **Security and multiplayer integrity:** server-authoritative co-op combat, rewards and
  saves; untrusted content (mods, GLB) stays inside the existing validation boundaries.
- **Never merge into `main` and never deploy without explicit operator approval.**

## Workflow

1. Read `AGENTS.md`, [docs/nextgen/README.md](docs/nextgen/README.md) and
   [docs/nextgen/ROADMAP.md](docs/nextgen/ROADMAP.md) first.
2. Work on the `nextgen` development branch (via a task branch, never directly on `main`).
3. Complete **one milestone task at a time**, in small verified checkpoints.
4. Preserve existing progress; do not revert or delete working legacy code unless the
   active milestone explicitly replaces it.
5. Run `npm test` and `npm run typecheck` (and `npm run build` for client changes)
   before every commit. Do not claim untested features are complete.
6. Update [docs/NEXTGEN-PROGRESS.md](docs/NEXTGEN-PROGRESS.md) with every meaningful
   change: what was done, how it was verified, and what remains.
7. Commit focused changes with clear messages; open pull requests targeting `nextgen`.

## Repository map

- `src/` — legacy v0.27 client (Three.js + TypeScript). NEXTGEN may restructure this
  under `src/nextgen/` first and migrate entry points only when a milestone says so.
- `server/cloudflare/` — Worker, accounts, room/profile Durable Objects. Protected.
- `shared/` — cross-runtime pure game rules shared by client and server.
- `tests/` — node:test suites plus Playwright browser fixtures (`tests/browser/`).
- `docs/` — `docs/nextgen/` for the 2.0 program; older guides describe the legacy line.
- `desktop/`, `examples/`, `public/`, `scripts/` — legacy host, mod sources, assets, tooling.

## Verification commands

```sh
npm ci
npm test              # node:test suites (game rules, security, structure)
npm run typecheck     # tsc --noEmit
npm run build         # typecheck + vite build
npm run dev:cloudflare # full local stack at http://localhost:8787
```
