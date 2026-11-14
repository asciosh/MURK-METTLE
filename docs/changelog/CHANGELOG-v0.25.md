# v0.25 — Grounded graphics pass

## Environment

- Layered world-space terrain blends dirt, forest litter and worn settlement asphalt with broad variation instead of a single repeated ground swatch. Normal and roughness maps give light something to respond to. This is visual shading, not displaced collision terrain.
- Optional online photographed surfaces replace dirt, forest litter, bark and plaster with 1K CC0 PBR maps. They load in the background, verify source hashes and fall back to procedural maps on failure. The field menu includes a switch and load status. First load adds about 11 MB of texture downloads; see the asset credits.
- Tree crowns use more branching leaf clusters, textured trunks and restrained leaf light transmission. Crowns cast cutout shadows; direct self-shadow reception is disabled on crown cards to reduce card shadow artifacts. Grass and undergrowth retain wind animation.
- Buildings gain window frames, partial glass, sills, roof parapets, chimneys, vents, drain pipes, foundation rubble and rain stains. Ivy uses leaf cutouts instead of green spheres. Small settlement detail is merged by material to limit added draw calls.
- Leaf litter, chipped road edges and irregular wet patches add scale at ground level. Wet patches reflect the environment map; they are not screen-space reflections.
- A layered cloud sky, textured distant ridges and revised sky/ground illumination replace the flat bright backdrop. The camera-facing side of the survivor remains readable under the new lighting. Cinematic mode retains optional contact shading.

## Actors

- Infected have narrower torsos, smaller heads and eyes, facial features, worn shirts/trousers, hands and boots. Large crystal crowns and glowing eyes are replaced with restrained fungal growth on the relevant strains. Their authoritative health, hit geometry, speed, damage and attack timing remain unchanged.
- Survivor clothing, hood and equipment use woven material detail, with pack seams and stitching. Existing aiming, weapon, reload and co-op animations continue to use the same controls.
- Actor texture sources are shared while individual materials retain strain colors. Disposed materials release their texture references; the shared pool is released when the last actor is removed.

## Compatibility and limits

This is a rendering update. It does not change map boundaries, building collision, accounts, saves, creature ownership, combat rules, Cloudflare bindings or migration tags. Reload open tabs after updating.

The visual style is more grounded, but character and creature models remain procedural rather than scanned humans. Foliage uses cards, water uses environment reflections, and terrain remains a flat playable surface. More detailed rendering costs GPU time; this release does not claim measured improvements in frame rate. Use Performance mode and disable Photographic surfaces on constrained devices. Offline materials remain fully playable. Real-device frame rates, production Cloudflare delivery and texture CDN availability need preview testing.
