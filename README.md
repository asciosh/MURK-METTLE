# MURK & METTLE

**Find your wild. Fight the rot.**

A browser-based, stylized 3D, third-person cooperative creature-collection action-survival RPG. This repository currently contains a local combat prototype. It is not multiplayer yet.

## Current build: Prototype 0.2 — First infected encounter

Added on top of the 0.1 movement foundation:

- One original procedural infected-runner enemy.
- Enemy idle, chase and melee-attack behavior.
- Lightweight collision constraints for both player and enemy.
- Player vitality (100 HP) and incoming enemy damage.
- Melee attack with a cooldown, range and facing check.
- Enemy vitality (100 HP), hit feedback and defeat.
- Automatic enemy respawn after a short delay.
- Combat HUD, hit flash, feedback messages and defeat/restart state.
- Restart the encounter with `R` after being defeated.

Still not implemented:

- Multiplayer / room codes / networking.
- Creature collection, companion AI or creature abilities.
- RPG progression, inventory or persistence.
- Multiple enemy types, bosses or mission extraction.
- Production character models, animations, sound or environment assets.

## Requirements

- Node.js 22.12 or newer.
- npm 10 or newer recommended.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Click inside the game to capture the mouse.

## Controls

| Input | Action |
|---|---|
| W / A / S / D | Move relative to camera |
| Arrow keys | Move relative to camera |
| Shift | Sprint |
| Mouse | Orbit camera while pointer is locked |
| Space / Left mouse button | Melee attack |
| R | Restart after being defeated |
| Click game view | Capture pointer |
| Escape | Release pointer |

## Project structure

```text
MURK-METTLE/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts
    ├── styles.css
    └── game/
        ├── Game.ts
        ├── InputController.ts
        ├── Player.ts
        ├── World.ts
        └── Zombie.ts
```

## Architecture notes

- `Game.ts` owns the renderer, scene, camera, main loop and gameplay-system wiring.
- `InputController.ts` owns local keyboard, mouse and pointer-lock input.
- `Player.ts` owns the temporary local survivor controller, health and placeholder model.
- `Zombie.ts` owns the first infected enemy, health, pursuit and attack behavior.
- `World.ts` owns the test environment and simple actor collision constraints.

The combat simulation in 0.2 is entirely local and single-player. Do not treat it as multiplayer-authoritative. When multiplayer is introduced, important gameplay outcomes such as damage, enemy state, creature ownership and progression must be validated by the server.

## Next milestones

1. Tune combat feel and add simple animation/audio feedback.
2. Add a second enemy archetype and a short encounter objective.
3. Add a private four-player room service and authoritative synchronization.
4. Add cooperative combat and reviving.
5. Add the first original collectible creature and one functional companion ability.
6. Build one short expedition with objective completion and extraction.
7. Add persistent character and creature progression.

## Intellectual property and assets

This prototype uses code-generated primitive geometry only and contains no Nintendo or Pokémon assets. Before adding external models, textures, fonts, sounds or music, record their source and license in an asset register. Choose a repository license deliberately before accepting public contributions or distributing the code.

## Updating an existing 0.1 Codespace to 0.2

Download the `MurkMettle_v0_2.zip` release archive and upload it to the root of your Codespace repository. From `/workspaces/MURK-METTLE`, run:

```bash
unzip -o MurkMettle_v0_2.zip -d /tmp/murk-v02
cp -a /tmp/murk-v02/MURK-METTLE/. .
npm install
npm run dev
```

Do not run `cd MURK-METTLE` when your terminal prompt already ends in `/workspaces/MURK-METTLE`.
