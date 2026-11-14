# v0.19 — Co-op Expeditions

- Room-owned shared objective: 3 zombie kills, 2 fixed field samples, extraction beacon.
- Validate sample pickup distance, extraction location and objective completion on Cloudflare.
- Party members who are connected and alive at extraction each receive +150 account-owned XP once.
- Durable Object keeps current shared mission progress in storage.
- Remote player snapshots include creature ownership; client displays companion markers.
- Solo missions and cloud account data formats remain unchanged.

## Limits
- A disconnected player is not included in the party completion reward.
- Mission progress persists for a room code across sessions; room reuse continues the existing expedition.
- If an account write fails, that participant's mission reward isn't retried automatically. Server logs report it.
- Not yet live-tested with four browser sessions.
