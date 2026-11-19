# M04-C1 — Account-owned creature instances

**Scope:** first additive storage checkpoint, approved by the operator on 2026-11-19. The existing M04-B catalog and 120/400 XP progression are preserved. This checkpoint is not the complete M04 collection or a new market.

## Persistent ownership

- New key `nextgen-creature-roster-v1` in the existing PlayerAccount Durable Object. No binding, migration tag, account record, legacy save key, or WebSocket packet changes.
- On the first authenticated journal read, each legitimately owned legacy species is imported once with a server-generated UUID, family ID, canonical form ID, lifetime XP, origin and availability status. Unowned species are not imported.
- Subsequent verified legacy account rewards and bonding reconcile the initialized roster in the same transaction. The original collection remains the authority for existing combat and the selected species. XP never decreases and existing evolution forms are not reset. Legacy accounts that never open the journal do not create the new key.
- The authenticated GET `/api/account/nextgen-roster` exposes only the requesting account's roster. There is no public write, grant, XP, purchase, or evolution API. Existing legacy auto-evolution at 120/400 XP updates the persisted form; branching/manual native forms remain future work. Cosmetic packs cannot change this state.
- The instance list can represent multiple specimens of one species and preserve a lost record, but no public gameplay currently creates native duplicates or marks creatures permanently lost. There is no gameplay health, assignment or trait simulation yet, and no fabricated controls for it.
- Unsupported or invalid roster versions fail closed without overwriting data. Existing legacy reward and bonding paths remain usable if a future roster cannot be read.

## Player flow

Use the NEXTGEN **Collection** tab. Sign in to a co-op account, bond at a habitat, earn verified XP in combat, then return to the main menu to view the collection. The journal shows the permanent instance ID, form, level, XP, selected creature and next-evolution threshold. Refresh or reload to see saved state. Solo practice still uses its local training companion and cannot grant authoritative cloud XP.

## Accepted game direction (future checkpoints)

Shared survivor headquarters, solo or up to four players, 10–20 minute expeditions and hardcore stakes. Unbanked loot and captures may be lost; creatures left safely at base remain protected, while deployed creatures can be permanently lost with a clearly telegraphed recovery opportunity. This loss model is not enabled in this checkpoint.

- Creatures fight alongside survivors: active attack/defend/retreat commands, autonomous support, elemental roles and combinations. Keep online AI, damage, XP, health and death authoritative.
- The shared base has individual creature ownership, training, storage, in-game creature/general markets, upgrades, crafting, a hatchery, creature job assignments and defenses. Earn currency through verified successful expeditions; no real-money purchases. Rare wild captures remain valuable.
- Add timed threat escalation, extraction defense, run-scoped risk and banked rewards before enabling hardcore progression loss. Current legacy immediate rewards cannot be removed or retroactively lost.
- Future 2.5D sprite sheets are cosmetic/model-format work; preserve existing 3D art and third-person controls. Only original or appropriately licensed content may enter local packs.

## Verification and next task

Run `npm test`, `node --test tests/nextgen/m04-evolution-engine.test.mjs`, `npm run typecheck`, `npm run build`, and with the built local Worker serving on port 8787, `node tests/browser/nextgen-room-field.cjs`. The new account tests verify migration, account isolation, rejection of public grants, persistence, idempotent rewards, monotonic evolution and legacy save preservation. The room browser test exercises real bonding and the journal after reload.

Next: M04-C2 — implement a trusted native encounter/capture transaction (one original family), a real per-instance deployment selection and explicit evolution using the M04-B rule engine, with solo/coop parity design and no client-asserted rewards. Then companion health and authoritative commands/AI, followed by the hardcore extraction and base economy checkpoints. Do not open a PR or deploy until operator verification.
