# M04 — NEXTGEN multi-creature sprite packs (v2)

## Scope

One device-local `.mmcreatures` ZIP can contain up to 128 appearance entries, including individual evolution forms. This is a parallel NEXTGEN sprite format; existing v1 `.mmcosmetic` GLB packages and limits are preserved. There is no change to player accounts, creature roster, room messages, combat, XP or ownership. Neither importer permits executable code or gameplay definitions.

The five currently playable species use these appearance keys: `lanternkin`, `emberling`, `mossback`, `stormrook`, `reedwisp`; append `-2` and `-3` for their evolved forms. An exact evolved appearance wins; otherwise the base key is used, then an enabled GLB pack, then original art. Unknown safely named keys are accepted for future catalog compatibility but are inert until the server and client officially register them. A pack does **not** create 100 playable species or modify evolution rules.

## Import

1. Open NEXTGEN → Creature Mods → Appearance Packs → Multi-creature 2.5D sprite packs.
2. Import the original sprite demo and enable it. It contains four original appearance entries, including all three Lanternkin forms. It is generated deterministically by `node scripts/build-nextgen-sprite-demo.mjs` from original CC0-licensed procedural pixel art; no commercial game assets.
3. Enter solo or co-op. The companion uses a world-space animated billboard and circular ground shadow. Co-op peers with different local packs can see different appearances of the same server-owned creature.
4. Disable or remove the sprite pack, or restore original appearances. Reload other already-open tabs to synchronize their local cosmetic selection. Only one v2 sprite pack is stored at a time; importing a new validated pack replaces the old one without touching v1 GLB packs. Failed validation retains the old pack.

## Author format

ZIP files are flat entries with safe relative paths, no directory entries, external URLs, scripts or undeclared files. Include `manifest.json`, `LICENSE.txt`, and declared PNG sheets. Example manifest:

```json
{
  "formatVersion": 2,
  "compatibility": "nextgen-sprite-pack-v2",
  "id": "original-sprite-demo",
  "name": "Original Sprite Demo",
  "version": "1.0.0",
  "author": "Artist Name",
  "license": "CC0-1.0",
  "rights": "original",
  "attribution": "Original work, source and permission description",
  "entries": [
    {
      "key": "lanternkin",
      "sprite": "sprites/lanternkin.png",
      "columns": 4,
      "rows": 2,
      "height": 1.1,
      "animations": {
        "idle": {"start": 0, "count": 2, "fps": 3},
        "walk": {"start": 2, "count": 2, "fps": 8},
        "attack": {"start": 4, "count": 2, "fps": 6},
        "pulse": {"start": 6, "count": 2, "fps": 4}
      }
    }
  ]
}
```

Frames are zero-based, row-major from the top-left. Idle is required; missing animations fall back to idle. `hit` and `faint` are accepted for later creature-health integration; current gameplay actually triggers idle, walk, accepted strikes and Pulse. Sprite height is a cosmetic metre scale between 0.25 and 2.5. Directional frames, full mixed GLB/sprite archives, multiple concurrent v2 packs and native species deployment remain future work.

Bounds: 24 MiB ZIP, 48 MiB expanded, 130 files, 128 appearance keys, 32 Mi-pixels total, 2 MiB per PNG, 1024 × 1024 image max, 8-bit RGB/RGBA non-interlaced, 128 cells per sheet, 1–24 fps. The existing strict ZIP parser and PNG decoder run in a disposable worker. Only visible creatures decode textures for rendering; each visual owns and disposes its image/texture/materials. Licensing declarations are mandatory but are not automatic copyright clearance. Only original or properly licensed content may be packaged or shared.

## Verify

Run `npm test`, `npm run typecheck`, `npm run build`, and start `npm run dev:cloudflare`. From a second terminal run:

```powershell
node tests/browser/nextgen-sprite-pack.cjs
node tests/browser/nextgen-creature-mods.cjs
$env:NEXTGEN_SPRITE_TEST = '1'
node tests/browser/nextgen-room-field.cjs
Remove-Item Env:NEXTGEN_SPRITE_TEST
```

The local source tests validate an actual 100-entry ZIP, duplicate keys, unsafe paths, undeclared files, malformed animation tracks, legacy v1 limit isolation and frame playback. Real browser rendering and human visual acceptance remain operator checks.
