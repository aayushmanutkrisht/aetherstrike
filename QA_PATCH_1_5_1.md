# AETHER STRIKE v1.5.1 — MediaPipe Model Loading Repair

## Reported failure

Webcam feed remains live, but HandLandmarker initialization raises:
`UNKNOWN: Unable to open zip archive; StartGraph failed`.

## Confirmed bug in v1.5 source

The old tracker used `fetch(..., {method:'HEAD'})` and considered an HTTP 200 proof
that `/mediapipe/hand_landmarker.task` existed. Vite's single-page fallback can
respond with HTTP 200 and `index.html` for missing files. MediaPipe then attempts
to unzip the HTML page, generating the opaque archive error.

The old install helper also accepted downloaded content based only on byte size,
which was not sufficient to establish that it contained a valid model archive.

## Changes

1. `src/tracking/ModelBundle.ts` fetches actual model bytes and verifies the
   `.task` ZIP header, end-of-central-directory, and central directory presence.
2. Invalid local assets are ignored and the official MediaPipe hosted model is
   attempted automatically (both use a 16s request timeout).
3. Verified model bytes are passed via `modelAssetBuffer`, avoiding a subsequent
   URL fetch that could receive stale cache/HTML.
4. The install helper now validates any existing model file, deletes an invalid
   cached model, and saves freshly downloaded model bytes only after ZIP checks.
5. Local WASM runtime checks inspect actual binary magic, not only HTTP status.
6. Errors identify local-vs-official failures; live video is preserved.

## What to do

In the extracted project root (`package.json` is there):

```powershell
npm.cmd install
npm.cmd run prepare:vision
npm.cmd run dev
```

If official model download is blocked, manually download:
https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

Save it **exactly** at `public/mediapipe/hand_landmarker.task` and run
`npm.cmd run prepare:vision` again; the script should report a validated cached
model (approximately 7–8 MiB). Only download from an official trusted host.

If deploying: run `npm.cmd run build` locally, then upload the fresh `dist/`
directory to HTTPS hosting. The hand model is included automatically in
`dist/mediapipe/` only when it was cached locally during installation.

## Checks performed in this environment

- PASS: `node --experimental-strip-types tests/model-bundle.mjs` (HTML fallback
  rejected; valid ZIP synthetic fixture accepted; official URL selected).
- PASS: `node --experimental-strip-types tests/gestures.mjs`.
- PASS: `python tests/verify_level_geometry.py`.
- PASS: TypeScript standalone type check of `ModelBundle.ts`.
- PASS: JavaScript syntax check of `tools/prepare-vision.mjs`.
- Original environment, enemy and first-person GLBs unchanged from v1.5.

**Not verified:** `npm install`, full production build, and live webcam in this
container (external npm/model download hosts are inaccessible). Real webcam
performance must be checked in your desktop browser.
