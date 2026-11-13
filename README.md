> **v0.13.1 stability patch (private beta).** Account uploads now use revision-based conflict checks; old v0.13 cloud saves are readable and migrate on the next accepted upload. Guest play and the existing five local save keys are preserved. Account autosync is only re-enabled after a verified matching revision or an explicit restore/upload. The legacy recovery-key backup remains available manually in FIELD MENU, but its automatic uploads have been disabled. See `CHANGELOG-v0.13.1.md` and `TESTING-v0.13.1.md` before deploying.

## v0.12 — Smooth co-op + cloud backup (beta)

See [CHANGELOG-v0.12.md](CHANGELOG-v0.12.md) for setup, limits and recovery-key security.

# Murk & Mettle — v0.7: Solo Expeditions

This update retains v0.6 combat, crafting, Lanternkin and experimental WebSocket rooms.

## Installation (Codespaces)

```sh
npm install
npm run build
npm run dev
```

## New solo mission

- Defeat **3 infected** (each elimination counts once).
- Pick up **2 salvage drops** using **E**. Collecting a drop counts even when it is not a spore sample.
- Visit the **cyan extraction beacon** near the ruins at **X 0, Z -18**.
- Press **E** near the beacon once both objectives are complete.
- Receive **150 player XP** and a persistent **successful extraction** count.
- New mission starts immediately; mission kill and salvage counters reset.
- If you die, press R to reset the current mission; lifetime RPG progress and inventory remain saved.
- Mission objective counters are **session-only**, so refreshing starts a fresh mission; only completed extractions persist.

## Controls

WASD move; Shift sprint; mouse look; Space/left click melee; E pickup/bond/extract; Q Lantern Pulse; I crafting backpack; R restart after defeat.

## IMPORTANT: co-op is still experimental

Four-player room code, remote player movement and shared zombie combat from v0.6 remain included but **have not been fully group-tested**. The v0.7 expedition mission is **solo-only**. Connecting to a room disables mission tracking and hides the extraction beacon; it does not synchronize mission objectives, companions, inventory, XP, pickups or revives. The multiplayer server is in-memory and is not hardened for public release. For now test the mission in Solo mode. Public-facing multiplayer must use server-controlled objectives and rewards.

## Before committing

Run `npm run build`. Play a complete expedition; confirm killing, salvaging, extracting, receiving XP, repeating, dying/resetting and persisted extraction count. Test v0.6 mechanics for regressions. Do not claim multiplayer acceptance tests passed until testing with friends.


## v0.8 — Wildlands visual update

- Reworked responsive HUD layout to separate vitality, progression, companion, objectives and enemy panels.
- Always-visible north-up minimap: player direction, current infected, field camp, weather station and extraction point.
- Expanded forest floor detail using seeded instanced foliage, flowers and original geometric field landmarks.
- Refreshed atmosphere, fog and map color palette. The original mission boundaries, collision props and coordinates remain unchanged.
- No external art assets or Nintendo IP. No gameplay/save schema or room protocol changes.

**Verification:** Run `npm install && npm run build && npm run dev` in Codespaces. Check HUD on your desktop browser and at 390px mobile responsive width.


## v0.10 — First Light

- A real title screen overlays (and pauses) the expedition until **ENTER THE WILDLANDS** is selected.
- Includes an original self-authored animated `public/models/survivor.glb`, loaded through the existing manifest and `GLTFLoader` / `AnimationMixer` pipeline.
- The procedural survivor stays as fallback if a model fails or lacks critical animations.
- All source artwork and the bundled model are original to this update, with no licensed third-party artwork. Review `CHANGELOG-v0.10.md` for test steps.


## v0.11 Cloudflare Co-op (beta)

Cloudflare hosts both static Vite assets and WebSocket co-op rooms. The Wrangler config at `wrangler.jsonc` defines a SQLite-backed Durable Object per room.

```sh
npm install
npm run build
npx wrangler deploy
```

If Wrangler isn't installed, run `npm install -D wrangler` once. For local Codespaces multiplayer, `npm run dev` still starts the original Node/WebSocket room server alongside Vite. The public Worker uses `worker/index.mjs` and `worker/room.mjs`. Open the public URL in two independent browser sessions, enter the same code, and check for shared movement and zombie health.

Co-op is still a beta: no authenticated accounts, shared missions or server-authoritative progression. Check Cloudflare free-tier request/duration usage.
