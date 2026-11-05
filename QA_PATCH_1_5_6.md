# AETHER STRIKE v1.5.6 — Compact animated red enemies

## Changes

- All soldier enemies now render as much smaller 2D PNG billboards: base sprite height **0.83 world units**, compared with **2.25 world units** in v1.5.5 (approximately **63% shorter**). Heavy, armored, and priority units receive modest size multipliers.
- Rebuilt the silhouette animation assets using the user's tactical soldier silhouette reference. The treatment is bright neon red outlines and translucent red fill.
- Added **48 unique PNG frames**: 8-frame standing/idle cycles, 8-frame moving/stride cycles, 8-frame weapon-raised/firing cycles, and two artwork variants per cycle.
- **Feet anchored:** removed the vertical bob animation and placed each sprite's bottom at the floor height. Walking now cycles PNG poses while the enemy moves between real walkable points.
- When enemies return fire, their 2D pose changes to an armed shooting pose with short recoil-frame animation and a brief muzzle flash.
- When enemies are eliminated, their silhouette collapses rapidly without alpha fading, and a red **48-particle burst** and expanding ring appears in its place.
- Kept existing combat behaviors: six encounters, range-based spawns, AI, hit detection, health bars, suppression, player ADS, webcam gestures, and cover movement.
- Removed the unnecessary enemy GLB **runtime load**. The original GLB files remain in `public/assets` for archival/reversion and are not rendered.
- Fixed one invalid enemy spawn anchor in the final sector (`x:10.1, z:-13.4`).

## QA

- PASS: `npm run test` (existing gesture simulations)
- PASS: `npm run test:level` (six cover locations and 28 enemy anchors have walkable mesh floor)
- PASS: `python tests/verify_enemy_animations.py` (PNG frames, transparency, grounded code, particle trigger)
- PASS: TypeScript syntax transpilation checks on modified source files
- NOT VERIFIED: full `npm run build` (dependencies could not be installed in this environment)
- NOT VERIFIED: in-browser animation, particle rendering, live webcam tracking and enemy visibility. Test these on the user's desktop.
