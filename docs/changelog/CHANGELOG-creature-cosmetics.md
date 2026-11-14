# Local creature cosmetic mods · first version

- Add a versioned, brand-neutral package format, author/license metadata, original demo GLB and reproducible asset/provenance sources.
- Validate bounded ZIP expansion, paths, file types/CRCs, PNG dimensions/data, GLB resources, geometry and node animation in a disposable worker before admission/activation. Reject executable content, external model resources, unsupported extensions, skins and root motion.
- Add Field Menu → Creature Mods with import, 3D preview, enable/disable/remove, rights/license information and restore-originals controls. Store cosmetics separately in device-local IndexedDB, never in accounts or cloud progression.
- Attach replacements to a separate Companion visual layer and optionally render them for remote companions on the same client. Official creature identities, all growth rules, bonding, collision, combat and room packets remain unchanged. Clients without a local pack keep official art.
- Share source geometry/textures, own visual materials/mixers, and dispose inactive resources/previews. Use the browser/WebView2 system file chooser without granting new native filesystem permissions.

See [mod authoring/security documentation](../modding/README.md), the [manifest schema](../modding/manifest.schema.json) and [original Copperbloom asset](../../examples/creature-mods/copperbloom/README.md). Local/community authorship is not proof of third-party rights. No unlicensed franchise assets or mod marketplace are included.
