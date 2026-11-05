# AETHER STRIKE — Stage-by-stage Development Plan and Completion Status

This plan prioritizes a **single complete mission using the three supplied models**. It does not claim commercial-ready polish or browser verification without runtime tests.

| Stage | Goal | Current source status | Acceptance still needed |
| --- | --- | --- | --- |
| **1. Asset inspection** | Inspect the three exact GLBs, identify rigs, animations, orientation, size and textures | **Done.** `ASSET_REPORT.md`, `asset_analysis.json`, SHA-256 checks | Confirm visual appearance in WebGL |
| **2. Project foundation** | Vite/React/TS, Three.js scene, centralized GLTFLoader and original assets | **Implemented** | `npm install`, production build, browser smoke test |
| **3. First-person weapon** | Proper camera alignment, sway, ADS, 80-round LMG tuning, recoil, reload, flash, tracers | **Implemented** with supplied first-person model | Review animation composition, muzzle point and centering visually |
| **4. Webcam input** | MediaPipe 21-landmark right-hand tracking, relative horizontal turn, fist, pinch, double pinch | **Implemented; synthetic gesture tests passed** | Test real webcam, handedness, false positives and tracking-loss latency |
| **5. Enemy combat** | Original soldier/idle clip, variants, reaction, cover, shooting, LOS, suppression | **Implemented** | Verify pose, pathfinding, hit feedback and fairness in live browser |
| **6. Level gameplay** | Surface-grounded cover stations, walkable enemy positions, autonomous transit, 3 encounters | **Implemented; offline route/LOS tests passed** | Check no clipping, stalls, floating, unreachable targets in actual browser |
| **7. UI and polish** | Campaign, training, settings, calibrator, HUD, audio, impacts, win/lose | **Implemented** | Test every button and sound, tune art direction and controls |
| **8. QA and optimization** | Build, restart, input safety, enemy interaction, graphical settings, 60 FPS target | **Partial.** Syntax and gesture/mesh offline checks passed | Full build unavailable here (npm registry DNS failure); live browser/webcam/FPS validation pending |

## Architectural notes

- **No downloaded replacement models:** `public/assets` contains exact copies of the three user-provided GLBs. All clones are of the original soldier, and procedural shapes are limited to short-lived visual effects and invisible collision raycasts.
- **Stable modules:** `AssetManager` caches GLTF promises. `GameEngine` owns the frame loop and owns/destroys other engine managers. `Environment` owns collision/floor tests. `WeaponController` owns finite-ammo timing independent of webcam frame rate. `EnemyManager` owns AI and the verified idle clip. `HandTracker` owns webcam and MediaPipe lifecycle, while `GestureDetector` is independently testable.
- **Temporal gesture safety:** prolonged pinch is required for fire, deliberately short double pinch for reload, fist cannot trigger either; tracking loss resets gesture latch and stops firing immediately.
- **Runtime visuals:** Actual geometry remains original; invisible double-sided collision meshes share original geometry. The viewmodel is rendered separately to reduce weapon clipping. Rendering quality presets control pixel ratio rather than swapping materials.
- **Deployment:** source is ready for dependency installation on a connected machine; claims of 60 FPS and polished browser play should only be made after manual and automated desktop validation.


## Update v1.4 — Six-sector mission and 2D webcam aiming
Vertical palm movement now drives camera pitch; weapon framing corrected and adjustable; six cover stations and escalating squads use only the original map/soldier/gun. See QA_PATCH_1_4.md for changes and remaining browser-test requirements.
