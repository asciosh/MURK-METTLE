# World composition and habitat art pass

Based on `109b867` (merged combat-feel PR #9). The playable sector remains a flat 180m gameplay/collision map.

## Visual changes

- Western broadleaf forest, drooping wetland crowns and tapered eastern/southern evergreen crowns share the original 713 tree roots. Crown transforms, textures and color differ by zone; ten authored crown slots remain per tree, with grouped quality reduction so no whole tree loses its crown. Stormrook's nearest existing tree receives a sparse, weathered roost silhouette.
- Terrain blends retain the north/south road and crossroad, add three short spur segments to the existing wetland boardwalk and relay cache, and vary soil warmth, marsh tint/roughness and pine litter. Spur centerlines are sampled against existing collision. The minimap uses the same spur coordinates.
- A lattice antenna on the existing relay roof and a reservoir tank supported on an existing Haven roof provide recognizable silhouettes. Painted gate warnings, an unfortified camp edge and original notice art describe the evacuation, water sampling and failing relay. Roof art is decorative, not new walkable space or cover geometry.
- Wetland water stays shallow and flat, with up to 64 instanced lily pads. The existing boardwalk is brought down close to the gameplay floor; it no longer suggests a raised walkable surface above flat collision.
- The sky now reaches the far plane without being clipped by the 350m camera range. Cloud rims receive a restrained warm highlight; daylight, hemisphere fill and fog form a warmer-light/cooler-distance palette. No extra fullscreen color-grading pass or dynamic habitat lights are added.
- Camp and quarantine presentation differ visually. This does not create immunity, a new safe-zone rule or a changed infected boundary.

## Five creature homes

| Existing species and position | Habitat identity | Future art anchor |
| --- | --- | --- |
| Lanternkin `(4.2, -3.8)` | Mint seed-lantern clusters and fresh growth in the field clearing, with the camp/evacuation approach in view. | `habitat-anchor-lanternkin` |
| Emberling `(8, -54)` | Flattened amber cinders, charred fronds and an ash treatment in the abandoned settlement. | `habitat-anchor-emberling` |
| Mossback `(48, 38)` | Moss treatment, wider fern clusters and low green growth in the southern survey pines. | `habitat-anchor-mossback` |
| Stormrook `(54, -46)` | Cool, narrow feather-like details and a weathered existing roost tree in the eastern pine zone. | `habitat-anchor-stormrook` |
| Reedwisp `(-48, -28)` | Cool water blooms, reeds and lily pads in Reedwater, approached along the existing flush boards. | `habitat-anchor-reedwisp` |

Habitat dressing is original source geometry, sparse accent meshes and flat material blending. It is world art, not a HUD marker, new pickup or ability trigger. Anchors carry species/motif metadata and `visualOnly: true`; their Y remains zero. No creature ability, bonding distance, spawn, navigation rule or multiplayer protocol is implemented/rebalanced here. Original habitat discs and mission markers remain in place.

## Budgets, ownership and provenance

- Grass cards: 6,500 → 4,200. Fern instances: 900 → 600. Pebbles: 850 → 480.
- New habitat dressing: 80 frond cards, 40 small seed/cinder/feather accent instances, and five flat patches, in three instanced draws. Frond detail scales per habitat with quality. Small accents use unlit colors rather than point lights.
- New lily pads: maximum 64 instances; reduced with undergrowth quality.
- The two forest crown batches together retain the old 7,130 full-detail slots; the second batch adds one draw, rather than doubling foliage instances. Roof/story geometry is merged by material.
- Original generated leaf textures are reused between forest, ivy and habitat fronds. New pine texture is 512×512; original notice atlas is 1024×256. No per-frame texture creation or new downloads.
- All added geometry, notice copy/art, foliage drawing code and shader changes are original project source authored for this pass. No external model, image, audio or generated binary is introduced. Existing optional Poly Haven CC0 material URLs, hashes and license records remain unchanged in `photo-surfaces.json` and `docs/V0.25-ASSETS.md`. Procedural materials remain available offline.
- Existing World/Game scene and material disposal paths own the added meshes/materials; generated atlas textures are registered with World's texture list.

## Validation

`npm test`, `npm run typecheck`, `npm run build`. Three new Node regressions cover zone determinism/unchanged authority data, bounded tapered crowns and collision-clear trail endpoints/centerlines.

Browser check: start `npm run dev:client -- --port 5173`, then run `node tests/browser/world.cjs` in an environment with Playwright and `/usr/bin/chromium`. `GAME_URL` / `ARTIFACT_DIR` override the server and capture directory. The test imports actual World/material/sky code and uses controlled offline lighting, no accounts or game simulation. It captures camp, Haven, wetland, relay, southern pines and all five homes; checks flat terrain, all 713 tree crown groups, preset matrix restoration, five habitat anchors and unobstructed existing habitat/cache locations; then exercises all four world density profiles. The gallery is a development test page, not a production entrypoint. Its density-profile renders do not enable the game's optional Cinematic compositor or dynamic shadows.

Before/after numbers are render counters, **not FPS, CPU/GPU timing, memory benchmarks or physical Android measurements**. Camera/frustum changes alter draw counts. The same camp camera with offline materials/light setup provides a controlled comparison; other captures primarily establish appearance and shader validity.

## Manual playtest

- Walk the existing extraction route and both spurs; confirm flat foot/pickup contact, navigation around tree roots and consistent minimap alignment.
- Visit all five unchanged creature positions from normal third-person height with HUD/journal closed. Check habitat readability, bonding reach and companion visibility.
- Approach the relay/tank from multiple directions and check that mission beacons still dominate objective navigation. Decorative roof art does not add collision or cover.
- Compare Mobile, Performance, Balanced and Cinematic while moving through forest/water, including photo surfaces on/off and fallback after a failed download.
- Run a full three-PC/one-Android room session. Physical-phone GPU/heat, shadow cost, online photo delivery and extended co-op navigation remain manual checks.

## Recorded results

- All 49 Node tests, typecheck and production build passed. Existing Vite bundle-size warning remains.
- Chromium software-WebGL captures passed without shader/page errors for all ten world/habitat views and all four world density presets. The playable floor, 713 tree groups / 7,130 full-detail crown slots, restored preset matrices, five named habitat anchors and existing cache/creature positions passed assertions. The source arrays, collision/navigation modules, mission/extraction rules and account/network code are unchanged.
- At the unchanged camp camera, the baseline reported **546,048 triangles / 163 draw calls**; the new world reported **499,714 triangles / 172 draw calls**. Added landmark/habitat batches trade nine draws for a lower total triangle count. This counter comparison excludes shadows, the Cinematic compositor, multiplayer actors, online photographs and physical-phone performance. No frame-rate improvement is claimed.
- The wetland density check reported **381,850 triangles** for Mobile and **498,742** at full world detail. Its camera was changed for a clear approach view, so it is not a before/after benchmark.
- Captures were inspected for sky clipping, landmark silhouettes and all five habitat identities. Physical Android GPU/heat, full co-op traversal, photo-material delivery and third-person readability during real combat remain manual checks.
