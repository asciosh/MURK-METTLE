# AGENTS.md — Murk & Mettle 2.0 (NEXTGEN)

Working rules for any agent or contributor on this repository. Read this file and the
[NEXTGEN documentation](docs/nextgen/README.md) before making changes.

## Reading order

Before planning or implementing any change, read, in order:

1. `AGENTS.md` (this file).
2. `docs/nextgen/README.md` — vision, pillars, baseline inventory.
3. `docs/nextgen/ROADMAP.md` — milestone definitions and acceptance criteria.
4. `docs/NEXTGEN-PROGRESS.md` — running log, including the exact next unfinished task.
5. `docs/development/CLOUDFLARE.md` for Cloudflare/durable-object invariants.
6. `docs/development/TESTING.md` for test and acceptance scope.

The latest user instruction governs scope. The NEXTGEN documents govern the 2.0
direction; older Windows/Tauri and v0.27 handoff instructions are historical baseline
context.

## Project objective

Rebuild Murk & Mettle into a polished, AA-inspired, **browser-only** 3D game:

- Third-person action RPG with zombie survival.
- Original collectible and evolving creatures.
- **Creature combat, weapon transformations and special abilities.**
- **Optional cosmetic creature asset packs imported locally in the browser.**
- Four-player cooperative multiplayer.
- **Private access for friends.**
- Extraction missions with scalable difficulty.
- **Permanent upgradeable survivor headquarters.**
- Shops, crafting, equipment and permanent progression.
- Preservation of Cloudflare infrastructure and player data.

The current `main` line (v0.27) is the **legacy baseline**: it stays playable and
deployable while NEXTGEN work happens on the `nextgen` branch.

## Hard constraints

- **Web only.** No new native desktop work. `desktop/` (Tauri) is legacy; do not extend it.
- **Preserve Cloudflare infrastructure and player data.** Never rename or remove
  `server/cloudflare` Durable Object classes, bindings, migration tags `v1/v2/v3`,
  storage keys, account schema or the room WebSocket protocol. See
  [Cloudflare invariants](docs/development/CLOUDFLARE.md).
- **Database compatibility:** preserve existing account, profile and room schemas;
  never break legacy save/progression compatibility unless a migration is explicitly
  approved.
- **Assets:** original or legally licensed free assets only. Record provenance for every
  added model/texture/audio file. Never purchase assets or paid services. Include
  cosmetic mod security and asset licensing rules: only original or appropriately
  licensed assets may be imported locally in the browser; never bundle unauthorized
  third-party intellectual property.
- **Security and multiplayer integrity:** server-authoritative co-op combat, rewards and
  saves; untrusted content (mods, GLB) stays inside the existing validation boundaries.
- **Never merge into `main` and never deploy without explicit operator approval.**
- **Never claim a milestone is complete without verification.**

## Engineering rules

- Prefer Three.js, TypeScript and Vite.
- Evaluate WebGPU while maintaining WebGL 2 compatibility.
- Use GLB/glTF, PBR materials, skeletal animations and optimized assets.
- Keep multiplayer and economy server-authoritative.
- Never modify production or deploy automatically.

## Workflow

1. Inspect existing progress before coding.
2. Complete **one bounded implementation task** at a time, in small verified checkpoints.
3. Run relevant tests and builds (`npm test`, `npm run typecheck`, `npm run build` for
   client changes).
4. Update [docs/NEXTGEN-PROGRESS.md](docs/NEXTGEN-PROGRESS.md) with every meaningful
   change: what was done, how it was verified, and what remains.
5. Record the exact next unfinished task.
6. Commit verified changes with clear messages.
7. Open a pull request targeting `nextgen`.

## Branch rules

- Use the `nextgen` development branch as canonical.
- Work on task branches, never directly on `main` or directly on `nextgen`.
- Never merge into `main`.
- Open PRs targeting `nextgen`.
- Preserve existing progress; do not revert or delete working legacy code unless the
  active milestone explicitly replaces it.

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
