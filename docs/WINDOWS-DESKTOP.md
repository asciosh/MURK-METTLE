# Windows desktop edition · Tauri 2 proof of concept

The browser/Android game remains the primary frontend. `desktop/` is a separate Windows host with its own npm and Cargo locks. It does not replace Vite, Three.js, the Cloudflare Worker or any Durable Object. The desktop shell version is `0.1.0`; game content continues to follow the deployed browser release.

## Architecture and authentication decision

The bundled local launcher opens **https://murk-mettle.asciosh.workers.dev/** in a separate WebView2 game window. `desktop/deployment.json` is the single compiled deployment origin. It contains no username, PIN, session token or secret. To test a staging deployment, change that origin to your own root HTTPS staging Worker, rebuild, and review the change before distributing. Players cannot supply arbitrary origins.

| Concern | Desktop behavior |
| --- | --- |
| Account API | Existing `/api/account/*` relative URLs resolve against the hosted game origin. |
| Co-op progress | Existing `/api/account/coop-state` and `/coop-craft` stay same-origin. |
| WebSocket rooms | Existing `location.host` URL construction produces `wss://murk-mettle.asciosh.workers.dev/room?...`. |
| Assets/models | Vite assets, model manifest/GLB and optional CC0 surfaces load exactly as in the browser game. |
| Session | WebView2 owns the existing `HttpOnly; Secure; SameSite=Strict; Path=/` cookie in its application profile. The Rust host never reads it. |
| CSRF | Existing POST/PUT exact-Origin checks remain unchanged. No new CORS allowlist, cookie flag exception or native authentication proxy. |
| Account database | Same Worker and existing account Durable Objects; no migrations, cloning or account conversion. |
| Browser interoperability | Rooms use the existing protocol, including mixed Windows/browser/Android parties. |

A local `tauri://`/`http://tauri.localhost` copy of the game would make requests to the Worker cross-origin and can prevent Strict cookies from accompanying cross-site fetches/WebSockets. Relaxing SameSite, spoofing Origin, copying session tokens into configuration or bypassing WebView certificate/CORS checks would be the wrong integration. Loading the existing site as the top-level game document retains its browser authentication model. Initial cross-site navigation and subsequent same-origin requests still need real WebView2 login verification.

Cookies and storage are isolated from Edge/Chrome browser profiles. Signing in to the website in Chrome does not sign in the desktop host. Do not run the same account simultaneously on several clients: existing compare-and-swap cloud-save conflicts are preserved. The game requires internet access; the small local launcher is available offline. A hosted game update appears in the desktop edition without replacing the native host, so desktop releases are not offline or fixed-content archives.

Tauri 2 remains the first candidate. No documented blocker currently justifies Electron. Using WebView2 does **not** inherently increase Three.js FPS; GPU, driver, rendering preset, WebView2 version and scene determine performance.

## Security boundary

- Window creation uses an async command because synchronous WebView2 creation can deadlock Windows IPC handlers. The Windows installer smoke test exercises this path.
- Only the local `launcher` window receives one capability: `launch-field`, allowing the no-argument `start_game` command. The generated app command manifest makes this an ACL-controlled command. The command also checks its caller's window label.
- The remote `field` window has **no capabilities**, remote URL grants, filesystem, shell, native HTTP, dialog or opener permissions. `withGlobalTauri` is disabled. Native menu handlers use Rust-only dialog/opener APIs; the opener plugin's automatic JavaScript link interception is disabled.
- The field window accepts top-level navigation only to the exact compiled HTTPS origin. Similar-looking hosts, alternate ports and cross-origin redirects cannot replace it. New-window HTTPS links are validated in Rust and sent to the default browser; same-origin popups reuse the game window. Credential-bearing URLs, HTTP, files, data, JavaScript and custom executable schemes are denied. Normal cross-origin top-level links are blocked; external links must use a new-window action.
- The privileged launcher accepts only its bundled root/index page (or the exact loopback Vite development origin in debug builds). It cannot become a privileged remote browser. Both windows reject downloads; native file-drop handling is disabled in the game window.
- The bundled launcher has a restrictive CSP with no wildcard, inline-script or eval allowance. It makes no account/network requests. Tauri's bundled-asset CSP does not impose a new policy on the hosted game; the server remains responsible for remote content policy.
- Do not add `remote` capability grants, `core:default`, `shell:*`, `fs:*`, opener defaults, insecure WebView2 flags or certificate exceptions to fix login. Do not expose an arbitrary-URL native command.

