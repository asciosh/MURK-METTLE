# Copperbloom

Original CC0 creature cosmetic for the official Lanternkin identity and its three growth stages. A copper seed lantern with a verdigris petal crown and luminous heart. This is an original design, not a third-party character or a skeletal rig.

- `model.glb`: actual standard GLB, 772 triangles, with Breathe / Rustle / Unfurl node-rotation clips.
- `icon.png`: original 128×128 programmatic icon.
- `manifest.json`, `LICENSE.txt`: v1 contract and rights/dedication.
- `PROVENANCE.json`: byte counts, SHA-256 hashes and production notes.
- Source: `scripts/build-demo-cosmetic.mjs` and `scripts/cosmetic-zip.mjs`.
- Importable ZIP: `public/mod-examples/copperbloom.mmcosmetic`.

Rebuild with `node scripts/build-demo-cosmetic.mjs`. See `docs/modding/README.md` for authoring limits and the separation between technical validation and rights permission. The sample README/provenance/source files are not inside the import ZIP; only the four declared runtime files are admitted.
