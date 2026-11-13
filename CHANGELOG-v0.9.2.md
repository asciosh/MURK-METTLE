# Murk & Mettle v0.9.2 — Visual Identity Pass

## In-game changes
- Survivor equipment silhouette: field backpack, chest harness, shoulder pads, rebreather/mask and emissive device.
- Smoother survivor walk/run blend and idle breathing sway; existing attack mechanics unchanged.
- Zombie organic strain detailing, additional facial mutation growths and more expressive chase/attack posing.
- Lanternkin antennae motion, blinking, breathing and improved personality.
- Procedural tileable terrain textures for grass and dirt, randomized ground patches, lichen, stones and tree roots.
- Light environmental pollen motes; no new image dependencies, textures generated directly with Canvas API.
- Preserves game logic, multiplayer protocol, saved data keys and map collision geometry.

## Limitations
- All character upgrades are original procedural fallback models, **not externally rigged GLB assets**.
- The existing optional GLB manifest pipeline still works; supplying Blender-generated rigs is a separate asset production step.
- Co-op remains unverified in a real four-client setup; no networking protocol changes made.

## Test
1. Run `npm ci && npm run build && npm run dev` in Codespaces.
2. Walk, sprint, attack, take damage, die and restart.
3. Verify Lanternkin bonding, Q pulse, zombies, crafting, mission extraction, saves, minimap.
4. Check visuals and GPU performance in browser; compare with v0.9.1.
5. Test GLB manifest replacements separately if you have assets.
