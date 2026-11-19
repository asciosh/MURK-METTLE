# M04-C7 — 3D evolution appearance slots

Production visuals remain 3D; optional user-installed sprite packs retain priority. GLB cosmetic manifests may now specify `"form": 1`, `2` or `3`. Omit `form` for the existing species-wide override. The existing v1 archive parser, GLB budgets, license/provenance checks and eight-pack storage cap remain unchanged. Older game builds reject the new optional field; existing packs keep working unchanged in C7. Legacy gameplay continues selecting only species-wide cosmetics.

One enabled pack per species + exact form slot (including one separate species-wide slot). NEXTGEN resolves enabled sprite first, then the exact GLB form, then the species-wide GLB, then original art. The current trusted form XP is already projected from the actual native form ID by the room server: 0 / 120 / 400. Lifetime XP does not cause premature native appearance changes; after explicit evolution and redeployment the new selected model loads. Solo practice continues to use the starter form. No new species, gameplay authority, account fields, storage migrations, deployment or asset imports into Git.

## Convert your previously downloaded Zoonami preview locally

The previously provided pack contains three separate species-wide GLB archives. In the repo PowerShell terminal, adapt the directory to the actual extracted location:

```powershell
$packs = 'C:\DockerSimo\AssetWorkshop\CreaturePacks\ZoonamiPreview'
node scripts/retarget-local-3d-pack.mjs "$packs\zoonami-lanternkin-3d-4.mmcosmetic" "$packs\zoonami-lanternkin-form-1.mmcosmetic" 1
node scripts/retarget-local-3d-pack.mjs "$packs\zoonami-lanternkin-3d-8.mmcosmetic" "$packs\zoonami-lanternkin-form-2.mmcosmetic" 2
node scripts/retarget-local-3d-pack.mjs "$packs\zoonami-lanternkin-3d-28.mmcosmetic" "$packs\zoonami-lanternkin-form-3.mmcosmetic" 3
```

The helper validates the source and regenerated package, retains original model/texture/license bytes, gives the output a new form-specific ID, never overwrites existing files, and only writes outside the repo. No third-party content is bundled with C7 itself. For a new GLB authored in C6 workshop, set `form` directly in its `pack.json`.

Open Creature Mods. In the C8 appearance library, disable the sprite pack, disable or remove older species-wide overrides if desired, then use Import & Enable Packs to select all three new form packs together. All three should show ENABLED LOCALLY at once. Preview each under Details. Importing a competing pack on the same exact slot disables only that slot's previous selection. The peer without the cosmetic pack sees original visuals. Use Originals disables everything without deleting installed packs; Disabled packs lets you re-enable them.

## Verification

```powershell
npm test
npm run typecheck
npm run build
npm run dev:cloudflare
```

In a second terminal:

```powershell
$env:GAME_URL = 'http://127.0.0.1:8787'
node tests/browser/nextgen-creature-mods.cjs
node tests/browser/nextgen-sprite-pack.cjs
$env:NEXTGEN_GLB_FORMS_TEST = '1'
node tests/browser/nextgen-room-field.cjs
Remove-Item Env:NEXTGEN_GLB_FORMS_TEST
Remove-Item Env:GAME_URL
```

The opt-in browser scenario imports three exact form slots from the original project demo, checks persistence, the starter model on the modded client and original on a peer, then earns actual XP, checks the starter remains until explicit evolution, evolves and redeploys into the second model. Unit tests cover the third form, species and slot isolation, disabled fallback, native form vs XP, rejected invalid manifests and exact license/asset byte preservation. The operator must run the browser acceptance on a full built checkout. Static user assets still need rigging/animations for final art quality.
