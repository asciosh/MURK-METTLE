# v0.21 — Wildlands expansion

## Graphics and exploration

- The playable sector grows from approximately 45.4 × 45.4 metres to 180 × 180 metres (about 15.7 times the area).
- Added the abandoned Haven settlement, Reedwater wetland and East Ridge relay, with map labels, creature habitats and four supply caches.
- Replaced the old forest with instanced trunks, textured leaf cards, grass, ground detail and distant hills. Buildings have weathered brick/plaster surfaces, boarded windows, rooflines, vegetation and abandoned vehicles.
- Atmospheric sky, sky environment lighting, directional shadows that follow the player, bump-mapped ground, desaturated equipment and more restrained survivor proportions.
- Shoulder camera narrows while aiming and moves in front of solid obstacles. Performance graphics mode disables shadows and caps render resolution.
- This remains original procedural art, not photoreal scanned assets or a new skinned character. The previous survivor GLB is preserved but its manifest entry is disabled so it does not replace the revised survivor. The actor GLB loader remains available.

## Firearms

- LMB fires; RMB aims. 1 selects the 12-round pistol; 2 selects the 30-round automatic carbine. R reloads while alive and restarts after defeat. Space retains melee.
- Finite magazine/reserve ammo, timed reloads, muzzle flashes, brief tracers, hit feedback and synthesized gun/reload sounds.
- Supply caches restore reserves, with a 45-second cooldown per cache/player. Ammunition is session state, replenished on defeat; it is not account inventory.
- Cloudflare checks directions, hit volumes, map obstructions, range, fire rates, reloads, ammo and resupply distance. The browser does not declare hits or damage.

## Collection and evolution

| Species | Habitat | Forms | Base pulse |
|---|---|---|---|
| Lanternkin | Near the field camp (4.2, -3.8) | Lanternkin → Luminbloom → Grovewarden | 35 damage / 7.5m / 8s |
| Emberling | Haven (8, -54) | Emberling → Cinderhorn → Ashcrown | 48 damage / 6m / 10s |
| Reedwisp | Reedwater (-48, -28) | Reedwisp → Mistwing → Tideveil | 28 damage / 11m / 6s |

- Approach and press E to bond. Select an owned companion in the journal or press C to cycle. Q uses its pulse.
- Each species evolves automatically at 120 and 400 XP. Forms have different size, silhouette details, name and pulse power. Each stage adds 15 damage and 1m range, reducing cooldown by 1 second (minimum 4 seconds).
- Your active bonded creature earns 12 XP from a melee/firearm kill and 40 from a pulse kill. Solo nonlethal pulses grant 10 XP; co-op currently awards creature XP only on kills.
- Independent species ownership/XP and the selected companion persist. Existing Lanternkin progress migrates without resetting accounts. Solo and trusted co-op collections remain separate, as their economies were before this release.
- Building collision is shared by client and server. Distant encounters relocate near the party when it travels across the expanded sector. This version retains one active infected encounter at a time, rather than introducing hordes.

## Compatibility

No Durable Object names, binding names, migrations, historical save keys, PIN hashing or account revisions were deleted. New collection data is additive. Production uses `server/cloudflare/`, and the browser uses `src/client/game/`; the historical `worker/` and `src/game/` copies are not active.

`npm run dev` now starts the complete Wrangler Worker and a Vite build watcher. The old standalone Node WebSocket server remains accessible through `npm run server`; it does not implement authenticated accounts or the expansion protocol.
