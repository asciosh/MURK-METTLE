# NEXTGEN Character Models

These models are exclusive to NEXTGEN.
Legacy character assets remain unchanged.

## Survivor Model

### Sources

- Human mesh, textures, hair and clothing:
  MakeHuman Community MPFB 2.0.18 system assets.
  License: CC0 1.0.
  https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html

- Animations: Idle, Walk, Run, JumpStart, JumpLoop, JumpLand, Dodge, Aim, PistolShoot, PistolReload, AimUp, AimDown, Hit, Death, Melee, Bandage, Pickup
  License: CC0 1.0.
  https://quaternius.itch.io/universal-animation-library

### Production

Created in Blender 5.3 using the MPFB GameEngine rig.
Animations retargeted to the survivor skeleton.
Jump arm poses and ground alignment refined.
Dodge ground clearance corrected.

Exported as GLB with embedded textures, resized to 1024px
and compressed using glTF Transform 4.5.0.
Opaque material rendering corrected.

### Animation mapping

| Game clip | Source animation |
|---|---|
| Idle | Idle_Loop |
| Walk | Jog_Fwd_Loop |
| Run | Sprint_Loop |
| JumpStart | Jump_Start |
| JumpLoop | Jump_Loop |
| JumpLand | Jump_Land |
| Dodge | Roll |

Animation playback is synchronized with gameplay movement.
Character movement and physics remain controller-driven.

### Asset specifications

- File: survivor.glb
- Size: approximately 3.23 MiB
- Triangles: 39,720
- Skeletons: 1
- Bones: 53
- Meshes: 8 (7 skinned character meshes, 1 rigid backpack)
- Animations: Idle, Walk, Run, JumpStart, JumpLoop, JumpLand, Dodge, Aim, PistolShoot, PistolReload, AimUp, AimDown
- SHA256: 9503F2C6E300512F9DC0DACC4A02CDD28F6EAC238FE816DD84611AC803BCCA8A

### M03 pickup and backpack

Pickup: Quaternius Universal Animation Library (CC0), Fixing_Kneeling retargeted with authored reach, grasp, lift and stow at 1.35s. The original procedural canvas backpack is parented to spine_03; all previous survivor geometry and clips retained. Contact is at 450ms, stow at 1100ms.

## Infected Model

### Sources

- Human mesh, textures and clothing:
  MakeHuman Community MPFB 2.0.18 system assets.
  License: CC0 1.0.
  https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html

- Animations: Quaternius Universal Animation Library (Standard).
  License: CC0 1.0.
  https://quaternius.itch.io/universal-animation-library

### Production

Created in Blender 5.3 using the MPFB GameEngine rig.
Animations retargeted to the infected skeleton.
Exported as GLB with embedded 512px PNG textures.
Redundant animation keyframes removed using glTF Transform.
Original two-arm zombie attack animation authored in Blender.
Opaque material rendering corrected; eyebrow and eyelash transparency preserved.
Emaciated body proportions, gaunt facial features, decayed skin,
clouded eyes and distressed clothing.
Original skeleton, skin weights and animation data preserved.

### Animation mapping

| Game clip | Source animation |
|---|---|
| Idle | Idle_Loop |
| Walk | Walk_Loop |
| Run | Jog_Fwd_Loop |
| Attack | Original zombie lunge (Blender) |
| Hit | Hit_Chest |
| Death | Death01 |

The asset uses in-place animations for controller-driven movement.

### Asset specifications

- File: infected.glb
- Size: approximately 2.94 MiB.
- Triangles: 32,728
- Skeletons: 1
- Bones: 53
- Meshes: 7
- Textures: 8
- Animations: 14, including Hit and Death.
- SHA256: 792DCD134EAE93D1FBED9026B6D4BCF4E6B310BD500D0AEE376C9E4E6E4E6334

## Optional cosmetic character variants

Four survivor and four infected variants are stored in `variants/`. They reuse the existing 53-bone skeletons and complete animation sets, with original authored gear, material and texture variations based on the existing CC0 assets. No gameplay attributes differ. See `variants/manifest.json` for hashes, triangle counts and clip names.

Demo options: `?mode=playable&skin=ranger&infected=mixed`. Survivor: ranger, medic, scavenger, sentinel. Infected: withered, ashen, ravager, feral or mixed. Omit parameters for the original baseline.
