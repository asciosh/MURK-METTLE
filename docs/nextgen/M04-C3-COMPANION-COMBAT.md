# M04-C3 — Native companion tactical combat

This checkpoint builds on verified C2. Captured Lanternkin specimens—not legacy one-per-species bonds—have a server-authoritative combat body. Native ownership and lifetime XP are still account-persistent; HP, movement and tactics are deployment-local. The roster schema and Cloudflare bindings are unchanged.

## Controls and balance

| Mode | Behavior |
| --- | --- |
| Follow (default) | Creature recalls and follows; no autonomous attacks or infected targeting. |
| Defend | Targets visible infected within 5m of owner and can receive infected hits. |
| Aggressive | Pursues visible infected within 9m of owner; can draw infected aggro. |

Press **C** to cycle modes. **G** commands a strike within 3.5m of the actual creature position; autonomous attacks reach 1.9m. Both share a 1.5s attack cooldown. **X** retains the original owner-centered Pulse, but a native creature must have positive HP. All inputs are intents; no browser-controlled damage, HP or target.

| Form | Max HP | Strike damage |
| --- | ---: | ---: |
| Lanternkin | 80 | 12 |
| Luminbloom | 120 | 18 |
| Grovewarden | 160 | 24 |

An engaged creature can be targeted by the existing infected windup and damage system. It does not count as another player when scaling the horde. At zero HP it is incapacitated, returns to Follow, and cannot strike/Pulse. Use a supply cache (E, existing range and 45s restock) to restore it to full HP and Follow. Respawning the survivor does not automatically recover the creature; changing/rejoining a deployment currently resets its temporary combat HP. This is intentionally not yet a secure hardcore/permadeath or extraction-banked system.

Server-confirmed autonomous kills award the same 12 individual XP and existing survivor rewards as other normal native kills. Explicit evolution increases combat stats on the next deployment; lifetime XP alone does not evolve a specimen. Peer snapshots replicate position, HP and tactics. The original model or locally installed cosmetic is still appearance-only.

## Test

Run `npm test`, `npm run typecheck`, `npm run build`. Restart `npm run dev:cloudflare` and in a second PowerShell terminal:

```powershell
$env:GAME_URL = 'http://127.0.0.1:8787'
$env:NEXTGEN_COMPANION_TEST = '1'
node tests/browser/nextgen-room-field.cjs
Remove-Item Env:NEXTGEN_COMPANION_TEST
Remove-Item Env:GAME_URL
```

Expected: C1, C2 and C3 messages. C3 exercises real native capture, the initial HP HUD, a server-accepted autonomous strike and authoritative companion state replicated to both clients. Unit and room tests cover exact stage stats, targeting, cooldown, kill credit, horde attacks, incapacitation, refusal of invalid commands, supply recovery and no extra horde scaling.

Manual acceptance: capture and approach infected, cycle C through all modes, watch creature move and fight, recall it when low on HP, then resupply. Try the same in a room with a friend. Solo practice and legacy bonds retain their present rules. Permanent loss, global deployment lock, capture devices and shared headquarters are future checkpoints.
