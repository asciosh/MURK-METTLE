# v0.14 — Cloud-only account and UI cleanup

- Removed recovery-key backup buttons, UI, and legacy CloudSave client.
- No guest game session: game starts after account session and Cloudflare save hydration.
- Progression, inventory, crafting, expeditions, and bond retreat are now held in memory between cloud synchronizations, never persisted to browser localStorage.
- Account-only saving every 12s while visible with revision conflict handling; manual SAVE NOW.
- Session validation on Cloudflare room WebSocket upgrades.
- Removed client-supplied `sharpened` bonus from authoritative room damage (until server-held equipment exists).
- Disabled legacy profile route, retained historical Durable Object migration entries for deployment safety.

Known limitations: A PIN account is weak authentication; progression upload values remain client-originated; co-op loot and XP are not authoritative. Tab close can lose up to 12 seconds of changes. Existing cloud-save shape remains for internal API compatibility; old browser saves are intentionally ignored.
