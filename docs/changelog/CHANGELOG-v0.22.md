# v0.22 — Graphics and animation pass

This is the first follow-up to v0.21: graphics and animation, ahead of the planned zombie-group/survival and creature-ability work.

## Survivor and guns

- Replace the solid torso capsule with a shaped jacket, refine head/helmet, neck, backpack and belt placement, and articulate the knees and boots.
- Give both arms independent shoulder and elbow joints. A bounded two-bone solution keeps the hands at the gun grips and prevents limbs stretching when a target is out of reach.
- Use distinct pistol and carbine geometry: receiver, grip, sights, barrel, stock, magazine and an optic. Group static geometry by material to limit draw calls while keeping the slide, bolt and magazine movable.
- Animate the slide/bolt, muzzle flash, recoil recovery, lowered ready stance, two-handed aiming and magazine movement while reloading. The gun and arm pose follow camera pitch. Tracers originate at the visible muzzle while retaining the server's authoritative hit calculation.
- Add a short hit reaction and a falling defeat pose; restart restores the upright pose.
- Co-op now displays selected guns, aiming direction, reload progress, walking/running and firing on remote players. Cosmetic pose fields are sanitized; reload progress is derived from server-owned ammo timers.

## Environment and presentation

- Replace the reused leaf-texture grass with blade cutouts, connect tree leaves to twig silhouettes, add low undergrowth, and animate a gentle breeze in foliage and its shadow pass.
- Reduce the ground's exaggerated bump depth, add fallen-leaf surface detail, and distinguish the settlement's worn asphalt and faded road markings from the forest trail.
- Replace the distant sphere hills with a continuous ridgeline and add doors, steps, lintels and downpipes to the settlement exteriors.
- Reduce ambient fill lighting for more natural depth. Existing world collision, mission coordinates, account keys and Cloudflare namespaces remain compatible.
- Fold the collection/evolution roster into an expandable journal section, giving more space to the 3D view. Click its summary to expand; C still cycles owned companions.
- Recheck the smoothed shoulder-camera position against obstacles each frame so smoothing does not carry the camera through a wall.

## Graphics modes

Open **FIELD MENU → GRAPHICS** after releasing the mouse with Escape:

- **Balanced** (default): directional shadows, foliage movement and the normal scene renderer.
- **Cinematic**: adds half-resolution ambient occlusion/contact shading and multisampling. This costs more GPU time. Alpha-cutout foliage is excluded from the occlusion geometry pass to avoid rectangular leaf-card artifacts.
- **Performance**: disables directional shadows and uses a 1× pixel ratio. It also bypasses cinematic postprocessing.

All models and textures remain original procedural art, not photoreal scanned assets or externally authored skinned characters. This pass improves presentation and animation; it does not claim photorealism or a measured FPS improvement.

## Validation

- 19 automated tests, including bounded pose input, arm lengths, unreachable/coincident arm targets, room pose propagation and the existing combat/account/save checks.
- TypeScript and production build.
- Chromium with software WebGL: actual registration, scene rendering, pistol fire, ammo-consuming reload, weapon switching, rifle aiming/held fire, movement, Cinematic and Performance modes, and no JavaScript/shader errors. Captured and inspected Balanced, rifle-aim and Cinematic frames.
- Two authenticated clients against local Wrangler: remote weapon/pitch/aim state, server-derived reload progress, shared shot events, kills and persistent collection XP.

Production Cloudflare deployment, real-device performance, four-player load and mobile touch controls still need verification. Building interiors, multiple simultaneous zombies and new creature mechanics are not included in this graphics-first pass.
