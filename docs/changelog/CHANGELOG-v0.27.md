# v0.27 — The Visual Leap

Built on the merged Windows cleanup (`45b8e34`). Windows Chrome/Edge and the experimental Tauri host remain the player targets. This release does not restore Android or alter accounts, saves, server combat, multiplayer messages, progression, collision or spawn coordinates.

## Visible changes

- **Forest:** stronger branches and curved, varied crowns; cooler distance haze against warm directional sunlight; moss/leaf-litter transitions, low roots and climbing foliage. Original 713 trees and preset density restoration remain.
- **Settlement:** weathered green facade bands, wall-supported awnings/louvres and hanging vines. Existing buildings, paths and landmarks stay in place.
- **Habitats:** Lanternkin seed flowers, Emberling copper leaves, Mossback bracket caps, Stormrook fallen feather motifs and raised Reedwisp water blooms. Five canonical homes and the flat floor are unchanged.
- **Creatures:** all 15 forms now use original curved botanical meshes and readable eyes. Lanternkin's crown sits behind its face; Emberling has leaf ears/ruff and a moving curled tail; Mossback has fitted shell scutes; Stormrook has layered feathers; Reedwisp has fins and whiskers. Blinks, secondary movement, restrained glow and growth/pulse ground compensation improve readability. Nearby wild creatures turn visually toward the player. Cosmetic replacements retain their normalization and isolation.
- **Survivors/infected:** softer clothing, respirator/blanket details and rounded GLB equipment; clearer bark/fungal/rag silhouettes on infected strains. Existing articulated movement, weapon handling, stagger and death logic remain. No new skeletal rig is claimed.

All new assets are reproducible original source, with [provenance](../VISUAL-ASSETS-v0.27.md). No new dependency, binary art download or external license requirement. Optional photo textures remain supported. Windows CI still compiles/packages; executing an unsigned installer now requires explicit manual opt-in and was not requested/run for this release.

## Reproducible visual evidence and cost

Run Vite on 5173, then `ARTIFACT_DIR=/tmp/murk-visual npm run test:visual`. Baseline checkpoint `a54028a` contains the same camera/seed fixture. The Game views use the real `Game` and `FieldGraphics`, 1366×768, DPR 1, Balanced, original local materials, seed 27027; gallery close-ups use identical neutral lighting before/after. Captures live outside this source-only PR at `/workspace/work/visual-v027/before/` and `/workspace/work/visual-v027/final/` in the implementation workspace. They can be regenerated from the baseline checkpoint and this branch.

Inspected forest, settlement, wetland, survivor/infected poses and all five creature species/evolution forms. Review corrections included canopy geometry cost, speckled distant hills, hidden flower heads, antler height, overlapping shell leaves and facial surface intersections. Browser fixtures also capture aim, healing, firing feedback, hit/death and pulse states. These are controlled visual checks, not a human expedition.

Measured counters from the same Linux Chromium/SwiftShader environment (shadow passes included):

| Game view | Draw calls before → after | Triangles before → after | Textures before → after |
| --- | ---: | ---: | ---: |
| Forest | 261 → 300 | 592,046 → 712,344 | 38 → 38 |
| Settlement | 239 → 308 | 488,864 → 669,038 | 38 → 38 |
| Wetland | 191 → 232 | 412,466 → 558,702 | 38 → 38 |

This is an art upgrade with a measurable rendering cost, **not an FPS improvement**. Geometry rises approximately 20–37% in these views; draw calls rise approximately 15–29%. Added geometry is merged by material, small environment meshes use lower detail, existing vegetation culling/presets remain, and no new light or texture is added. Creature builds stay below 18,000 triangles per form. Detailed [baseline](../performance/visual-v0.27/baseline.json) and [candidate](../performance/visual-v0.27/candidate.json) retain counters for all forms. No hardware FPS, frame-time or GPU-memory-byte benchmark is claimed.

## Validation and manual acceptance

Final command outcomes are recorded in [the progress log](../VISUAL-UPGRADE-PROGRESS.md). The automated scope includes Node rules/security/GLB validation, TypeScript, production Vite, a Cloudflare dry run, seven source browser suites, production loading/mods/local four-session transport, and the desktop launcher. No production account, deployment or room is used.

Still needs a Windows hardware playtest:

- Compare Performance/Balanced/Cinematic, original/photo materials, shadows and visual readability on actual GPUs at 1920×1080 and 1366×768. Record sustained frame time; shadowed foliage and whole-world merged details remain cost centers.
- Walk the forest, Haven and reedwater; orbit every creature at each stage, blink/pulse/walk, swap a cosmetic and verify close-range intersections. Stylized procedural anatomy is retained; this is not a professionally skinned character replacement.
- Aim, fire, reload, melee, heal, take damage and watch infected collapse with keyboard/mouse. Check UI visibility, reduced motion, fullscreen/resizing and Alt+Tab.
- Play a full expedition with four separate Windows accounts/devices, including browser and Tauri. Local four-socket tests do not prove four rendered PCs, native WebView2 behavior, live saves/rewards under lag or long-session performance.
- Native Windows build/installer acceptance remains separate. No Windows installer or installation success is claimed from this Linux session, and no unsigned installer was executed.
