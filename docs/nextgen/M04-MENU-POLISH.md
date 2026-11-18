# M04 — Creature Studio menu polish

This UI-only follow-up separates the local cosmetic ZIP tools from the evolution-rule sandbox.
The main menu shows PLAY SOLO only on its Play tab, not over the Co-op/Settings/Controls/Creature Mods tabs.
The Creature Mods tab now contains **Evolution Lab** and **Appearance Packs** sections; opening one hides the other. The Evolution Lab remains strictly local/read-only.
Co-op gameplay and authoritative creature ownership/XP/progression are unchanged.
The in-game menu keeps Resume, Quality and Main Menu; advanced control instructions are collapsible.

## Local acceptance

1. `npm run typecheck` and `npm run build`
2. `node tests/browser/nextgen-menu-polish.cjs`
3. `node tests/browser/nextgen-evolution-lab.cjs`
4. `node tests/browser/nextgen-creature-mods.cjs`
5. `node tests/browser/nextgen-unified-menu.cjs`

Ensure the original Copperbloom cosmetic pack remains unchanged after switching sections, and no saves or account data change.
No PR, deploy or branch merge is performed by this installer.
