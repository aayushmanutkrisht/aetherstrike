# AETHER STRIKE v1.5.2 — MediaPipe regression repair

## Observed failure

- Camera stream initializes, MediaPipe tracker reports a valid model cannot be found.
- v1.5.1 rejects both local and official files as an 'Invalid .task ZIP bundle'.

## Code-level root cause

A comparison with working v1.4 showed that v1.5.1 added custom ZIP
central-directory validation, then changed HandLandmarker initialization
from `modelAssetPath` to `modelAssetBuffer`. This validator made assumptions
about the exact ZIP directory layout and prevented MediaPipe itself from
parsing the official model. This is a confirmed code regression; whether
other network issues exist on the target machine cannot be determined here.

## Changes

1. Restore `baseOptions.modelAssetPath` used in v1.4.
2. If the optional local model exists and has a plausible binary header, try
   local GPU then local CPU; if either fails, retry official GPU and CPU.
3. If no local model is present, use Google's official URL directly, as v1.4 did.
4. Reject Vite's HTML fallback when checking for a local model but do not
   apply custom ZIP directory/entry checks to official model downloads.
5. Update the prepare script so it does not delete a potentially valid local
   model solely for failing the former ZIP structural check.
6. Preserve the v1.5 scope vignette, ADS lock, first-person weapon framing,
   targeting reticle, six encounters and all original `.glb` models.

## Tests run

- `node --experimental-strip-types tests/model-bundle.mjs`: PASS.
- `node --experimental-strip-types tests/gestures.mjs`: PASS.
- Code audit verifies `modelAssetPath` initialization and GPU/CPU+source fallbacks.
- Full install/build and webcam hardware tests were not available (no network
  connectivity / webcam device in this runtime). Do not treat this release as
  webcam-verified without a local browser test.

## Local check

Open Webcam Calibration; permit access; look for moving green landmarks and
TRACKING. If it does not load, check browser DevTools Network for the official
`.task` URL and `vision_wasm_internal.wasm` status. Use HTTPS on hosting.
