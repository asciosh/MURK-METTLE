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
