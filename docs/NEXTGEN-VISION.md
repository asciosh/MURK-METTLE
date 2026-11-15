# MURK & METTLE 2.0 — nextgen vision

Status: approved product direction; implementation has not started. Recovery date: 2026-11-15. Read with [roadmap](NEXTGEN-ROADMAP.md) and [verified progress](NEXTGEN-PROGRESS.md). This direction supersedes older Windows/Tauri product instructions without deleting their source or historical evidence.

## Product and priorities

Rebuild MURK & METTLE as an original, AA-inspired **web-only third-person action RPG**. Graphics, professional-quality models, expressive animation and fun, responsive gameplay are the highest priorities. AA-inspired is a quality goal, not a claim about the current prototype, staffing or guaranteed performance.

The core loop is: prepare in an upgradeable 3D sanctuary → equip a survivor and original creature companion → enter a zombie expedition solo or with up to four cooperating players → fight, explore and recover resources → choose whether to risk continuing or extract → retain earned RPG progression and invest in creatures, gear and sanctuary upgrades.

Required pillars:

- Zombie survival with readable threats, satisfying ranged/melee combat and recovery opportunities.
- Original collectible creatures with distinct silhouettes, personalities, abilities and visible evolution.
- Secure four-player cooperative multiplayer with reconnect behavior and authoritative shared rewards.
- Extraction expeditions with objectives, risk/reward, failure rules and multiple difficulty levels.
- Permanent survivor and creature RPG progression, equipment upgrades and compatible persistent saves.
- A navigable, upgradeable 3D sanctuary with shops, crafting and equipment services.
- Clear UI, useful audio feedback and scalable browser graphics.

## Visual and gameplay direction

Retain the original botanical survival identity while raising material, lighting, composition, anatomy and animation quality. Establish one polished environment slice and one credible animated survivor before expanding content. Prefer coherent, licensed production assets or original authored models over accumulating decorative primitives. Evaluate third-person camera obstruction, aim alignment, locomotion transitions, hit reactions, foot contact, creature readability and zombie telegraphs in motion, not screenshots alone.

Five existing original species and fifteen forms are a reusable design/art baseline, not proof that M04 is finished. The current survivor GLB has rigid-node clips and no skeletal skin; professional skeletal animation remains future work. Existing original/properly licensed assets and procedural fallbacks stay recoverable.

Choose the graphics engine through a documented M01 evaluation of quality, browser compatibility, animation support, asset pipeline and measured budgets. Three.js is the existing engine; no engine replacement or dependency upgrade is chosen in M00. Establish target browsers, reference hardware and frame/loading/memory budgets before making performance promises.

## Boundaries and compatibility

A ground-up graphical client rebuild is authorized in an isolated nextgen path/entry, selected during M01. Preserve the working legacy production entry until a separately approved cutover. Do not discard existing game systems simply because their presentation changes.

Keep Cloudflare infrastructure, accounts, persistent data and secure multiplayer systems. Preserve Worker identity, Durable Object bindings/classes/migrations, save keys, authenticated same-origin sessions, authoritative validation, revision conflict handling and preview isolation. Client rendering changes must not weaken these contracts. Future game features need compatible, verified extensions rather than replacement production stores.

Current legacy solo progression is client-computed; co-op has server validation. Username/PIN authentication and failed multi-account reward reconciliation are known release risks. Preserve protections already present and address hardening deliberately before public release.

No native application, Tauri work or Windows installer is part of 2.0. Legacy desktop source remains untouched during recovery. No unauthorized copyrighted assets or paid services. Every new asset needs recorded provenance and permission to redistribute; avoid copied franchise creatures and unverified downloads.

## Delivery gates

All M00–M11 work uses small verified checkpoints, updated progress, an exact next task and an appropriate Git commit. Milestone completion requires its roadmap acceptance evidence; an existing analogous prototype feature does not automatically complete a nextgen milestone. No automatic merge, deployment or production cutover. This session completes recovery only and stops before M01.
