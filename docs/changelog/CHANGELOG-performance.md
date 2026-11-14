# Rendering and loading performance follow-up

Built on the merged character, interface, combat and world improvements.

- Add an opt-in development performance panel (`?perf=1`, F8 / touch collapse) with rendered frame statistics, rendering/resource counts, quality and snapshot arrival diagnostics.
- Batch static scenery and spatially cull vegetation while preserving instance placement, wind and preset density restoration.
- Skip redundant HUD writes, throttle minimap drawing and distant wild animation, and render the opaque title preview only when needed.
- Defer the game engine until authentication and Cinematic effects until selected; add accessible loading/retry status and Cloudflare static caching headers.
- Fix teardown resource ownership and prevent simulation recreation or stale compositor allocation during disposal.
- Add telemetry, loading, quality-restoration and disposal regressions. Preserve gameplay, account, progression and multiplayer rules.

The same software-rendered stationary fixtures submitted 23–39% fewer draws and 30–53% fewer triangles. Wall-time samples were mixed, including a Mobile camp regression; no device FPS improvement is claimed. See [the performance report](../PERFORMANCE.md) and raw before/after JSON for methodology, results and remaining physical-device checks.
