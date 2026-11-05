# AETHER STRIKE — Patch 1.3: Camera Height, Environment Scale & Hand Recognition

## Source changes

1. **Original environment** scaled from 20× to **32×** (1.6×), retaining the exact supplied GLB geometry, materials and textures. Cover/waypoint coordinates and all nine enemy spawn anchors were scaled with it. Collision rays, floor sampling and sampling radius were adjusted accordingly.
2. **Player camera** is **1.03 world units above the actual triangle-sampled floor**, rather than an airborne camera with a fixed global Y coordinate. The project retains route-following transitions instead of airborne teleports.
3. **Original enemy soldier** rendered at 0.009× (formerly 0.01025×). Original first-person arms and gun rendered at 0.39× (formerly 0.46×), positioned lower. First-person muzzle flash is placed at the transformed original barrel tip; no replacement models.
4. **Camera hand steering** now treats landmark displacement over the actual webcam interval as angular velocity (radians/second), with a small position dead zone, time-based smoothing, and an adjustable sensitivity multiplier. The game no longer multiplies per-video-frame movement again every render frame.
5. **Gesture recognition** uses palm-relative geometry, pinch hysteresis, multi-frame confirmation, four-finger fist separation, held-pinch automatic fire, distinct rapid double-pinch reload, and immediate disarming upon hand loss/stall.
6. **Live calibration overlay** draws all 21 landmarks and hand connections, highlights thumb/index fingertips, and displays pinch ratio, folded-finger count, and detected turn speed. The webcam's mirrored-handedness label can be toggled in calibration if hardware orientation differs.
7. **MediaPipe dependency** is pinned to `@mediapipe/tasks-vision@0.10.35`, including its remote runtime fallback. `npm install` copies installed WASM locally using `tools/prepare-vision.mjs` and attempts to cache the official hand model.

## Tests run in this environment

- `npm test`: **PASS** — synthetic landmarks: fist ADS, sustained pinch fire, two quick pinches reload without shooting, no accidental ADS, no fire after lost tracking, responsive turn, stationary-hand no-drift, no camera jump upon reacquisition.
- `python tools/validate_level.py`: **PASS** — 3 existing-surface cover points, 12 route segments and 9 visible enemy placement regions after the 32× scale transformation.
- TypeScript/TSX syntax transpilation: **PASS** — 14 source modules and configuration, no parse/transpilation errors.
- Original asset SHA256 checks: performed against the three exact conversation-supplied GLBs; all preserved (see terminal QA output).

## Limitations: read before claiming complete

- `npm install` **could not run here** because the npm registry is unreachable from this container; `npm run build` was attempted and failed with unresolved external imports because `node_modules` is absent. TypeScript syntax transpilation is NOT the same as a complete typecheck or a production bundle.
- Physical webcam and actual 3D browser/WebGL testing **could not be performed** in this environment. Recognition can vary with lighting, camera orientation, skin occlusion and MediaPipe model confidence. No claim of 100% accuracy is made.
- The live overlay provides actionable feedback, but accuracy must be checked with a genuine webcam on `http://localhost:5173` or HTTPS after installing dependencies.

## Recommended acceptance tests on your machine

1. Delete/rename the old extracted directory, extract the entire v1.3 ZIP, open **its inner `AETHER_STRIKE` directory**, and run `npm.cmd install`, `npm.cmd run dev`.
2. Start campaign. Confirm ground-relative eye height, larger original architecture, smaller soldier, smaller/lower arms, and all three enemies visible in sector 1.
3. In **Webcam Calibration**, enable the camera. Look for a green 21-point skeleton **on your right hand**; if the live preview shows the hand but the skeleton is absent, try the *HAND LABEL* toggle. In mirrored video, MediaPipe can call the physical right hand `Left`.
4. Move your right hand horizontally: turn speed should rise, then fall to zero as you stop. If it rotates in the opposite direction, use *Invert horizontal gesture direction* in Settings. Adjust sensitivity / dead zone as needed.
5. Make a closed fist (all four fingers bent): **FIST** and ADS should appear, no bullets. Pinch thumb to index and hold about 0.15s: **PINCH** and automatic fire. Release: firing stops. Two rapid short pinches: reload. Removing hand: fire stops.
6. In combat, confirm camera movement stays floor-relative while moving to cover, and that enemy models are ground-aligned. Confirm up/down aim with locked mouse/trackpad.
7. Run `npm.cmd run build` and check that `dist/mediapipe/` includes local WASM and hand model if those resources were downloaded during setup.
