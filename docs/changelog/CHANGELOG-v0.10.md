# v0.10 — First Light

- Replaced persistent in-game welcome typography with a real, accessible start screen; entering starts the simulation and requests pointer lock.
- Survival simulation stays paused while at title screen (no zombie hits or progress mutations before entry).
- Bundled an original animated GLB survivor asset with Idle/Walk/Run/Attack/Hit/Death node-animation clips. No third-party models needed.
- Created an original fallback survivor outfit pass: hood, mask, illuminated visor, knee protection, expedition pouches and radio antenna.
- Tuned walking/running leg stance and retained existing procedural animations.
- Hardened optional GLB loading: the survivor requires Idle/Walk/Run/Attack clips or the game keeps the working fallback actor.
- All assets included here are source-authored geometry/CSS; no third-party models or Nintendo/Resident Evil assets.
- Mission coordinates, progression keys and multiplayer payload formats unchanged.

## Verification checklist
1. `npm ci && npm run build && npm run dev`
2. Intro blocks gameplay; clicking Enter removes it and captures mouse.
3. Run and melee animations work; no zombie damage before entering.
4. Bond, inventory, crafting, extraction and saved progress behave as in v0.9.2.
5. Existing co-op remains experimental and still needs four-player testing.
