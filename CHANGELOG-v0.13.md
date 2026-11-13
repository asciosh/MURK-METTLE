# Murk & Mettle v0.13 — Private-beta player accounts

## Included
- Username (3–20 lowercase letters, digits, underscore) and 6–8 digit PIN.
- SQLite-backed `PlayerAccount` Durable Object with v3 migration, one account per canonical username.
- Salted PBKDF2-SHA256 PIN hashes (210,000 iterations); never stores plaintext PINs.
- Five failed attempts trigger a 15-minute persistent account lockout.
- 7-day random session tokens stored as SHA-256 hashes server-side; HttpOnly, Secure, SameSite=Strict cookie.
- Login, register, logout, account progress upload/restore, optional auto-save every minute while visible.
- Existing v0.12 high-entropy recovery-key backup untouched for migration.
- v0.12 `Game.ts` TypeScript unused parameter error fixed.

## Deployment
`npm ci && npm run build && npx wrangler deploy`.
Do not delete or rename existing v1/v2 migrations. Wrangler creates new SQLite-backed `PlayerAccount` objects on first use.

## Test
1. Build and deploy successfully. On deployed URL, open ACCOUNT.
2. Register a **test** username with a unique 6–8 digit PIN. Confirm `@username` in the top bar.
3. Earn XP locally, then use UPLOAD LOCAL SAVE. Refresh and confirm session remains.
4. In a second browser, sign in with same credentials; press RESTORE ACCOUNT SAVE. Confirm XP matches.
5. Log out; confirm account-only actions disappear. Previously stored browser data remains.
6. Try a wrong PIN on a throwaway account; repeated failures should lock that username temporarily.
7. Migration from v0.12: LEGACY RESTORE a recovery key **before** UPLOAD LOCAL SAVE; take care not to overwrite richer saved data.

## Security / product limitations
- **Private friends-only beta, not safe for public competitive use.** Short PINs are vulnerable compared with passkeys/passwords. Username guessing, account lockout harassment, and stolen-device access remain risks. No email recovery or PIN reset exists yet. Do not reuse financial/phone PINs.
- Browser progression is still client-authored. Saves are backed up, **not trusted/validated**. No rankings, trading or economy based on this data.
- A lost PIN cannot be recovered through this beta. Keep the old recovery key as a separate backup until account restore is verified.
- Save conflicts use last-write-wins; avoid simultaneous play on separate browsers. A future version needs revisions/optimistic locking.
- Account API works on deployed Cloudflare Worker (`/api/account/*`); local Vite dev proxy does not run this endpoint.
- No billing guarantee: verify Cloudflare Durable Object usage against your plan's limits.
