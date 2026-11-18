# M04-B — Evolution engine foundation

## Status

Rule engine + browser-only Evolution Lab are implemented in a separate M04 task branch.
**Not** a completed collection migration or co-op evolution feature. No franchise assets or character data are included.

### Rules available now

- Bounded, declarative creature families, multiple named forms and branching evolution graphs.
- Explicit conjunctive conditions: lifetime XP, derived level, friendship, item, trusted trade, day/night.
- Deterministic and side-effect-free readiness checks / transaction plans, with required-item costs.
- Cycle/duplicate/invalid-reference rejection and caps on the number of families, forms and rules.
- Existing five original species represented using their **unchanged** 120/400 XP evolution thresholds.
- New original **Glimmerpaw** data-only demo with branching evolutions; it is not a spawnable or cloud-owned creature.
- Browser **Creature Mods → Evolution Lab** explores conditions without touching inventory, saves, packets or server logic.

### Data boundary

The existing Cloudflare collection's five original IDs, ownership, XP and stage calculations remain unchanged. `legacyEvolutionPreview` is read-only, and the demo does not grant creatures. Cosmetic `.mmcosmetic` ZIPs still cannot inject gameplay/evolution rules; untrusted packs remain device-local and visual-only. Actual live evolution must execute against trusted, server-registered definitions and account-owned state with atomic persistence, idempotency and validated consumption. A browser may only request an evolution; it cannot assert the outcome.

### Next checkpoint — M04-C

1. Specify a backward-compatible, **server-owned** add-on progression strategy for new species, including old-save upgrade, ownership and authoritative evolution transactions; seek approval before any persistent storage changes.
2. Add a trusted static species manifest with explicit art provenance, model/form references and companion-ability contracts.
3. Add authoritative new-species discovery/bonding, evolution and replay/reconnect tests before enabling anything in co-op.
4. Make a real journal screen for owned species and their evolution choices (separate from the lab).
5. Preserve original cosmetic fallback and do not put unlicensed Pokémon models in the repository or a shared asset pack.

### Operator verification

```powershell
npm test
node --test tests/nextgen/*.test.mjs
npm run typecheck
npm run build
npm run dev:cloudflare
# second terminal:
node tests/browser/nextgen-creature-mods.cjs
node tests/browser/nextgen-evolution-lab.cjs
node tests/browser/nextgen-room-field.cjs
```

Open `http://localhost:8787/?nextgen=lobby&tab=mods`, scroll to Evolution Lab. Glimmerpaw at XP 960 is level 5: Sunmane needs daytime, Moonpelt needs a moon_shard. Starcrest requires 80 friendship and trusted trade. Original Lanternkin follows the legacy 120/400 XP stages. These are demonstrations only.
