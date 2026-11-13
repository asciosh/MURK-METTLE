# Murk & Mettle — Prototype v0.4

Browser-based third-person action-survival RPG prototype using TypeScript, Three.js and Vite.

## Run

Requires a compatible Node.js version for Vite 8 (Node 22.12+ recommended).

```bash
npm install
npm run build
npm run dev
```

## Controls

- WASD: move; Shift: sprint; mouse: look
- Space / left mouse: melee attack
- E: bond with Lanternkin (near the glowing creature)
- Q: Lantern Pulse (once bonded; 8-second cooldown)
- R: restart after defeat

## v0.4 RPG progression

- +25 survivor XP for first Lanternkin bond.
- +50 survivor XP per infected defeat (melee or pulse); counted once per kill.
- +10 Lanternkin XP when its pulse hits an enemy; +40 when its pulse defeats an enemy.
- Both level from XP using total XP required for level L = `100 * (L-1)^2`, capped at level 50.
- Survivor XP, Lanternkin XP, total kills, and bonded creature status persist in localStorage under `murk-mettle-v04-progression`.
- Legacy v0.3 Lanternkin bond is imported from `murk-mettle-v03-creatures` on first load.
- Encounter restart does not wipe progression; refreshing preserves it on the same browser profile.
- Progression is local-only and not suitable for server-authoritative multiplayer yet.

## QA checklist

1. `npm run build` finishes without errors.
2. Existing movement, zombie attacks, E bonding, Q pulse and melee all work.
3. Bond awards 25 survivor XP only once.
4. Zombie defeat awards 50 survivor XP once, whether killed with melee or pulse.
5. Lanternkin earns 10 XP for a successful nonlethal pulse hit or 40 XP for a pulse kill.
6. Survivor and companion level/XP bars update; reload preserves both.
7. Level 2 begins at 100 total XP; level 3 at 400 total XP.
8. Restarting after player death does not erase progress.
9. A v0.3 save containing a bonded Lanternkin still recognizes the bond in v0.4.