The game is still remotely delivered web content. Compromise of the game site could compromise its web account/session interactions, as in a browser; it must not acquire native authority. Keep Tauri/WebView2 dependencies updated and re-audit the capability files when adding native functionality.

## Build on Windows 10/11 x64

Intended targets: Windows 10 22H2 and Windows 11 x64 with the Evergreen WebView2 Runtime. Native input, graphics and installer compatibility on both OS versions remain release acceptance checks. This project does not supply ARM64 or 32-bit packages.

Install:

1. Node.js 22.12+ and npm.
2. Rust via rustup; `desktop/rust-toolchain.toml` pins Rust 1.100.0 with rustfmt/clippy. Use the `x86_64-pc-windows-msvc` toolchain.
3. Visual Studio 2022 Build Tools, **Desktop development with C++**, MSVC x64/x86 tools and a Windows 10/11 SDK.
4. Microsoft Edge WebView2 Evergreen Runtime for local development. The NSIS setup is configured to download its official bootstrapper if needed; an internet connection is required. It does not bundle the Edge browser or disable hardware security features.

From PowerShell in the repository root:

```powershell
npm ci
npm test
npm run typecheck
npm run build
cd desktop
npm ci
npm run launcher:build
cd src-tauri
cargo fmt --all --check
cargo test --release --locked --lib --features custom-protocol
cd ..
npm run build -- -- --locked
```

The last command runs the pinned Tauri CLI, builds the small launcher, compiles the host and produces the configured **NSIS** package under `desktop/src-tauri/target/release/bundle/nsis/*-setup.exe`. This path is an expected output, not evidence an installer has been built. Do not upload `target/`, npm caches or `dist/` to the source PR. Original icon source/provenance is in `desktop/art/`; installer metadata and the current-user install mode are in `src-tauri/tauri.conf.json`.

For native development, run `npm run dev` from `desktop/` on Windows. This serves only the local launcher on `http://127.0.0.1:1420`; the game still uses the compiled HTTPS deployment. For regular browser development/build/deployment, continue using the existing root commands. No desktop install is required on Android or browser PCs, and Wrangler continues to deploy root `dist/` only.

MSI is optional and has not been configured or produced. If an enterprise deployment needs it, add WiX/MSI as a separately validated target rather than assuming NSIS and MSI install behavior is identical.

## Windows test-build workflow

`.github/workflows/desktop-windows.yml` runs on desktop-related PRs and supports manual dispatch once present on the default branch. It uses a Windows 2022 x64 runner with read-only repository permissions. It runs the existing game tests/typecheck/build, builds the launcher, runs Rust release policy tests, builds an unsigned NSIS installer, then executes `desktop/tests/install-smoke.ps1`.

The smoke test silently installs the **actual generated installer** into the runner's temporary directory, launches the installed host, finds its branded window and launcher button through Windows UI Automation, clicks the real scoped launcher command, requires a game window and its hosted HTTPS login page, and runs the uninstaller. It does not authenticate, verify gameplay/WebGL rendering or write production account data. It force-stops only its test process rather than attempting to automate the normal quit confirmation. Artifacts retain the real setup executable for 14 days; upload is attempted even if a later smoke test fails, so always inspect the job result before treating an artifact as validated. This workflow never publishes a release or deploys Cloudflare.

## Controls, scaling, recovery and shutdown

