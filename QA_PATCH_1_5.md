# AETHER STRIKE v1.5 — Patch report

## Requested issues and fixes

1. **Small, distant hands / weapon:** Original GLB preserved; visual scale 0.39 → 0.53 (about 36% larger in model space), hip root moved to (0.15, -0.34, -0.92), ADS aligned to the actual glTF scope centre. The new weapon-size slider is available in Settings. The view still renders all the original geometry; arm cut-off ends should fall below the bottom edge of the camera, subject to real-window testing. The muzzle flash location now follows weapon size.
2. **Enemy health bars:** width 38 → 58 CSS pixels, height 2 → 5, brighter labels and stronger outlines.
3. **Second floating +:** the browser's native `cursor: crosshair` was removed from the gameplay canvas. The established centre crosshair and hostile-lock highlight are unchanged.
4. **Scope drops when switching fist → pinch:** gesture ADS latch now survives firing, and exits on four consecutive explicit open-hand frames. Lost hand resets latch and stops fire. All original double-pinch reload logic is retained.
5. **Scope glass:** new circular translucent glass/rim/vignette layer in ADS. It is intentionally reticle-free so the existing aim pointer is the sole targeting marker. The 38° ADS FOV zoom remains as in v1.4.

## Checks

- `node --experimental-strip-types tests/gestures.mjs` — PASS (fist-to-pinch ADS retention, open-hand release, loss reset, double-pinch reload, vertical aim, no drift).
- Original 3D model files retained exactly from the supplied v1.4 archive.
- Browser/WebGL live preview and webcam end-to-end validation **not available** in the build environment.
- `npm install` did not complete here because registry access stalled, so `npm run build` is **not verified** here.

## If weapon occludes the view

Open Settings, reduce Weapon / hands size toward 85% or lower the framing height. Do not modify the original assets.
