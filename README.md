# MURK & METTLE

A cooperative third-person survival RPG for **Windows PC**, built with Three.js, TypeScript and Cloudflare Durable Objects. Play with mouse and keyboard in a current Windows Chrome/Edge browser or the [Tauri 2 Windows edition](desktop/README.md). Up to four players share a room.

Explore the Wildlands, collect five original creature species with fifteen evolution forms, survive infected groups and complete expeditions. Local cosmetic mods change appearance only.

**Android/mobile support has been removed.** There are no touch controls, phone HUD or Mobile graphics option. Performance, Balanced and Cinematic remain available. Existing local Mobile preferences map to Performance; cloud accounts and progression are unchanged. Desktop layout checks cover 1920×1080, 1366×768 and a 960×540 window. Smaller windows and non-Windows player platforms are unsupported.

## Develop and play locally

Node.js **22.12+** is required. From the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev:cloudflare
```

Open the local Wrangler address (normally `http://localhost:8787`). Local accounts and rooms are separate from production. `npm run dev` builds, watches and runs the complete Worker; `npm run server` is an alias for the complete local Worker. The obsolete unauthenticated Node server has been removed.

See [developer setup](docs/development/SETUP.md), [testing and manual checks](docs/development/TESTING.md) and [Cloudflare deployment](docs/development/CLOUDFLARE.md). Production deployment is a separate operator action.

## Project map

- `src/main.ts`: authenticated boot and menu wiring; the game loads lazily.
- `src/client/game/`: client orchestration, actors, world, camera, input, combat presentation and networking.
- `src/client/rendering/`: field lighting, graphics presets and optional render-target lifecycle.
- `src/client/ui/`: HUD arrangement, journal and keyboard/focus behavior.
- `src/client/mods/`: isolated local cosmetic validation, storage, loading and manager UI.
- `src/client/debug/`: development-only performance telemetry.
- `src/styles/`: ordered stylesheets and reusable botanical tokens.
- `server/cloudflare/`: production/local Worker, accounts and Durable Objects.
- `shared/`: cross-runtime game contracts and pure presentation helpers.
- `desktop/`: independent Windows launcher, Rust host, security policy and NSIS packaging.
- `public/`, `examples/`, `scripts/`: runtime assets, original mod sources and reproducible tooling.
- `tests/`: automated security/game-rule/structure tests and real browser fixtures.
- `docs/`: [current guide index](docs/README.md), historical records and changelogs.

[Architecture](docs/ARCHITECTURE.md) explains the boundaries. [Cleanup audit](docs/audit/CLEANUP.md) records evidence for removals and retained compatibility code.

## Creatures, assets and mods

Use **Field Menu → Creature Mods** to import, preview, enable or remove original/properly licensed cosmetic packages. See the [format, limits and licensing guide](docs/modding/README.md). The original CC0 Copperbloom example includes model, animations, icon, provenance and reproducible source. [Official model provenance](public/models/README.md) and optional [photo-material attribution](docs/archive/V0.25-ASSETS.md) are preserved.

## Windows desktop

See [Windows build, security and installation notes](docs/WINDOWS-DESKTOP.md). The host loads the trusted HTTPS game and existing Cloudflare services without granting native permissions to remote content. It requires internet access. Tauri packaging does not inherently increase FPS. The Windows workflow produces unsigned test installers; see its actual job result before claiming an installer exists.

## Existing limitations

- Solo progress is still computed by the client, then saved with account revision checks; co-op combat/rewards use server validation.
- Username/PIN login is private-beta quality. Stronger authentication and abuse protection need separate work before a public release.
- A cloud-save conflict pauses saving instead of overwriting another session. Use **Account → SAVE NOW** before closing.
- Failed multi-account rewards require operator reconciliation; this cleanup does not introduce a new persistence policy.
- Sustained hardware performance, native Windows acceptance and full four-player playtests remain release checks.

Historical version notes live in [docs/archive](docs/archive/README.md); all changelogs remain in [docs/changelog](docs/changelog).
