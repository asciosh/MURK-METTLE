# M03 — NEXTGEN unified entry and gameplay audit

Based on the operator's `MURK-METTLE-M03-LATEST.zip` (2026-11-18), not the old v0.27 tree. This checkpoint unifies the **interface and navigation**, not the two simulation authorities. It does **not** claim solo and co-op are functionally identical.

## Shared, verified in source

- Both modes instantiate `SimpleDemo` and share the seeded NEXTGEN terrain generator, vegetation renderer, lighting, character/creature art and `PlayableHud` visual system.
- Both modes now use a single NEXTGEN main menu, in-game pause/settings/controls panel, and the same persistent device-local graphics preference.
- Same core camera/aim, stamina, weapons, melee, bandaging, resonance, loot art and companion visual language, with mode-specific state adapters.
- Both can return to `/?nextgen=lobby`. The old v0.27 entry and Cloudflare Durable Objects remain intact.

## Differences that remain deliberate or unfinished

| Feature | Solo local session | Co-op authoritative room | Action |
| --- | --- | --- | --- |
| Movement | WASD, Shift, jump, dodge | WASD, Shift, server-validated jump/dodge | Basic actions now validated by server; feel, cooldown and enemy-hit behavior need live testing |
| Firearms | Pistol then physically collect a primary (rifle/shotgun) | Pistol/rifle/shotgun selected on server; no physical gun loot | Align equipment progression after deciding server inventory contract |
| Companion | Lanternkin follow/assist, C to engage | Server-owned five-species roster, C to cycle and G to strike | Align companion behavior during M04; preserve ownership checks |
| Loot | Local weapon/ammunition/bandage drops | Server-issued samples, resupply and cloud salvage | Keep server authority; inventory taxonomy needs explicit design |
| Downed / revive | Solo death/restart | 25-second downed state and teammate revival | Co-op-only action |
| Extraction / XP | Endless local wave practice; no cloud XP | Team extraction with verified account XP | Mission parity is a separate M06 milestone |
| HUD | Shared `PlayableHud` layout | Shared `PlayableHud` plus squad/mission state | Same visual system; online extras are intentional |
| Saving | Local practice (not a cloud save) | Cloud account stats/creatures/materials | Never invent solo account XP without server confirmation |

## Entry and menu smoke

The common menu is at `http://localhost:8787/?nextgen=lobby` (or your configured dev origin). Use Solo to load `?nextgen=playable`; Co-op requires an account and a 3–12-character room code, then loads `?nextgenRoom=<CODE>`.

Settings: low, balanced, cinematic; saved to browser device storage, no account schema changes. The in-game menu opens with **Esc** while playing or the **MENU** button. **Resume** requests pointer lock; leaving co-op disconnects the room only when navigating away. Co-op never pauses the server simulation.

## Verification and remaining acceptance

Automated: `npm test`, `node --test tests/nextgen/*.test.mjs`, `npm run typecheck`, `npm run build`, `node tests/browser/nextgen-entry.cjs`, `node tests/browser/nextgen-unified-menu.cjs`, and the existing multiplayer browser tests.

Manual: test full settings and keyboard flow on Windows at home, play both modes, check revive and full extraction across two authenticated accounts, inspect animations/weapon visuals, and verify disconnection/rejoining. The independent local and server gameplay controllers still have different equipment, creature, loot and mission progression; full 1:1 parity remains a larger follow-up task.

No deploy, merge or account migration. M04 is untouched.
