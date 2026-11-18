# M03 final co-op acceptance — operator checklist

Branch: `cline/m03-survival-combat`. Local-only Wrangler, never production. Do not start M04 until the operator approves M03.

## Automated checks

Run these after applying the M03 squad/mission polish script:

```powershell
npm test
node --test tests/nextgen/*.test.mjs
npm run typecheck
npm run build
npm run dev:cloudflare
```

In **another terminal**:

```powershell
node tests/browser/nextgen-entry.cjs
node tests/browser/nextgen-room.cjs
node tests/browser/nextgen-room-field.cjs
node tests/browser/nextgen-room-final.cjs
node tests/browser/nextgen-room-polish.cjs
```

The polish browser test verifies two clients, room-owned squad health UI, visible teammate labels, leaving, and account rejoining. It does **not** claim mission extraction or successful revival.

## Manual acceptance — two separate authenticated browser profiles

- [ ] **World**: solo (`?nextgen=playable`) vs room (`?nextgenRoom=BLOOM`) share the same terrain height, forest, models and lighting; differences in enemies/items/progression are expected.
- [ ] **HUD**: squad panel shows all joined members; world label tracks the other player; no incorrect account usernames are shown (temporary aliases are intentional; the room snapshot does not include names).
- [ ] **Loot**: physically distinct supply caches, sample drops, and creature habitats have in-world labels; walk near one, press **E** and confirm the item/mission state changes only after room acceptance.
- [ ] **Revive**: join with two accounts. Let one player be downed by infected. Other player stands within 2.7m, has a bandage, presses **V** and does not move for 3 seconds. Confirm both screens show progress, teammate returns with 35 HP, and one bandage was consumed.
- [ ] **Revive interruption**: repeat with movement/damage. Confirm cancellation and no delayed heal. Verify the 25-second downed deadline expires and unrevivable allies are marked OUT.
- [ ] **Combat**: aim/fire, rifle, shotgun, reload, melee, resonance and companion Pulse/strike; verify server ammunition and hit effects match.
- [ ] **Objectives & extraction**: secure at least three infected kills and two samples, reach the green extraction ring, press **E**, verify server confirmation and persistent XP after logout/login. Refresh both profiles to verify rewards were not duplicated.
- [ ] **Controls**: WASD, Shift sprint, pointer lock release/reacquire, interaction, inventory and blur/input reset. **Jump and dodge are not yet wired into authoritative room movement.** Do not pretend they are equivalent to the solo controller; decide whether to extend the room contract before signing off parity.
- [ ] **Lifecycle**: one account leaves and rejoins room; other player's roster recovers. Disconnect network temporarily, use the room reconnect button, and verify no phantom players/duplicate session.
- [ ] **Four-player**: repeat join/leave/combat on four browser profiles; inspect performance and input responsiveness.

## Exit criteria

Record the outcomes and screenshots, especially a successful live revive and full extraction. If any check fails, repair it on the same task branch. Only then `git add`, commit and push; no PR/merge/deploy without approval.

This checkpoint is client-side presentation and testing. It does not modify Durable Object bindings, account schemas, legacy clients, or the server's authoritative combat/revive/reward logic.
