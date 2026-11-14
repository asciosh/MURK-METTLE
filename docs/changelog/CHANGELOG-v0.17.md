# v0.17 — Trusted progression HUD

- The main survivor level and XP HUD now displays Cloudflare-verified co-op rewards while connected to a room.
- Trusted co-op kills are shown in the main kill counter, and trusted creature XP is reflected in the companion XP bar.
- The co-op crafting panel shares the same verified state; rewards update immediately and refresh from the server.
- Solo progress is deliberately labelled SOLO and remains client-calculated. This release does **not** claim that solo XP is server-authoritative; server-hosted solo combat is a separate future migration.
- No database migration or account reset.

### Test
`npm test && npm run build`; sign in, join a co-op room with a second account, earn a kill, verify the main HUD and account progression agree, then reload.
