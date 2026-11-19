# M04-C6 — Local creature-pack workshop

This optional offline authoring command packages supplied original or appropriately licensed assets in the formats the existing browser importer accepts. It does not download content, extract an arbitrary third-party ZIP, register species, alter combat, or upload anything. A declared license does not itself prove rights. Keep input and generated packs outside the git repository.

Create a folder such as `C:\DockerSimo\AssetWorkshop\CreaturePacks\MyPack`. Put your authorized source files, actual `LICENSE.txt` and `pack.json` in it. Source paths must be relative to that folder. For a sprite pack:

```json
{
  "type": "sprite",
  "id": "my-creature-pack",
  "name": "My Creature Pack",
  "version": "1.0.0",
  "author": "Actual artist name",
  "license": "CC0-1.0",
  "rights": "licensed",
  "attribution": "Actual asset source and permission evidence",
  "entries": [
    { "key": "lanternkin", "file": "base.png" },
    { "key": "lanternkin-2", "file": "second.png" },
    { "key": "lanternkin-3", "file": "third.png" }
  ]
}
```

Each static PNG defaults to one idle frame and 1.1 m height. Optional `columns`, `rows`, `height` and `animations` use the [sprite spec](M04-SPRITE-PACKS.md). Map the three forms of each of the five original families; up to 128 entries are accepted, but unregistered keys remain inert. For a GLB cosmetic, use the same metadata and `"type": "glb", "species": "lanternkin", "model": "model.glb"` instead of `entries`. Optional `icon`, `animations` and `effects` follow the v1 spec. Export self-contained GLB first; the tool does not rig or convert FBX/OBJ. C7 adds optional `"form": 1`, `2` or `3` for exact NEXTGEN evolution appearances; omitting it preserves the original species-wide behavior. Only eight separate GLB packs may be stored at a time. See [C7 guide](M04-C7-GLB-FORMS.md).

From the main repository:

```powershell
$source = 'C:\DockerSimo\AssetWorkshop\CreaturePacks\MyPack'
$output = 'C:\DockerSimo\AssetWorkshop\CreaturePacks\MyPack.mmcreatures'
node scripts/build-local-creature-pack.mjs $source $output --check
node scripts/build-local-creature-pack.mjs $source $output
```

For GLB use output extension `.mmcosmetic`. Output parent must exist, output is never overwritten, and it must be outside the repository. The command runs the exact import validation before writing. In Creature Mods, choose Import & Enable Packs, select the files and play; Use Originals disables the installed appearances. The existing browser validator is still authoritative for import; assets are never allowed to modify account or combat data.
