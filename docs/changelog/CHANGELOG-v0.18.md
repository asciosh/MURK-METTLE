# v0.18 — Server-owned Lanternkin collection (co-op)

- Co-op rooms load Lanternkin ownership from the signed-in Cloudflare account.
- Bonding is a room-server event validated against the creature spawn position (4.2, -3.8), not a browser-side claim.
- The account Durable Object stores collection ownership and companion XP independently from local progression.
- Co-op Pulse is denied unless Lanternkin is owned by the authenticated player.
- Pulse finishing blows award up to 40 trusted companion XP exactly once per encounter; co-op HUD displays trusted XP.
- Solo creature state is retained as a separate prototype and **not yet authoritative**.
- No Durable Object migration or data reset required. Account record adds a new storage key on first bond.

## Tests
`npm test && npm run build`; two signed-in accounts should independently bond, use pulse, disconnect and rejoin, and retain their own companion state.
