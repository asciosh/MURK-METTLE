# NEXTGEN Character Models

These models are exclusive to NEXTGEN.
Legacy character assets remain unchanged.

## Survivor Model

### Sources

- Human mesh, textures, hair and clothing:
  MakeHuman Community MPFB 2.0.18 system assets.
  License: CC0 1.0.
  https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html

- Animations: Quaternius Universal Animation Library (Standard).
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
- Size: approximately 2.84 MiB
- Triangles: 33,492
- Skeletons: 1
- Bones: 53
- Meshes: 7
- Animations: Idle, Walk, Run, JumpStart, JumpLoop, JumpLand, Dodge, Aim, PistolShoot, PistolReload, AimUp, AimDown
- SHA256: A84155E775DAACD7A89496BE0FBC3E75B3038A3D61131BB30B092DE92F02AF8E

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
- Size: approximately 3.61 MiB
- Triangles: 32,728
- Skeletons: 1
- Bones: 53
- Meshes: 7
- Textures: 8
- Animations: Idle, Walk, Run, Attack, Hit, Death
- SHA256: BA45A8CC7558B0E347C764B8997ADA40B9F7FEE2471FF33DAFBF76B253E3B71E