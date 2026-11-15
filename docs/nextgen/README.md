# Murk & Mettle 2.0 — NEXTGEN Program

This directory is the source of truth for the NEXTGEN rebuild. Start here, then read the
[roadmap](ROADMAP.md) and [progress log](../NEXTGEN-PROGRESS.md).

## What NEXTGEN is

A complete redesign of the graphical client and gameplay experience, delivered as a
**browser-only** third-person action RPG. The legacy v0.27 client on `main` remains the
reference and fallback; NEXTGEN replaces it milestone by milestone on the `nextgen`
branch.

## Gameplay pillars

1. **Third-person action RPG** — over-the-shoulder camera, aiming, melee/ranged combat,
   dodge and stamina-based movement.
2. **Zombie survival** — infected threats, resource scarcity, bandaging/hunger-style
   survival pressure, day/night tension.
3. **Original collectible creatures** — the five-species collection carries forward with
   new presentation, evolution and companionship behavior.
4. **Four-player cooperation** — shared rooms, server-validated co-op combat and rewards.
5. **Extraction missions** — enter a zone, complete objectives, extract with loot before
   being overrun; multiple difficulty levels.
6. **Survivor sanctuary** — an upgradeable hub base with shops, crafting stations and
   permanent progression.

## Non-negotiable constraints

- Browser only (WebGL2/WebGPU via Three.js). No new native desktop work.
- Cloudflare Worker, Durable Object classes, migrations, account schema, storage keys and
  room protocol are preserved unchanged; player data survives the rebuild.
- Original or properly licensed free assets only, with recorded provenance.
- Server-authoritative multiplayer; the client never becomes the source of truth for
  co-op combat, rewards or saves.
- No purchases; no automatic deployment; `main` is never written to without approval.

## Baseline inventory (at M00 start)

Verified against the repository at v0.27 (`1bb0cd2`):

- Client: `src/main.ts` boots auth/menu, lazily loads `src/client/game/Game.ts`
  (~1.5k lines orchestrator), `World.ts`, actors, `AnimationController`,
  `rendering/FieldGraphics`, UI, mods and debug panels.
- Shared pure rules in `shared/` (survival, expansion, collection, coop-rules,
  actor-motion/pose, render-profile) are dual-consumed by client and tests.
- Server: `server/cloudflare/` Worker with `account`, `room`, `profile` Durable Objects.
- Tests: 21 node:test suites (67 checks) covering game rules, security, structure and
  repository contracts, plus Playwright browser fixtures under `tests/browser/`.
- Tooling: Vite + TypeScript, Wrangler 4, `npm test` / `typecheck` / `build` /
  `dev:cloudflare` all verified working at M00.

## Document map

- [ROADMAP.md](ROADMAP.md) — milestones M00–M10 with scope and acceptance criteria.
- [../NEXTGEN-PROGRESS.md](../NEXTGEN-PROGRESS.md) — running log of completed work and
  verification evidence.
- Legacy engineering guides remain under `docs/` and apply to the v0.27 line.
