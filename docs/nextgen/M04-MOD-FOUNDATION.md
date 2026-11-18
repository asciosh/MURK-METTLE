# M04-A — original creature archive and NEXTGEN local cosmetics

**Scope:** M04-A only. No Pokémon assets or copyrighted franchise content added.

## Original creatures — archived, not deleted

`archive/M03-ORIGINAL-CREATURES.json` is a frozen snapshot of the five M03 species, their 15 forms, powers and habitats. The original procedural visuals and `shared/collection.mjs` remain available as compatibility fallbacks. Existing accounts, creature XP, equipment, storage, Durable Object bindings and server ownership are **not migrated or reset**.

The original species stay temporarily active while the new data-driven creature roster is developed. This avoids orphaned creatures in existing saves. The next M04 checkpoint will introduce new creature identifiers and evolution rules through a **reviewed, server-authoritative schema migration**, not by allowing arbitrary client packs to modify trusted game state.

## NEXTGEN mod workflow (first usable step)

1. Open `/?nextgen=lobby&tab=mods` or **Creature Mods** from the main menu.
2. Import a local `.mmcosmetic` file or click **Import Original Demo Pack**.
3. Inspect the preview, declared license and artist/attribution; select **Enable**.
4. Enter solo or co-op: the visual replaces the selected original species **on this browser only**. Networked species ID, stats, hit detection, ownership, capture and XP are unchanged.
5. **Disable** or **Restore Original Appearances** to revert safely. **Remove** deletes the local package.

The engine reuses `src/client/mods/`'s proven ZIP/GLB/PNG worker validator (size/path/texture/geometry/animation caps), local IndexedDB `murk-mettle-cosmetics`, and the original CC0 `copperbloom.mmcosmetic` demo pack. No scripts, arbitrary game mechanics, file-system scanning or remote fetch from user-supplied URLs. Only original or appropriately licensed content may be shared or used. A license claim by a mod author is not automatic proof of copyright permission.

**Known boundary:** cosmetic v1 targets the five original species; it does not add standalone Pokémon or other new species, battle rules, captures, evolution methods, new abilities, gameplay assets, account entitlements or cross-device synchronization. That work belongs to later M04 checkpoints.

## Verification

```
node --test tests/nextgen/m04-original-archive.test.mjs
node --test tests/mods-security.test.mjs
npm test
node --test tests/nextgen/*.test.mjs
npm run typecheck
npm run build
npm run dev:cloudflare
# in a second terminal:
node tests/browser/nextgen-creature-mods.cjs
node tests/browser/nextgen-unified-menu.cjs
node tests/browser/nextgen-room-field.cjs
```

Manual: test one original demo cosmetic on a Lanternkin in solo and in a signed-in co-op room; observe the same visual override on that browser but **not** on an independent browser without the pack. Confirm no changes to XP/creature ownership in account data. Disable the mod and check that the original appearance returns. A failed/corrupted pack must leave the original appearance intact.

**No merge, push, deployment or cloud migration in the apply script.** PR target is `nextgen` only after Windows verification.
