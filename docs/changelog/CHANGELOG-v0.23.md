# v0.23 — Infected groups and survival

- Encounters now contain 3–6 infected instead of a single enemy. Group size is chosen when a wave starts, using living party size and wave number, capped at six. Clearing a group gives an eight-second break before the next wave.
- Infected investigate gunfire, notice nearby survivors and loud sprinting, and use bounded grid routes around buildings. Stranded groups can relocate after the party has moved far away.
- Melee attacks show a warning ring during a 450ms wind-up. Moving out of range avoids the strike. A short damage grace prevents a crowd from landing simultaneous stacked hits.
- Sprinting uses stamina. A full bar lasts about 4.35 seconds. Regeneration starts after 1.1 seconds; exhaustion requires recovery to 25 before sprinting resumes.
- Press **H** or click the bandage button to use one of two bandages. Stay still for 2.6 seconds to restore up to 40 health. Movement, damage and attacks interrupt treatment. The bandage is spent when treatment starts, including interrupted attempts.
- Existing supply caches replenish ammunition and bandages together, with the existing 45-second cooldown per player/cache.
- Solo and co-op share combat targeting, survival and navigation rules. Firearms hit the first living infected along a clear shot; pulses can hit several visible enemies. Co-op health, movement budgets, inventory and kill rewards are server validated.
- Healing to full health no longer resets the survivor's position. Co-op respawning waits for server confirmation and is allowed only after defeat.

## Compatibility and scope

Account XP, creature ownership, materials and save revisions retain their existing formats. Cloudflare bindings, migration tags and preview setup are unchanged. Health, stamina, ammunition, bandages and encounters are session state, not persistent account inventory. Reload both browser tabs after updating the client/server protocol.

Navigation remains a bounded prototype rather than a full navigation mesh. Group size and route work are capped, but production Cloudflare CPU usage and real-device multiplayer performance still need measurement. Existing reward-save failures still require operator intervention; this release does not add an automatic reward retry queue.
