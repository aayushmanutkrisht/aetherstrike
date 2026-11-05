# AETHER STRIKE — Patch 1.1 QA report

## Player-reported issues addressed in code

| Issue | Corrective change | Verification in this environment |
| --- | --- | --- |
| Enemies do not appear | Ground-align actual skinned mesh using measured rendered bounds; more robust front-facing visible floor search; enemy identification tags use projected positions of original models | Geometry/static inspection only; browser visibility remains unverified |
| Aim pointer does not react | Center-ray acquire() tests live soldier hitbox and level occlusion; red glow UI | Code-level check only |
| Mouse looks sideways but not vertically | Added pitch from `movementY`, clamped to ±0.7 radians | Code-level check only |
| Camera too high | Camera eye height changed from 1.65 to 1.39 units above original mesh ground | Code-level check only |
| Flying transitions | Ground-height-nearest selection, camera walking yaw, speed ramp, head bob, and authored floor-projected route | Original level path survey passed; browser visuals unverified |
| Scope does not magnify | ADS narrows world camera FOV from 76° to 38°; separate weapon camera stays at 76° | Code-level check only |
| Undefined `getUserMedia` on public link | Check `isSecureContext` and API availability before camera request; clear HTTPS error; no false claim that HTTP hosts support webcams | Code-level check only |
| Camera preview opens then closes | Separation of video stream from async MediaPipe initialization; AI failures keep preview alive; CPU fallback, local runtime/model staging | Code-level check only; live camera unavailable |

## Checks executed

- Syntax transpilation: 13 TypeScript/TSX source modules, **0 syntax diagnostics**. This does not replace a full `tsc` typecheck.
- Gesture smoke test: **pass** (fist ADS, held pinch fire, double-pinch reload, lost-hand stop, relative movement).
- Level mesh survey: **pass** (three authored cover points, twelve route segments and nine position candidates on the original environment).
- Asset integrity: all three supplied GLB source files retained without modification (see source hash report).
- `npm install`: **not completed** because the development container cannot resolve npm registry hosts.
- `npm run build`: **not run** (dependencies unavailable).
- Browser/WebGL/wecam QA: **not run** (no dev-server dependencies or physical webcam).
- Local MediaPipe packaging script: executed and handled missing dependencies/model-network gracefully. After an actual `npm install` it will populate `public/mediapipe`.

## Manual acceptance on desktop

1. Run `npm install`, verify `public/mediapipe/` contains WASM and ideally the hand model.
2. Run `npm run build` and `npm run dev`; inspect browser console for errors.
3. In sector one, confirm *three actual soldier meshes* stand on original floor and are visible at eye level. Aim at one: reticle red when unobstructed.
4. Lock mouse on canvas, move trackpad/mouse vertically: look up/down. Right click to ADS: observe true field-of-view zoom, not a sniper overlay.
5. Clear a sector: walk at human speed on the original mesh with weapon lowered, then enter next covered position without an airborne camera.
6. On `http://localhost:5173`, enable webcam: ensure preview stays on while tracking initializes. Test fist, held pinch, double pinch, lost-hand safety.
7. On public hosting, use an HTTPS address; `http://` external URL will not work. Grant camera permission in browser settings.
8. If preview works but vision says VISION ERROR, inspect model and WASM filenames in `dist/mediapipe/`; restart after resolving missing MediaPipe files.
