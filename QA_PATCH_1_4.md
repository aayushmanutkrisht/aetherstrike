# AETHER STRIKE v1.4 — Camera, vertical gesture aiming, six-sector mission

## Exact changes

1. `src/tracking/GestureDetector.ts` exposes `tilt` (radians/second). Vertical movement uses the Y component of wrist + four knuckle positions, with upward movement positive. Small movements are suppressed by the configurable per-frame dead zone. Both horizontal and vertical rates are smoothed and clamped. On lost tracking, both rates reset to zero; fist and pinch arbitration remains unchanged.
2. `src/engine/types.ts`, `src/ui/App.tsx` and `src/engine/GameEngine.ts` forward vertical aiming from MediaPipe to the world camera. Mouse/trackpad vertical aiming remains supported. Camera pitch remains limited to -0.70..+0.68 radians; horizontal rotation remains limited to -1.32..+1.32 radians. Existing autonomous cover movement temporarily controls heading/pitch while walking.
3. `src/engine/WeaponController.ts` raises and centers the supplied original FPV hands/weapon in the dedicated viewmodel camera. Model scale and original GLB are **unchanged**. Hip position changed to `(0.14,-0.29,-0.85)` and ADS target to `(-0.035,-0.19,-0.82)`; weapon view Y may be offset from Settings. Offline vertex projection suggests essentially all model vertices are in frame at a 16:10 aspect ratio, but correct framing is not independently confirmed by a live browser screenshot.
4. `src/engine/Environment.ts` subdivides the existing corridor's surveyed route into six cover locations. `src/engine/LevelLayout.ts` specifies six encounter waves with 3/4/4/5/6/6 intended soldier placements (28 total), all using the supplied environment and soldier models.
5. `src/engine/EnemyManager.ts` scales enemy HP, attack damage, attack frequency, movement speed and accuracy by sector index. A small health/munition resupply between stages helps make the longer mission winnable.
6. UI shows 6-sector campaign progression, adds vertical aim rate on calibration screen and includes a weapon framing height slider.
7. ZIP archive has `package.json` at the top level, avoiding the extra nested project directory seen in prior packages.

## Offline checks completed

- `npm test`: PASS — two-axis palm steering, fist ADS, held pinch, double-pinch reloading, lost-hand action cutoff and neutral-steering behavior.
- `python tests/verify_level_geometry.py`: PASS — six cover points and all 28 authored enemy anchors have floor polygon support in the exact supplied GLB.
- Manual independent offline ray/triangle survey: all 28 authored anchor positions have unobstructed straight sightlines to their associated cover positions with a standing soldier-height aim point; dynamic spawn safety/collisions still require playtest.
- TypeScript/TSX syntactic transpilation: PASS for source files (does NOT substitute for a full TypeScript typecheck or Vite production build).
- Original GLB byte identity: SHA-256 checked against uploaded assets.

## Not run / still needs browser validation

- `npm install` failed in the authoring environment with npm registry `EAI_AGAIN` due to DNS/network restrictions.
- Consequently **cannot certify `npm run build`** or test Three.js WebGL rendering, webcam tracking/permission, input hand orientation, frame pacing, navigation, GPU rendering, exact first-person mesh framing, or later-wave collision/spawn behavior.

## Recommended user acceptance test

1. In Webcam Calibration, ensure the 21 hand landmarks follow your right hand; move up and down and confirm `LOOK UP / DOWN` changes sign and settles near 0 when the palm stops.
2. Start mission: hip-view gun and arms should be visible without obscuring the crosshair. Adjust Settings → Weapon framing height if needed.
3. Test ADS/fist, pinch/fire, double-pinch/reload; remove your hand from view during shooting and confirm shooting stops.
4. Verify 3/4/4/5/6/6 soldier placement counts when each wave starts (development console logs actual counts).
5. Confirm all six sectors are reachable by automatic cover walking; verify sector six triggers mission victory and restart resets the campaign.
6. Run `npm.cmd run build` and report compiler errors, if any.
