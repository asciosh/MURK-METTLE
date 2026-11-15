# Developer setup

Install Node.js 22.12+; `npm ci` uses the committed root lock. Linux/macOS can build/test the source, while supported players use Windows 10/11 keyboard/mouse browsers or the Tauri host. Android, touch controls and phone layouts are retired.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

`dev` builds, watches Vite output and runs the full local Wrangler Worker on port 8787 (override with `ROOM_PORT`). Accounts, saves and WebSockets all use the same origin. `npm run dev:cloudflare` builds once and runs Wrangler; `npm run server` aliases that complete path. Local Wrangler storage is independent of production; do not point test tools at the live deployment.

For source hot reload, run local Wrangler and `npm run dev:client` in separate terminals. Vite binds port 5173 and proxies `/api/account` and `/room` to Wrangler 8787. `npm run preview` serves static output only; it is not a complete account/room backend.

Browser fixtures use the declared Playwright dev dependency. Install its Chromium once with `npx playwright install chromium` (on Linux, use Playwright's documented OS dependency setup if needed). Fixtures prefer `CHROMIUM_PATH`, then an installed `/usr/bin/chromium`, otherwise the Playwright browser. Run `npm run test:browser` with Vite on 5173. Production smoke checks use `npm run test:browser:production` with the built local Worker on 8787; `GAME_URL` can override the production-fixture target. Screenshots/results default to OS temporary directories, outside Git. Optional graphics benchmarks: see [performance report](../PERFORMANCE.md).

Desktop has separate dependencies: from `desktop/`, run `npm ci`, `npm run launcher:build` or `npm run launcher:dev`. `npm run test:browser:launcher` from the root uses localhost:1420. Native Windows requirements and commands are in the [Windows guide](../WINDOWS-DESKTOP.md). Root Cloudflare builds never package the desktop launcher.

If the environment cannot write npm's default home cache, use `npm ci --cache <writable-directory>`; do not change HOME or commit a machine-specific cache path. Never commit `node_modules/`, either `dist/`, `.wrangler/`, Cargo targets, account fixtures, installers or credentials.
