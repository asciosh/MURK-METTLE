# Optional original GLB assets (v0.9.1)

Drop **your own or licensed** `survivor.glb`, `zombie.glb`, and `lanternkin.glb` in this directory. Then edit `manifest.json`:

```json
{
  "survivor": { "url": "/models/survivor.glb", "scale": 1, "yOffset": 0, "yawOffset": 0 },
  "zombie": { "url": "/models/zombie.glb", "scale": 1 },
  "lanternkin": { "url": "/models/lanternkin.glb", "scale": 1 }
}
```

Only list assets that actually exist. The game uses improved procedural models when entries are missing.

## Blender export contract
- Apply transforms, face forward along **-Z**, ground contact at Y=0, 1 Blender unit = 1 game meter.
- Export **glTF 2.0 (.glb)**, include skins and animation actions, textures embedded where possible.
- Name animation actions **Idle, Walk, Run, Attack, Hit, Death, Pulse** (case-insensitive); absent actions fall back to Idle.
- Use skeletal animation with clean roots and avoid exporting collision meshes in the visible model.
- Prefer 2k–8k triangles for a survivor, 1k–5k for a zombie; 512px–1k compressed textures for initial browser testing.
- Test model scale and alignment, performance, and copyright/provenance before shipping.

This pipeline deliberately does **not** include external models or third-party character artwork.
