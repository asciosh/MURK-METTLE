# M04-C2 — Native capture and individual progression

This checkpoint uses the original Lanternkin family to exercise the production co-op account and room contracts. It does not import any franchise assets or change Cloudflare bindings/migration tags. Existing original bonds, cosmetic packs, account saves and offline solo practice remain compatible.

## Loop

1. Sign in and open a NEXTGEN room (one player or up to four). Walk to **WILD LANTERNKIN · CAPTURE** near room coordinates (8, -8); press E. This is a simple field encounter marker, not yet a capture minigame or roaming wild AI.
2. The server validates the negotiated room, alive state, expedition phase and distance. The account transaction enforces one capture per account and room mission sequence. The wild marker disappears for that account; another teammate retains their own capture opportunity. Capture is saved immediately and deploys the new specimen; extraction banking is future work.
3. Use G for companion strike / X for Pulse and normal combat. Server-confirmed kills award this deployed specimen 12 XP (normal kill) or 40 XP (Pulse). Legacy bonded species have their existing independent progression.
4. Return to the main menu → Collection. Choose a specimen using **SELECT COMPANION**. Native specimens display **EVOLVE** only when an evolution exists; it becomes enabled at the required lifetime XP. Lanternkin → Luminbloom (120 XP) → Grovewarden (400 XP). XP alone never transforms a native specimen. The selected/evolved creature is loaded on the next room join.

Multiple captures in different room expeditions create separate IDs; a repeated packet or rejoin cannot duplicate one encounter. Cosmetic imports do not grant capture, XP or evolutions. The first prototype has no device costs, capture challenge, creature HP, permadeath, single-deployment lock across rooms or extraction requirement. Offline solo practice cannot modify authenticated cloud progression; a private one-person room supports it.

## Verification

Run `npm test`, `npm run typecheck`, `npm run build` and `node --test tests/nextgen/room-field.test.mjs tests/nextgen/m04-evolution-engine.test.mjs`. Start `npm run dev:cloudflare`, then in another PowerShell terminal:

```powershell
$env:GAME_URL = 'http://127.0.0.1:8787'
$env:NEXTGEN_CAPTURE_TEST = '1'
node tests/browser/nextgen-room-field.cjs
Remove-Item Env:NEXTGEN_CAPTURE_TEST
Remove-Item Env:GAME_URL
```

The browser check exercises the real account and room, living range-checked capture, distinct IDs, replicated deployment, disappearance of the marker, account isolation, selection UI and disabled early evolution. Account tests exercise valid/invalid explicit evolution and replay protection. Manual acceptance: use E near the marker, train the native specimen, evolve it from the journal and enter a new room to check the form and verified XP. Test an account owning a legacy creature and one without it.

Next: companion health, independent targeting/attack and recovery, then capture devices and extraction banking/hardcore loss, shared headquarters stations and market.
