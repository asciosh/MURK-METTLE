# Original GLB assets (v0.10)

The included **survivor.glb** was authored programmatically for Murk & Mettle without third-party game art. It includes node-transform animation clips `Idle`, `Walk`, `Run`, `Attack`, `Hit`, and `Death`. It is an original **animated GLB**, not a skinned/bone-rigged character. For more sophisticated deformation, use a skinned model exported from Blender.

You can replace it with **your own or properly licensed** `survivor.glb`, `zombie.glb`, and `lanternkin.glb` here. Then edit `manifest.json`:

```json
{
  "survivor": { "url": "/models/survivor.glb", "scale": 1, "yOffset": 0, "yawOffset": 0 },
  "zombie": { "url": "/models/zombie.glb", "scale": 1 },
  "lanternkin": { "url": "/models/lanternkin.glb", "scale": 1 }
}
```

Only list assets that actually exist. The survivor requires Idle, Walk, Run and Attack clips; a static GLB is intentionally rejected so it cannot remove movement animations.

No third-party assets ship in this build. For a legal model, create your own in Blender or verify the model license permits redistribution and commercial release (CC0 is simplest). Retain the original license, source link, author and modification notes in an asset register. The game uses improved procedural models when entries are missing.

## Blender export contract
- Apply transforms, face forward along **-Z**, ground contact at Y=0, 1 Blender unit = 1 game meter.
- Export **glTF 2.0 (.glb)**, include skins and animation actions, textures embedded where possible.
- Name animation actions **Idle, Walk, Run, Attack, Hit, Death, Pulse** (case-insensitive); absent actions fall back to Idle.
- Use skeletal animation with clean roots and avoid exporting collision meshes in the visible model.
- Prefer 2k–8k triangles for a survivor, 1k–5k for a zombie; 512px–1k compressed textures for initial browser testing.
- Test model scale and alignment, performance, and copyright/provenance before shipping.

This pipeline deliberately does **not** include external models or third-party character artwork.
