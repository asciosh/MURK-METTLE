# Performance engineering report

Baseline: merged world improvements at `ad1e488`. Candidate: this change. No combat, progression, account, navigation, collision or packet rules changed.

## Reproducible measurements

Raw results: [baseline](performance/baseline.json), [candidate](performance/candidate.json), and [rejected 32m cells](performance/cells32-rejected.json).

Both runs used the actual `Game` renderer in development mode, Chromium 156 with ANGLE SwiftShader (software Vulkan), 960×540, DPR 1, photographic surfaces disabled. Camp is player `(0,0,0)`; haven is `(0,0,-38)`; camera yaw 0, pitch 0.2. Simulation and networking were stopped. Each case used two warmups followed by five `renderScene()` calls synchronized with `gl.finish()`. These are stationary render workloads, **not gameplay FPS benchmarks**. CPU contention and shader warmup are not controlled sufficiently to establish a hardware speedup.

| Preset / scene | Draw calls before → after | Triangles before → after | Median synchronized wall time, ms before → after |
| --- | ---: | ---: | ---: |
| Mobile / camp | 267 → 182 | 403,912 → 272,666 | 2.4 → 6.9 |
| Mobile / haven | 186 → 121 | 390,146 → 183,552 | 1.5 → 1.0 |
| Balanced / camp | 380 → 292 | 936,806 → 658,044 | 3.4 → 2.9 |
| Balanced / haven | 406 → 248 | 929,788 → 519,112 | 3.0 → 1.7 |

Submitted draws fell 23–39%, and triangles fell 30–53%, with existing density settings retained. Timing was mixed: **Mobile camp regressed in this sample**. Do not translate these measurements into an FPS claim. Texture counts stayed at 36 Mobile / 38 Balanced; geometry counts fell from 264–283 to 148–157. Counts are renderer resources, not memory bytes.

An identical 120-iteration stationary HUD/weapon update workload produced 3,121 → 362 DOM mutations (9.5 → 3.1 ms in these samples). This is a synthetic update workload, not a whole-frame benchmark. The title-screen regression fixture rendered once during 20 ticks; distant wild-creature updates fell from the previous 300 calls/second to 92 in the fixture. These are scheduling counts, not measured FPS.

### Repeat the stationary comparison

Install dependencies with `npm ci`. Start `npm run dev:client` on port 5173. With Playwright and `/usr/bin/chromium` available, run:

```sh
PERF_OUTPUT=/tmp/murk-performance.json node tests/browser/performance.cjs
node tests/browser/performance-safety.cjs
```

Run the production loading fixture against a built local Worker with `node tests/browser/loading.cjs` (default port 8787; override `GAME_URL` for another local preview).

The benchmark stubs authentication and exposes the game only by intercepting the development entry response; no benchmark hook ships in the product. To repeat the baseline, check out `ad1e488` separately, copy the candidate's `tests/browser/performance.cjs` into that checkout, and run the same command on the same port, sequentially. Keep hardware, viewport, preset and photo setting identical. The game-dev CLI required for sealed performance adapters was unavailable here; these JSON files are ordinary Playwright evidence, not sealed telemetry bundles.

## Implemented changes

- Vegetation instance groups are divided into 64m spatial cells, retaining exact instance transforms/colors, shared geometry/materials, wind shaders and reversible quality density. Frustum culling can reject distant groups instead of submitting the entire forest. A 32m trial added too much submission overhead and was discarded.
- Opaque static world meshes sharing a material and shadow behavior are merged before gameplay actors are created. Transparent water, animated actors and gameplay markers remain separate. Flat ground, collision and habitat anchors are unchanged.
- HUD text/bar writes skip unchanged values. Minimap redraws at most 10 Hz and skips hidden canvases. Reload completion and authoritative state processing retain their existing cadence.
- Only unbonded wild creatures beyond 50m use accumulated 10 Hz animation updates outside Cinematic. Nearby creatures, the active companion, players, zombies, combat and network interpolation retain existing update scheduling. The current survivor GLB is equipment attached to procedural articulation, so it does not need an active skeletal mixer. Existing per-actor mixer ownership, cache leases and fallback behavior are retained.
- The opaque title screen renders its background once and invalidates on resize/quality changes. Teardown no longer resets and recreates solo simulation before disposing it. Instanced buffers, shadow targets, wild creatures, compositor targets and scene resources are released; the exercised teardown ended with zero tracked geometries/textures. Pending compositor and manifest loads check lifecycle state.
- Authentication initially downloads a 10.34 KB JavaScript bootstrap (4.09 KB gzip), rather than the previous 889.73 KB entry (237.25 KB gzip). After authentication, the game chunk is 234.88 KB (73.54 KB gzip) plus Three.js core 624.09 KB (155.85 KB gzip). Cinematic addons are a separate 27.01 KB chunk (7.47 KB gzip), fetched when selected and disposed when disabled. This defers work; it does not remove Three.js from the game. Build still reports the large engine-chunk warning.
- The loading status announces preparation, readiness and a retry path. Hashed `/assets/*` files receive immutable caching through Cloudflare static `_headers`. Unhashed `/models/*` assets revalidate, avoiding stale manifests/models on releases. Account API responses remain untouched.

