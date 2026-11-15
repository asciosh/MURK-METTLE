# Validation and playtest checklist

## Commands

```sh
npm ci
npm test
npm run typecheck
npm run build
npx wrangler deploy --dry-run
```

With Vite source server on 5173, `npm run test:browser` runs menu/input/journal, characters, combat/audio, world, mods and performance/resource-lifecycle fixtures. With the built local Worker running (8787 by default), `npm run test:browser:production` checks deferred production chunks, compiled mod validation/preview, and four authenticated local WebSocket sessions. Override `GAME_URL` for a different local Worker port. The account-creating `worker.cjs` smoke refuses non-loopback targets. It creates independent disposable local accounts; it never writes production data. It tests transport/bootstrap, not four-player rendered gameplay or an entire expedition.

From `desktop/`, run `npm ci` and `npm run launcher:build`; run `npm run test:browser:launcher` from the root with the launcher Vite server on 1420. Portable Rust policy tests: `cargo test --locked --lib` and `cargo fmt --all --check` from `desktop/src-tauri`. These do not compile the Windows host on Linux. Use the [Windows workflow/build instructions](../WINDOWS-DESKTOP.md) for native compilation and installer acceptance.

## Cleanup baseline and results

Baseline `bee7752`: clean branch, 63 Node tests passed, typecheck/build passed. The first npm-ci attempt failed on an unwritable home cache; rerunning with a writable workspace cache passed. This environment uses Linux, Node 24.22.1, Chromium with software WebGL, Playwright 1.62.1 and portable Rust 1.100.0. Emulation is not physical Windows hardware.

Final cleanup checks:

| Check | Result |
| --- | --- |
| Root `npm ci` with workspace cache | Passed, 68 packages installed |
| `npm test` | 67 passed, 0 failed/skipped (baseline 63; two retired mobile cases removed, six repository checks added) |
| `npm run typecheck`, `npm run build` | Passed; Three core >500 kB warning remains |
| `npm run test:browser` | Passed all six suites: interface, characters, combat, world, mods, performance-safety; no reported page errors |
| `GAME_URL=http://localhost:8791 npm run test:browser:production` | Passed production lazy loading, compiled mod worker/demo/preview and actual local four-session transport checks |
| `npm run test:browser:launcher` | Passed browser-only launcher keyboard/layout/retry/offline-banner checks |
| Desktop `npm ci`, `npm run launcher:build` | Passed, separate launcher output |
| Portable `cargo test --locked --lib` | Four policy tests passed |
| `cargo fmt --all --check` | Passed |
| `wrangler deploy --dry-run --outdir /tmp/murk-cleanup-worker` | Passed; all three canonical Durable Object bindings, 16 static files; no deployment |
| Dev command smoke / syntax / Git diff | Revised `npm run dev` served HTTP 200 on local port 8790; JS syntax and `git diff --check` passed |
| Native Windows installer/build, physical GPUs and human co-op session | Pending Windows CI/manual acceptance; not performed on this Linux host |

Desktop visual inspection included 1920×1080, 1366×768, 960×540 and browser DPR 1/1.5/2 screenshots. Inspected journal/menu/HUD, character gallery, creature habitats/world and original mod preview. UI fixtures use controlled state and a blank game canvas; separate character/world/mod fixtures render actual WebGL. This is not proof of a live expedition. The same source geometry/asset data, flat ground and official coordinates remain. End-of-game renderer counters returned to 0 geometries / 0 textures in the lifecycle fixture; these are resource counters, not GPU memory bytes.

| Production output | Baseline → cleanup (kB, Vite decimal output) |
| --- | --- |
| CSS | 57.69 → 42.46 (gzip 13.37 → 10.45) |
| Game JS chunk | 255.40 → 246.57 (gzip 79.93 → 77.67) |
| Three core | 624.12 → 624.12 |

These are bundle sizes, not FPS or timing measurements. No new performance gain is inferred.

The initial combat fixture failure expected the removed Mobile particle budget; it was changed to cover Balanced 40 / Performance 0 / Cinematic 64. An expanded keyboard test initially pressed Space while Close Journal was focused (correctly activating Close); it now tests gameplay suppression with the sheet focused. The local transport fixture initially synthesized its top-level document, which Chromium's local-network checks blocked from opening loopback WebSockets; it now fetches the real local document. No browser, account or desktop security check was disabled.

## Manual release acceptance — Windows PC only

- On Windows 10/11 Chrome/Edge and the Tauri host, register/login with staging accounts, save/reload, logout and exercise stale-revision handling. Verify existing saved collections/evolution/XP, equipment and inventory remain intact.
- Check 1920×1080, 1366×768 and a 960×540 desktop window, with 100/150/200% Windows display scaling and reduced motion. Resize/fullscreen, Alt+Tab, unlock/relock the mouse and scroll every menu. Verify J journal, I backpack, focus trapping and no held movement after overlays/blur.
- Walk/sprint, aim/fire/reload/switch weapons, melee, pulse, heal/interrupt healing, die/restart, collect/craft and extract. Compare Performance/Balanced/Cinematic, optional photos/fallback, lighting, shadows and camera obstruction. Confirm there is no touch UI or Mobile selector, including on touchscreen PCs.
- Test official survivor GLB clips/fallback and all five creature species at three evolution stages. Import/enable/disable/remove the CC0 mod with the actual Windows/WebView2 file chooser; verify persistence, original fallback and clean preview closure. Another PC without the pack must still see the official creature.
- Use four separate Windows PCs/accounts, including browser and Tauri players, for a full combat/extraction session. Test disconnect/rejoin, delayed network, rewards and account saves. Automated four-socket bootstrap is not this playtest.
- Run the actual NSIS installer on clean Windows 10/11 with WebView2, test fullscreen/quit confirmation/help/network recovery, account-cookie persistence and uninstall. No new installer or native acceptance is claimed from Linux checks alone.
- Verify preview/deployed static caching, GLB/demo URLs and online photo delivery. Measure sustained rendering on actual Windows GPUs before making FPS claims; no new benchmark speedup is claimed here.
