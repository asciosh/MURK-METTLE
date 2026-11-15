# v0.27 visual asset provenance

All new art in this release is original geometry, material/shader code or deterministic texture generation authored for MURK & METTLE. It ships as reproducible source for this project; this change does not introduce a repository-wide license or relicense existing code. No new external asset, paid generator, copied franchise design, texture download or audio file is introduced.

| Asset | Reproducible source | Runtime/distribution |
| --- | --- | --- |
| Curved leaves, feathers, tapered stems | `src/client/game/BotanicalGeometry.ts` | Generated indexed geometry; no binary download |
| Habitat flowers/foliage, wall vines, roots, facade details | `src/client/game/ShowcaseArt.ts` | Merged by material; smaller environment leaves use six rows |
| Five creature species, three forms each | `src/client/game/CreatureArt.ts`, `Companion.ts` | Original curved leaf/feather/finned forms, expressive faces, shared per-creature materials; batched rigid parts |
| Moss and leaf-litter PBR texture | `src/client/game/SurfaceMaterials.ts` | Existing 512px local albedo/normal/roughness generation budget |
| Terrain transitions and sky | `TerrainMaterial.ts`, `Atmosphere.ts`, `FieldGraphics.ts` in the client | Original shaders/material/lighting values |

The existing `public/models/survivor.glb` is unchanged: 39,496 bytes, 25 meshes, no skins, six rigid-node clips (Idle/Walk/Run/Attack/Hit/Death). It supplies compatible equipment; the procedural body remains responsible for articulated gameplay poses. **No new skeletal rig is claimed.** Existing optional photo-material licenses remain recorded in `src/client/game/photo-surfaces.json`; baseline and comparison captures use original local textures.

Blender is available but these assets are reproducible directly from their Three.js authoring source. The optional asset-production CLI is unavailable in this environment. No canonical provider package or compression benchmark is claimed.
