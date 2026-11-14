# Cosmetic combat feel pass

## What changed

- The original aim camera retains camera yaw/pitch, shoulder framing, ray construction and wall checks. A separate render camera adds a critically damped position spring, bounded pistol/rifle recoil and a brief damage impulse. The render camera also receives a wall check. Reticle projection follows the unshaken aim direction. The old recoil offset was removed from the aim camera, where it could influence later shot rays.
- No server code, combat constants, cooldowns, damage values, input action packets, hit-validation logic, account saves or network protocol changed. No weapons/enemies were added. Render-camera state, particles, audio and animation offsets are never inputs to shot packets or collision simulation.
- Confirmed local solo melee and ranged hits and server-confirmed ranged hits receive a short hit label, reticle cue and sound; server-credited local kills get an elimination label. Remote hits do not produce the local confirmation cue.
- **Protocol limitation:** the existing server sends a melee action acknowledgement but no nonlethal melee hit attribution. Co-op swings retain their animation/whoosh, and authoritative enemy HP changes produce neutral enemy reactions/particles. Nonlethal co-op melee is not falsely labeled as a confirmed personal hit; own credited melee kills are confirmed. Accurate nonlethal attribution would require a future protocol change.
- Infected receive visual torso twist/backward recoil in addition to existing hit flashes and collapses. Root positions, hit spheres, pathing and attack timing do not stagger or pause. Survivor support-hand release and aiming/locomotion posture blend; firing adds shoulder motion and melee adds torso follow-through. Existing procedural and GLB fallback paths remain.
- Muzzle flashes use a short additive envelope and weapon-dependent scale. Local and newly created remote weapon point lights respect preset lighting limits. Tracers are capped at 16 active lines.
- Impact particles use one preallocated 64-position Points buffer: Performance 0, Mobile 12, Balanced 40, Cinematic 64 concurrent particles, with sub-half-second lifetimes. These caps apply to this effect subsystem, alongside existing world-effect budgets.
- Reload progress/ready/empty states, phone reload labels, stamina exhaustion colors and healing-panel emphasis clarify existing state. These displays never complete a reload or heal.
- Eight original synthesized cues (pistol, rifle, reload, ready, hit, melee, hurt, heal) use deterministic oscillator/noise envelopes with cached AudioBuffers, one gesture-unlocked AudioContext, eight-voice cap, volume/mute settings persisted locally, tab-hidden suspension and disposal. No audio downloads or third-party recordings/assets are used.
- Reduced motion removes cosmetic camera spring lag/recoil, suppresses impact bursts and reduces damage/reticle motion; essential text feedback remains.

## Validation and evidence

Run `npm test`, `npm run typecheck`, `npm run build`. Four new Node regression tests check spring convergence/frame-rate consistency, continuity/suspension bounds, preset particle budgets and bounded synthesized cue profiles.

`tests/browser/combat.cjs` requires Playwright and Chromium in the test environment. Start Vite on port 5173, then run `node tests/browser/combat.cjs`; `GAME_URL` and `ARTIFACT_DIR` override its server/capture directory. It uses the real Game shooting method with controlled presentation/player/network stubs, proving identical outgoing shot direction before/after cosmetic recoil and no outgoing shot on locally rejected fire. It also checks particle caps/cleanup, reload/empty states, audio settings, the running audio graph/all eight finite cached cue buffers, reduced-motion recoil suppression and disposal. It does not connect to a production room.

Browser audio-graph validation does not establish perceived loudness, timbre, spatial positioning or successful phone speaker output. Sound effects are intentionally non-spatial; no mix or speaker listening approval is claimed.

## Playtest checklist

1. Fire single pistol shots, then hold rifle fire. Confirm a small recoverable kick, smooth follow when stopping/starting or moving sideways, and a stable aiming point; test near walls and switching aim distance.
2. Shoot an infected, a wall and empty space. Hit cues should appear for confirmed hits only. Compare melee hit/miss and lethal/nonlethal reactions; enemy gameplay movement and attack timing must continue.
3. Reload partially empty and empty weapons; switch weapons during reload. Check progress, empty/ready labels and touch LOADING/RESTART labels against actual ammunition.
4. Sprint until exhausted. Take damage, bandage while stationary, and interrupt healing by moving/attacking. Check colors, sounds and progress without early healing or damage changes.
5. In Field Menu, adjust Effects volume and Mute. Reload the page and check persistence. Test background/foreground, first user gesture, phone silent mode/Bluetooth and headphones at modest volume.
6. Compare all four graphics presets. Performance should emit no impact particles; Mobile should remain sparse and omit weapon point lights. Enable reduced motion and check text feedback still works.
7. Play three PCs plus one Android in a room: check server-confirmed ranged hits, own credited kills, neutral enemy reactions, remote muzzle effects and join/leave cleanup. Do not interpret a co-op melee swing acknowledgement as proof of a hit.

Manual follow-up remains necessary for actual Android GPU/heat/audio, camera comfort and wall behavior during real movement, delayed/lossy multiplayer, full-session combat/extraction and human evaluation of the sound mix.

## Results on this branch

- 46 Node tests passed; typecheck and production build passed. The existing Vite bundle-size warning remains.
- The combat browser regression passed with no page errors: two identical outgoing shot packets despite render recoil; locally rejected fire emitted no packet; Mobile/Performance/Cinematic particle caps and cleanup passed; reload/empty labels, persisted settings and reduced motion passed. Chromium ran all eight cached sound buffers with finite samples.
- A controlled Cinematic gallery render with the new render camera and impact Points passed without shader/page errors. This is an isolated renderer check, not a whole-world performance measurement.
- A local-Worker authenticated gameplay instance was exercised through a test-only module-response hook (no debug hook ships). The inspected desktop capture shows injected hit feedback; transient effects were driven directly and the simulation was frozen for capture. These captures do not prove a real hit or a complete gameplay session. The later live mobile capture attempt timed out in software rendering; physical-phone and full live visual playtesting remain pending.
- Existing character/animation and four-viewport UI browser suites passed without page errors. The combat harness also simulates a Web Audio buffer-allocation failure and verifies the optional sound call does not throw into combat.
