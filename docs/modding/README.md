# Local creature cosmetics · v1

MURK & METTLE supports small, device-local creature cosmetic packs. Official species, all fifteen evolution forms, ownership, XP, abilities, cooldowns, hitboxes, collision, inventory and server rules remain official. No mod files or mod IDs are sent through room messages or cloud saves.

MURK & METTLE remains independent of Nintendo, Pokémon and other third-party franchises. No authorization, endorsement or affiliation is claimed. A community author, local installation, noncommercial intent or download does not establish permission to use someone else's characters, logos, models or other protected content. Do not include, distribute or link unauthorized third-party assets. This framework is brand-neutral and does not include game-asset extraction or franchise-specific conversion tools.

## Player workflow

Open **Field Menu → Creature Mods**. Import a `.mmcosmetic` or `.zip` from your own device, inspect the preview and author/license, then choose Enable. Importing alone does not enable a pack. Only one pack per official species can be active; enabling another replaces that local selection. Disable restores the original appearance; Remove also deletes the local package; Restore originals disables every local replacement. Preview is independent of the enabled selection.

The original **Copperbloom** demo can be imported with the demo button, or downloaded from `/mod-examples/copperbloom.mmcosmetic`. It is original CC0 art, not a third-party character. It includes an actual 772-triangle GLB with three node-rotation clips and a PNG icon. It is not a skeletal rig. Full source and hash/provenance records are in `examples/creature-mods/copperbloom/` and `scripts/build-demo-cosmetic.mjs`.

Packages/settings persist only in the current browser/WebView profile and origin, in the separate `murk-mettle-cosmetics` IndexedDB database. They are not account progression and do not sync. Clearing site data removes them. Storage denial/quota failures produce an error without changing account data or granting ownership. Invalid/missing stored assets keep the original visuals. Browser storage is not a rights registry or authenticity guarantee.

On Windows, the existing Tauri host loads the same hosted game. Its WebView2 **HTML file input opens the operating system's user-selected file chooser**. This is the native-picker import path for v1: no directory scan, mods folder, new Rust file command or filesystem capability is needed. The remote game still receives no Tauri capabilities. Windows browsers use the same selected-file flow; Android/mobile support has been retired. Native WebView2 importing requires manual acceptance testing after deploying this frontend; the earlier desktop installer smoke test did not test this new feature.

## Manifest contract

See [manifest.schema.json](manifest.schema.json) and the original demo's [manifest](../../examples/creature-mods/copperbloom/manifest.json). The JSON schema documents structural authoring constraints; the runtime also validates binary files, names, CRCs, image data, references and budgets. Passing the schema alone is insufficient.

Required fields: `formatVersion: 1`, `compatibility: "creature-cosmetics-v1"`, namespaced lowercase/hyphen `id` (3–64 chars), `name`, numeric three-part `version`, `author`, `license`, `attribution`, `rights` (`original` or `licensed`), official `species`, and package-relative `model` ending in `.glb`. No control characters or extra properties are accepted. A license/rights assertion is a declaration, not independent verification.

Optional fields:

- `textures`: up to four package-relative PNG paths. Embedded PNGs inside the GLB are also supported. No HTTP, data or blob URI references may appear in input models.
- `icon`: package-relative PNG, at most 256×256. An enabled pack's icon appears beside the official companion name; official names and stats remain unchanged.
- `animations`: case-sensitive clip-name mapping for `idle`, `walk`, `run`, `pulse`, `hit`. Current companions use idle/walk/pulse presentation. Run/hit are reserved mappings; they do not add game states. Missing mapped clips use idle, then static pose; official root bob, growth and pulse scaling remain available. Clips can only rotate nodes. No root-motion or scale tracks.
- `effects`: at most one `{ "type": "pulse-glow", "strength": 0..1 }`. It changes existing model emissive intensity on a cosmetic pulse; it creates no lights, particles, shaders, sounds or gameplay actions. Performance suppresses this accent with the existing point-light setting. Preview respects reduced-motion preferences by disabling automatic animation.

Compatibility is an explicit renderer contract, independent of the game's release number. Future support for skins, morphs or extensions requires a reviewed validator/renderer change; it cannot be enabled by declaring a different extension in a pack.

## Pack contents and authoring

A ZIP package contains `manifest.json`, `LICENSE.txt`, the declared GLB, and optional declared PNGs. There are no scripts or plugins. Paths are ASCII relative names with `/` separators; no traversal, absolute/device names, backslashes, URL encoding, duplicate names (case-insensitive) or undeclared files. `LICENSE.txt` must contain the applicable license/dedication and required notices; include attribution and modification information required by your source license. Attribution is rendered as plain text, never executed or fetched.

V1 accepts canonical, non-streaming single-disk ZIPs using STORE or DEFLATE. It rejects encryption, ZIP64, data descriptors, extra fields/comments, explicit directories, symlinks, special files, prepended/trailing payloads and inconsistent/overlapping directory records. Directory paths inside filenames are allowed; directory entries themselves are unnecessary. Some GUI ZIP tools add unsupported metadata. Use the source writer or a seekable Python `zipfile.ZipFile` with regular `writestr()` entries, no extra fields, and `ZIP_STORED` for the most portable output. These restrictions are explicit v1 format limits, not a generic ZIP compatibility promise.

The GLB must use standard uncompressed glTF 2.0, one scene, one embedded binary buffer and triangle meshes. Use opaque/MASK PBR materials and 8-bit RGB/RGBA, non-interlaced PNGs. Skins, bones, morphs, cameras, lights, extras, all glTF extensions, external buffers and compressed/decoder-dependent assets are rejected. Static meshes and node rotation animation work. Repeated mesh nodes count toward the submitted triangle, vertex and primitive budgets. Geometry and keyframe values must be finite; quaternions normalized; the node hierarchy acyclic and at most six levels deep. Use simple unique node names. No custom animation-binding paths are accepted.

