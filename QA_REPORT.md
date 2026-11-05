# AETHER STRIKE — QA and Implementation Status

Date: 2026-10-31.

## What has been implemented in source

| System | Implementation | Verification |
| --- | --- | --- |
| Asset integrity | All three supplied GLBs copied exactly to public/assets; SHA-256 matched byte-for-byte | **Passed** (file hash check) |
| Asset inspection | Parsed all meshes, material and embedded image counts, skeletons, named clips and durations | **Passed** (GLB inspection script and metadata) |
| TypeScript / React shell | Vite, React application, menus, settings, HUD, webcam panel, end screens | **Syntax parsed**; not browser-tested |
| First-person viewmodel | Source GLB, orientation correction, 0.65× scale, scoped ADS positioning, idle sway, recoil and reload transform | **Implemented**; visual alignment needs browser validation |
| Automatic weapon | 80 rounds, reserve, firing interval, precision spread, auto reload, ammo count, ray-based hit detection | **Implemented**; gameplay not live-tested |
| Gesture classification | Right hand, mirrored landmarks, fist, pinch/hold, double pinch, lost-hand fail safe | **Passed** isolated offline tests; webcam not tested |
| Enemy | Source skeleton, verified idle animation mixer, state machine, hitbox, returning fire, suppression, procedural death | **Implemented**; live animations not browser-tested |
| Enemy terrain placement | Floor projection, selection restricted to current camera view and line of sight | **Offline surveyed** for all nine soldiers; runtime not tested |
| Real environment | Original GLB, mesh-based floor height, double-sided raycast collision, level lights | **Offline surveyed**; rendered appearance not tested |
| Autonomous movement | Station-to-station waypoints, lowered gun, head bob, interpolation, collision gates | **Route surveyed**; live navigation not tested |
| Combat HUD and menus | Menu, Training, Settings, calibration, credits, pause, victory, defeat | **Syntax parsed**; button interactions not live-tested |
| Effects and sound | Tracers, muzzle flash, sparks, smoke, casings, ambient noise and synthesized cues | **Implemented**; perceptual quality not reviewed in browser |
| Graphics/performance | Quality presets, capped particles, limited NPC count, low cost lighting | **Implemented**; 60 FPS not benchmarked |

## Automated and offline checks performed

1. **Model originality:** `environment.glb`, `enemy.glb` and `first person view.glb` have equal byte counts and equal SHA-256 hashes to the user-provided originals.
2. **Source syntax:** All 13 TypeScript/TSX source files passed the local TypeScript `transpileModule` syntax pass.
3. **Gesture test:** `node --experimental-strip-types tests/gestures.mjs` passed: stable fist triggers ADS but not firing, sustained pinch triggers firing, pinch does not activate ADS, two quick pinches reload without firing, lost hand immediately ends firing, and mirrored horizontal input produces a relative-turn value.
4. **Mesh floor survey:** All three cover positions, all twelve inter-station route connections and the nine candidate enemy spawn regions were projected against upward-facing triangles of `environment.glb`; no replacement floor was used.
5. **Obstacle survey:** A direct three-dimensional triangle ray-segment test found no intervening geometry across the twelve station-route connections. Eight of nine original enemy positions had direct line-of-sight; one (`8,-7.5`) was obstructed and the runtime candidate search has an unobstructed fallback near `(7.5,-7.5)`. One other candidate may be adjusted to satisfy the configured minimum distance.

## Build and browser-test blockers

The working environment cannot resolve `registry.npmjs.org` (DNS resolution failed). `npm install` did not complete. Consequently:

- **`npm run build` was not completed.** Full TypeScript type checking requires the unavailable dependency type packages.
- **No Chromium gameplay run was completed.** A browser binary exists, but Vite/dependencies are unavailable to serve the React/Three.js application.
- The webcam is not exposed for live testing here, so recognition accuracy, handedness on camera, lighting thresholds and the camera permission flow remain untested on real video.
- FPS, scene composition, potential weapon-hand alignment imperfections and transition clipping need review after running on a connected desktop.

These remaining tests must pass before this can be called a production-ready or fully verified game. **The project is delivered as a best-effort complete first-mission codebase, not as a certified finished release.**

## Suggested manual acceptance checklist

1. Run `npm install`, `npm run build`, `npm run dev` and check console for errors.
2. Confirm all three supplied models appear with correct orientation/scale and no visible floating above the real floor.
3. Confirm enemy counts 3→3→3, and all targets can be hit from their stations.
4. Check station transitions travel continuously across the environment without wall clipping or stalling.
5. Enable webcam on HTTPS/localhost: right hand only; open, fist, held pinch, double pinch, hand lost; test in bright and dim light.
6. Confirm recoil, flash position (actual barrel), ADS centering and reload motion; confirm flash appears only for active firing.
7. Check AI line of sight, realistic suppression, return fire, critical health and defeat.
8. Clear all three stations; confirm victory, score and restart. Pause and resume during sustained firing; ensure fire stops when paused.
9. Test low/medium/high quality and audio toggle; record frame time and GPU memory on target desktop.

## Source integrity fingerprints (SHA-256)

- `environment.glb`: `a663e3b3ca34ec297fbb3e6d7f0c8b54a1f0da9f0dbff828b533341c3db48a81`
- `enemy.glb`: `f00982db81b70687f89803fa1427f4caf99c324d64b6a0992ebf769ab054e71c`
- `first person view.glb`: `2a649cb707fe6cd3a6e6fbcfdb7768362640a7a68274aad9ba255e85fbb293b6`


**Latest status (v1.4):** See QA_PATCH_1_4.md. Standalone gesture tests, original-GLB surface checks and source syntax checks passed. Live browser/WebGL/webcam verification and complete Vite build were not possible in this environment.
