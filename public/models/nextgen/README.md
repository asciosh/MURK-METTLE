# NEXTGEN Survivor Model

## Sources

- Human mesh, textures, hair and clothing:
  MakeHuman Community MPFB 2.0.18 system assets.
  License: CC0 1.0.
  https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html

- Animations: Quaternius Universal Animation Library (Standard).
  License: CC0 1.0.
  https://quaternius.itch.io/universal-animation-library

## Production

Created in Blender 5.3 using the MPFB GameEngine rig.
Animations retargeted to the survivor skeleton.
Jump arm poses and ground alignment refined.
Dodge ground clearance corrected.

Exported as GLB with embedded textures, resized to 1024px
and compressed using glTF Transform 4.5.0.
Opaque material rendering corrected.

## Animation mapping

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

## Asset specifications

- File: survivor.glb
- Size: approximately 2.70 MiB
- Triangles: 33,492
- Skeletons: 1
- Meshes: 7
- Animations: 7
- SHA256: 2A3177F625D1F21656E19718D1005D6EE5148C0CFD6658AAC7BEE3CBBE3E1AED

This model is exclusive to NEXTGEN.
The legacy survivor remains unchanged.