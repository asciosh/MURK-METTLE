# Murk & Mettle — v0.9 Quality Overhaul

## Changes
- Build HUD into left/right flexible stacks rather than overlapping absolute panels. Existing IDs, behavior and state retained.
- Responsive panel sizing and scrolling for short or narrow viewports.
- Improved HUD contrast, panel hierarchy, input focus indicators and reduced-motion support.
- Added a distant layered forest backdrop using 3 instanced draw calls; no new player collision boundaries.
- Enabled proper frustum culling for instanced ground decoration by computing mesh bounds.
- Reduced shadow-map resolution and peak device pixel ratio to improve typical browser GPU load.
- Minor atmosphere/fog adjustment; existing mission coordinates preserved.

## Still experimental
- Co-op still needs real multi-client testing; v0.9 does not claim new multiplayer features.
- The minimap is fixed to the existing playable clearing.
- Complex rigged models and animation assets are not part of this procedural-art pass.

## Acceptance checks
1. `npm ci && npm run build` passes.
2. At browser widths 375, 768 and 1440 px, HUD cards don't overlap each other.
3. At short height 600 px, HUD stacks scroll independently rather than cover one another.
4. Previous save retains inventory, levels and Lanternkin bond.
5. Expedition extraction, zombie combat, crafting and minimap still work.
6. FPS remains stable near the new distant tree backdrop.
7. Test co-op with two or more browsers separately before claiming multiplayer reliability.