- Existing WASD/mouse, pointer lock, weapons, inventory and account controls are unchanged.
- **View → Toggle fullscreen** / **F11** / **Alt+Enter** switch the native game window between fullscreen and windowed. Escape retains its game meaning; use F11/Alt+Enter to leave native fullscreen.
- Windows resize/DPI events flow through WebView2 to the existing viewport/ResizeObserver and responsive HUD. Sizes are logical pixels; no fixed screenshot scaling or renderer DPR override is added.
- **Game → Connection & help** brings back the local launcher even if the hosted page cannot load. **Game → Reload field…** navigates back to the trusted origin after a warning about unsaved progress; it does not silently reconnect or change room rules.
- A cosmetic desktop banner reports browser offline/online events. Those events indicate network availability, not proof that Cloudflare or a room is healthy. Existing room-disconnect/solo-resume and cloud-save error messages remain responsible for server failures. The banner never resends attacks, room messages or saves.
- Before closing, release the mouse, open Account, select **SAVE NOW**, and verify success. Closing the game, Alt+F4 or Game → Quit shows a native reminder and allows cancellation. No native automatic save or offline save guarantee is introduced; existing unsaved progress can be lost. OS shutdown/crashes can bypass a reminder. Confirmed quit exits the entire host; there is no tray/background service.
- Closing the launcher while the game is open hides the launcher; closing it before opening a game exits. Existing sessions remain in the WebView profile until normal logout/expiry. Uninstall/profile removal behavior must be checked during Windows acceptance testing; do not assume uninstall erases sessions.

## Signing and distribution

Test builds are **unsigned**. Windows SmartScreen/Defender may show an unknown-publisher/reputation warning or block them. Do not tell players to disable Windows protection. Distribute public builds only after review, scanning and signing policy is established.

For a public release, use a trusted Authenticode certificate or a supported signing service and configure Tauri's Windows signing options/sign command. Sign the app executable **and** final installer, use a trusted timestamp service, and validate both with `Get-AuthenticodeSignature` / `signtool verify /pa`. Keep private keys, certificate passwords and signing credentials in restricted CI secrets or the signing service, never this repository. Signing identifies the publisher; it does not instantly guarantee SmartScreen reputation. No signing certificate, update server, auto-updater or production release publication is configured here.

## Validation status and remaining acceptance tests

Locally available environment: Linux, Chromium, Node and an installed Rust toolchain for portable policy tests. A local Windows desktop/WebView2 environment is unavailable. Linux Rust tests exercise URL policy, **not the Windows host module**. A successful Windows workflow is required to establish native compilation and installer creation; see its actual job/artifact result. No installer or native Windows test is claimed solely from the source configuration.

Passed local checks: 53 Node tests (including desktop security configuration), root typecheck/build, launcher TypeScript/build, four Rust URL/navigation policy tests and portable clippy. Browser launcher layout/keyboard/retry and offline-banner checks are recorded separately from native checks. Root build output is unchanged from the merged performance release.

Before calling the Windows edition ready:

- Install, launch, resize, fullscreen, cancel/confirm quit and uninstall on Windows 10 and 11; test WebView2 installation on a clean machine.
- Check 100%, 150% and 200% DPI, display changes, 1366×768 and 1920×1080, pointer lock release/recapture, Alt+Tab, keyboard layout, audio startup/mute and GPU rendering/presets.
- Use a staging test account to verify login, cookie persistence after app restart, logout, save/reload/revision-conflict behavior, failed login and session expiry. Confirm normal secure cookies and exact request Origin in WebView2 developer tools in a debug build.
- Join the same staging room with three PC clients and one Android client, including the Windows edition. Verify WebSocket authentication, combat/extraction, disconnect/rejoin and cloud progression. Browser/Android clients require no changes.
- Turn Wi-Fi off/on; test a server outage and a blank initial page. Confirm the native help/reload menu remains usable and there is no misleading save success.
- In a debug build, verify remote attempts to invoke `start_game`, filesystem, shell and dialog/opener commands are rejected. Check external HTTPS popups open the browser, cross-origin redirects stay blocked, and `file:`, `javascript:`, `data:`, `ms-settings:` and credential-bearing links cannot launch native handlers. Verify downloads/file drops are rejected.
- Verify installer/app signatures for a signed release and document any remaining SmartScreen/antivirus behavior. Measure performance on actual Windows hardware; do not infer an FPS gain from Tauri packaging.