Author with +Y up, -Z forward and the creature center at the origin. The loader conservatively normalizes the entire possible rotational envelope to radius 0.75 game units, then inherits the official 1 / 1.28 / 1.56 growth and pulse scale. The official root heights remain 1.25 for Lanternkin/Stormrook/Reedwisp, 0.58 for Emberling, and 0.43 for Mossback. Design ground clearance for all three forms, especially the grounded species. Mods never move the gameplay root to compensate for art. A single skin covers all three official forms of its selected species.

### Hard budgets

| Resource | Limit |
| --- | ---: |
| Import ZIP | 8 MiB |
| Total extracted contents | 16 MiB |
| Archive entries | 16 |
| Stored packages | 8 (64 MiB maximum archive bytes) |
| GLB | 6 MiB; JSON chunk 256 KiB |
| Meshes / primitives / materials / nodes | 24 / 24 / 16 / 64 |
| Triangles / declared primitive vertices | 12,000 / 24,000 |
| Accessors / buffer views | 128 / 128 |
| Accessor scalar values | 250,000 total |
| PNG file / dimensions | 2 MiB / 1024×1024 |
| Icon | 256 KiB / 256×256 |
| Combined decoded image pixels | 4,194,304, including icon and embedded images |
| Images / texture objects / samplers | 4 / 4 / 4 inside the GLB |
| Clips / tracks / sampled input keys | 12 / 64 / 2,048 |
| Clip duration | 10 seconds maximum |
| Validation worker | terminated after 15 seconds |

Validation jobs are serialized so restoring several packs cannot launch several decompression workers at once. ZIP expansion is checked against declared sizes before decoding and actual streamed output while decoding. PNG CRCs, chunk structure, scanline expansion and dimensions are checked before browser image decoding. GLB accessors/indices/references and animation tracks are checked before Three.js parses the model. Main-thread GLTF parsing is bounded but can still cause a short loading stall; mod GPU cost varies by asset/device. Budgets are ceilings, not a performance guarantee. Prefer under 3,000 triangles, few materials and 256–512px maps for lower-powered Windows PCs.

## Original demo and reproducibility

```sh
npm ci
node scripts/build-demo-cosmetic.mjs
node --test tests/mods-security.test.mjs
```

This rebuilds the original GLB, PNG, manifest/license, provenance/hash JSON and public import ZIP from source. The demo uses mathematical Three.js geometry and a programmatic raster icon; no provider, downloaded imagery, reference character or paid service was used. The game-dev asset CLI was unavailable; validation uses the actual bytes, the v1 validator and Three.js/browser import. No sealed asset-package receipt or professional rig is claimed. The application-specific ZIP is the requested mod format, not the game-dev CLI's canonical package format.

## License and redistribution policy

V1 accepts declared CC0-1.0, CC-BY-4.0, MIT and Apache-2.0 assets. Their conditions differ: retain applicable attribution, license text, notices and modification statements. Verify that a license applies to **the actual asset**, that the uploader has the necessary rights, and that the intended use/distribution is covered. A license label cannot grant rights the creator does not own. No noncommercial/no-derivatives or unverified custom licenses are admitted by this initial redistribution-oriented format. Written rights-holder authorization could support a properly licensed future pack after review; none is implied or presently claimed.

There is no public mod marketplace or third-party download catalog in this release. If community distribution is introduced, require provenance review before listing, a visible reporting channel, prompt listing suspension while a credible report is reviewed, and a documented decision/appeal process. For suspected infringement in this repository's assets, file a repository issue identifying the pack ID/hash, specific content, source and basis of the rights concern; do not include PINs, session cookies, private identity documents or unauthorized asset copies. Moderation/legal review is separate from technical format validation.

## Implementation and validation

`src/client/mods/` separates archive/GLB policy, disposable worker validation, device-only storage, reference-counted model resources, cloned visual/mixer state and manager/preview UI. `Companion` adds a separate cosmetic mount; its root, official species ID, bonding distances and progression remain unchanged. The local registry is optionally passed to `CoopVisuals`; a client without it renders official creatures. No server, account, progression or wire types are extended.

Geometry/textures are shared per validated source. Each visible replacement owns cloned materials and an AnimationMixer. Disable/remove or actor disposal releases leases; inactive unused sources and image bitmaps are disposed. Pending loads and previews check generations/disposal state. The preview is DPR 1, at most 15 frames/second, and releases its WebGL context when closed. Enabled packs can retain a bounded source cache while actors use them. Previewing a disabled pack intentionally retains it until the preview closes.

Run `npm test`, `npm run typecheck`, `npm run build`. With Playwright, Chromium and `npm run dev:client` on port 5173, run `node tests/browser/mods.cjs`; it uses a controlled authenticated fixture, stops the simulation/animation loop and suppresses pointer capture to test the actual manager, renderer and local registry. Existing browser character/interface/combat fixtures remain useful regressions. Test compiled production worker loading separately; Vite development success alone does not establish deployed Worker behavior.

Manual acceptance still includes a Windows PC file chooser and performance, real WebView2 import/IndexedDB behavior, real room play with four Windows PC clients, and native fullscreen/focus/resize flows. No pack models or identifiers should appear in account saves or WebSocket packets. Test corrupted/missing local data and clearing site storage; original creatures must remain available. No FPS or physical-device result is implied by software-rendered screenshots.

See [the validation record](VALIDATION.md) for actual checks, GPU resource counts and remaining manual tests.
