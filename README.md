# Murk & Mettle — Prototype 0.5

**Find your wild. Fight the rot.** Original stylized third-person browser action-survival RPG prototype.

## Running locally / GitHub Codespaces

Requires Node 22.12+ (Vite 8). From the repository root:

```bash
npm install
npm run build
npm run dev
```

Use the port 5173 URL shown by Vite.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Look (click the 3D view to capture pointer; Esc releases) |
| Shift | Sprint |
| Space / left mouse | Melee attack |
| E | Bond with Lanternkin, recover it, or pick up nearby loot |
| Q | Lantern Pulse (once bonded) |
| I | Toggle backpack |
| R | Restart encounter after defeat |

## What's new in 0.5

- **Variant infected:** every spawn randomly chooses a fresh original mutation strain — Feral Runner (fast), Barkhide (tank), Sporeling (fragile), or Ashwalker (balanced). Each uses distinct palettes, proportions, health, movement speed and damage; consecutive encounters never use the same strain.
- **Infected loot:** each zombie kill drops one colored resource: Spore Sample, Salvaged Parts or Root Fiber, rotating by kill. Pick it up with **E** while close.
- **Persistent inventory:** three material types, with a cap of 20 each. Stored in `localStorage` under `murk-mettle-v05-inventory`. Open the backpack with **I** or the HUD button.
- **Original radio operator, Rook:** short text-only lines react to the mission, collection, pulse and creature loss. Not a Resident Evil character or dialogue.
- **Bloom Strain:** Lantern Pulse adds 35 strain and infected hits add 18; resting lowers strain by 2.5 per second. Reaching 100 makes Lanternkin retreat to its original wild location. Return there and press **E** to recover it. Its XP, collection entry and levels are retained.
- **Persistent bond retreat:** refreshing the browser won't magically repair a fractured bond. Its recovery flag is stored in `localStorage` under `murk-mettle-v05-bond-retreat`.
- Existing v0.4 XP, health, combat and collection saves remain intact.

### Save behavior

The v0.4 progression key is not changed. This is a local single-player prototype; no accounts, multiplayer or cloud persistence are implemented yet. Loot on the ground is *not* persistent; only collected inventory is. Do not expect saved material counts on another browser/device.

### Design intent

**Bond Strain** is our first distinctive action/survival mechanic: companion power carries consequences, but loss is recoverable rather than deleting the player's time investment. In future versions strain could interact with biome hazards, weather, player decisions, creature temperament and expedition objectives.

## Copyright and assets

All visuals are made from procedural primitives and authored UI/CSS; the radio dialogue is original. Do not include third-party character names, voice clips, dialogue or models without appropriate permission. The repo's code and art require a separate licensing decision before public distribution.

## Known limits

This version has one active enemy at a time (four possible enemy strains) and one companion. Drops rotate deterministically for reproducible testing. There is no crafting, equipment, multiplayer, procedural loot tables or voice-over. The gameplay state is not server-authoritative.