## Development performance panel

Run the local Worker on 8787 (`npm run dev` starts the production-style build/watch and Worker). For development telemetry, additionally run `npm run dev:client`, then open `http://localhost:5173/?perf=1`. Vite proxies account and room requests to the local Worker. Use a local test account. The panel is removed from production builds.

The panel shows rolling rendered FPS, mean/p95 frame interval, total draw calls/triangles across render passes, geometry/texture counts, preset, snapshot receive age, arrival interval and smoothed arrival jitter. **Arrival jitter is not network RTT**; there is no ping protocol, so RTT is explicitly unavailable. F8 hides/shows the panel; its summary can be collapsed by touch or keyboard. Statistics refresh twice per second. A static title preview cannot provide ongoing gameplay FPS; enter the field before measuring.

For Android USB debugging, forward both ports to the phone and use localhost, or use a valid HTTPS development setup. Account cookies remain Secure; their protection has not been weakened to support plain HTTP over LAN.

## Quality and remaining costs

All four presets benefit from spatial culling, static batching, HUD changes and lifecycle fixes without removing authored world detail. Mobile retains DPR 1, fewer plants/cloud layers/particles, no dynamic shadows or companion lights, and offline surfaces by default. Performance retains its particle-free budget. Balanced retains full foliage and shadows. Cinematic retains its optional compositor and full wild animation cadence. Photo surfaces remain independently configurable. Existing preset names and saved settings remain compatible.

The survivor GLB is only 39,496 bytes / 3,072 triangles. Draco/Meshopt decoder overhead is not justified by this asset alone. Optional photographic maps total about 11.16 MB on disk; converting to KTX2 requires an asset/decoder pipeline and device validation, and was not introduced speculatively. No assets or licenses changed.

Remaining costs include full-density close vegetation, overdraw from cutout leaves, Balanced/Cinematic 2048² dynamic shadows, procedural actor mesh counts, initial procedural texture creation and the engine download. Static batching can make culling coarser for shared-material landmark parts. The software Mobile camp timing regression needs investigation on physical GPUs before claiming improved smoothness. GPU memory bytes, thermal behavior, sustained battery use, real network jitter and four-player rendering load have not been measured here.

## Validation and physical-device checklist

Passed: all 51 Node tests, `npm run typecheck`, `npm run build`, actual-game performance/lifecycle fixture, combat feedback/audio fixture, character GLB/lifecycle fixture, PC/mobile interface fixture, world anchors/flatness/quality fixture and production lazy-loading smoke test. Thirteen deterministic world captures were compared with the pre-optimization world captures; they remain visually unchanged (maximum mean absolute RGB channel difference below 0.001 on the 0–255 scale). The local Worker served the configured hashed-asset and model cache headers. Browser fixtures use Chromium software rendering or emulated touch; they do not validate physical Windows/Android GPUs.

On the same Windows browser and physical Android phone, compare the baseline and candidate at the same viewport, preset, photo setting and route. Warm up first; record panel statistics during a 60-second camp → forest → wetland route and a four-player encounter (three PC players plus one Android). Check nearby animation responsiveness, distant plant visibility, aiming, reload, healing, touch movement, minimap, quality switching and portrait/landscape rotation. Repeat after several room joins/leaves and quality toggles. Watch for culling holes, increasing resource counts, shader stalls, thermal throttling and frame-time spikes. Verify production cache headers/revalidation on a deployed preview; local preview behavior does not establish CDN behavior.
