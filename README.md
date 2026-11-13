# Murk & Mettle — v0.6: Evolution + Co-op Prototype

An original stylized third-person browser survival RPG for up to four friends.

## Requirements

Node.js 22.12+ recommended; npm; modern desktop browser.

## Run in GitHub Codespaces

```sh
npm install
npm run build
npm run dev
```

Open the forwarded **port 5173** in your browser. Vite proxies `/room` WebSockets to a local Node.js server on **port 8787**. You only need to forward/expose **5173** to friends, not 8787. For outside friends, set the forwarded 5173 port visibility to an appropriate shareable setting. Do not publish the server directly to the open internet without authentication and rate limiting.

To test co-op without sharing: open the 5173 URL in **two separate tabs** (for separate local saves, use a private window). Both players enter the same code, e.g. `BLOOM`, then press **JOIN / CREATE**. Up to four connected players per room. Click the canvas to capture the mouse; Escape releases it for HUD buttons.

## v0.6 changes

- Three craftable recipes, spending existing salvage resources:
  - Sharpened Blade: 3 scrap + 1 fiber, melee damage increases from 40 to 55 (solo; prototype client claim in co-op).
  - Balanced Grip: 2 scrap + 2 fiber, melee range increases from 2.65 to 3.35 (solo only until combat authority is expanded).
  - Bloom Antidote: 2 spore + 1 fiber, immediately reduces bond strain by 60 if bonded. For a retreated Lanternkin, reduces strain after you return and press E to recover it.
- Two randomized 3D mutation traits on top of the four enemy strains.
- Room-based WebSocket connections, up to 4 players. Other players are visible and move in the same world.
- Shared server-run zombie simulation, health, attack cooldowns, attack hit checks, respawning, and shared death events.
- Solo gameplay (v0.5 controls, companion, XP, inventory and drops) remains available.

## Controls

WASD move, Shift sprint, mouse aim, Space/left mouse melee, E interact/pickup/bond, Q Lanternkin Pulse, I inventory/crafting, R restart after defeat. Joining/leaving a room requires clicking the lobby buttons.

## Important multiplayer prototype limitations

This is a **first cooperative vertical slice**, not production-ready authoritative RPG networking.

- Server runs in Node.js in Codespaces; it is **not** deployed on Cloudflare, and the server retains rooms **only in memory**.
- WebSocket room codes are not passwords: anyone with the URL/code may join; there is no authentication or anti-abuse hardening.
- Player movement is client-predicted and only lightly speed/bounds-checked by the server. The server has simplified collision, so zombie pathing may pass through props in multiplayer.
- Combat damage is server-validated for distance and basic cooldown, but the server currently accepts a client claim for Sharpened Blade. Do not treat co-op XP or loot as secure against cheating.
- Individual zombie loot drops locally for every player when a shared enemy dies. XP for killing is awarded only to the final attacker. Creature bonding, strain, inventory, upgrades and XP are **saved locally** per browser, not synchronized or persisted on the server.
- Players share one zombie; companions are local-only. There is no revive interaction, shared missions, matchmaking, server persistence or synchronized inventory yet.
- The co-op room code is fixed by the field you enter; there is no friends list. Only four live connections per room.
- Solo inventory and progression keys from v0.3–v0.5 are retained, and the new upgrade save is separate at `murk-mettle-v06-crafting`.

## Suggested v0.7 engineering priorities

1. Add real accounts/player IDs and server persistence.
2. Move player combat stats, creature abilities, reward grants and item ownership fully server-side.
3. Server-authoritative drop IDs and pickup validation.
4. Improve enemy obstacle navigation, interpolation and reconnect recovery.
5. Shared mission objectives and ally revival.

## Build checks

`npm run build` runs TypeScript type checking and Vite bundling.

### License and originality

All procedural models and creature designs in this prototype are original. Review asset licenses before adding third-party assets. Do not include Nintendo or Resident Evil characters, dialogue, models or branding.
