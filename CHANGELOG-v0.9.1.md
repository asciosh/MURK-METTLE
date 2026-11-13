# v0.9.1 — Character / Animation Pipeline

- New reusable `ActorAnimator`: optional GLB loading with `GLTFLoader`, `AnimationMixer` and clip switching.
- Manifest-driven optional 3D assets in `public/models/manifest.json` with documented Blender export contract.
- Procedural survivor now has articulated legs and an animated walk/sprint pose.
- Procedural zombies now use moving legs plus current arm attack animations.
- Lanternkin has richer idle breathing and foliage sway; pulse remains visible.
- Existing v0.9 gameplay, networking messages, progression keys and mission locations are preserved.

## Known limitations
- No licensed/rigged GLB models are bundled, so procedural fallbacks remain by default.
- Optional external model animation names must match the documented contract.
- One GLB is loaded per actor to keep independent skinning; optimize/caching later for many enemies.
- Co-op and persistence are not newly validated in this milestone.
