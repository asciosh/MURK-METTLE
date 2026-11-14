# v0.26 — Motion, atmosphere and Android touch play

## PC and mobile controls

Mouse/keyboard remain the PC default. Devices with a coarse primary pointer and touch points automatically enable thumb controls. The field menu lets you choose Auto, Touch or Mouse & keyboard explicitly.

- Left thumb stick moves, with a small dead zone and partial-speed movement. Drag the view to look around. Dragging the held FIRE button also turns the camera, so two thumbs can move, aim and shoot together.
- FIRE taps fire the pistol; holding FIRE uses the rifle's existing automatic fire. AIM and RUN toggle. WEAPON switches pistol/rifle. USE bonds, picks up, resupplies or extracts under the existing interaction rules. PULSE, MELEE, HEAL and RELOAD have touch buttons. When defeated, RELOAD becomes RESTART.
- Slow analog movement cancels server-side bandaging, matching the existing stationary-healing rule.
- The phone HUD keeps vitality, stamina, ammo, nearby enemy health, group status and a crosshair visible. JOURNAL opens the existing collection, progression, objectives and map in a scrollable sheet. Habitat tracking remains visible during play. BACKPACK and the co-op field menu remain accessible.
- Each pointer is tracked independently. Releasing FIRE does not release the movement stick. Canceled/lost touches release their action; blur, page hiding, resize and menu entry clear held movement/fire and aim/run toggles. Touch mode does not request pointer lock.
- The canvas now follows its viewport in CSS as well as its drawing buffer, fixing stretched/clipped rendering after phone rotation or PC window resizing.
- Portrait and landscape layouts include safe-area offsets and a dynamic viewport height. Rotation is supported; it clears held input. Landscape is recommended for more room, but is not forced.

## Quality presets

A fresh touch device defaults to **Mobile**, with photographic textures off. PC defaults to **Balanced** with the existing photo option enabled. Quality and photo choices are saved in this browser, independently of the account save. Controls can be overridden without forcing a quality change.

Mobile caps render pixel ratio at 1, requests at most 30 rendered frames per second, disables dynamic shadows and point lights, reduces cloud layers and falling leaves, and thins grass/undergrowth. Reduced tree detail keeps crown cards on every tree. Changing back restores original instance matrices and colors. Leaving Cinematic disposes its postprocessing targets. These are rendering limits, not a promise of 30 FPS on every phone.

## Animation and world detail

- Walking and running use a planted stance/recovery cycle with two-segment leg solving, knee bends and compensating boot angles, smoother weight transfer, torso movement and head motion. This is authored procedural motion on flat gameplay terrain, not full terrain-aware foot locking.
- Lowered-gun movement relaxes the free arm; aiming/reload poses retain weapon hand placement. Bandaging has a distinct two-hand pose and visible wrap; it does not change the healing rules.
- Infected have articulated knees/feet, breathing/sway and a clearer attack wind-up. Killed infected fall and fade for 0.9 seconds, then release their resources. They leave targeting and combat immediately; the body is visual only. Remote survivors briefly show their existing fall pose before disappearing.
- Creature wings flap, tails move and ground creatures move their legs. Remote companions now animate too. Accepted server-side melee and pulse actions broadcast cosmetic events to other clients; ownership, life and cooldown checks still happen first. Bandaging poses use the existing survival snapshots.
- Curved fern fronds, restrained falling leaves, moving cloud layers and scrolling water ripples add motion. The wetland outline is less circular. Mobile reduces visual density while keeping the same world and collision.

Accounts, map bounds, creature evolution, combat balance, inventory formats and Cloudflare binding/migration configuration are unchanged. Reload all open tabs after updating.

## Limits

Android Chrome device emulation checks touch input and layout; it does not establish physical-phone GPU performance, battery use or browser-toolbar/keyboard behavior. Test the preview on the friend's Android before merging. Models remain procedural, water uses environment reflections, and the map is still a flat collision surface. Menus do not pause the co-op world. Existing authentication and solo-authority limitations remain.
