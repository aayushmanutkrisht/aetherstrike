# AETHER STRIKE v1.5.9 — Preloaded Encounters (Based on v1.5.7)

**Base:** This version starts from v1.5.7, not the slower v1.5.8 background-preparation experiment. It keeps the v1.5.7 player names and leaderboard, 48-frame red enemy animations, webcam gestures, weapon, scope, effects and six-sector campaign.

### What's different

- On the **main-menu loading screen**, the game loads all 48 enemy PNG frames and uploads them to the GPU, resolves all enemy floor positions against the original environment, and creates all six encounter groups. This is intentionally done **before** the Start Campaign/Training buttons are enabled. A progress message reports the current animation or sector count.
- Future-sector enemy groups are **invisible and completely inactive**: they cannot move, attack, be hit, be suppressed or appear as HUD targets until the player reaches their sector.
- During cover-to-cover walking, **all enemy groups are inactive**. On arrival, only the next prepared group is enabled. No spawn search, texture load or new sprite creation is performed during transitions.
- Replay resets existing enemies instead of reconstructing them. Enemy positions, HP, particles and animations reset for a new run, while the prior assets remain cached.
- The intentional post-clear pause is shortened from 2.6 to **1.25 seconds**. Health and reserve-ammunition regeneration formulas are unchanged.

**Expected tradeoff:** The initial menu may take longer to become ready, particularly on low-power machines. In exchange, there should be much less work and fewer rendering stalls between sectors. Actual FPS and transition smoothness must still be verified in a real desktop browser.

### Validate this patch

```powershell
npm.cmd run test:preload
npm.cmd run test:leaderboard
npm.cmd test
npm.cmd run build
```

The new test checks the preload/visibility/activation code paths and bundled animation files. It is a **source-level regression check**, not a browser performance benchmark. See `QA_PATCH_1_5_9.md` for details.

---

# AETHER STRIKE v1.5.7 — Player Names & Leaderboard

Based on the existing v1.5.6 animated-red-enemy build. The camera, weapon, gesture tracking, six-sector campaign, sprite animations and effects are unchanged.

## Start the game

Open the extracted folder containing `package.json` in VS Code and run:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the localhost address printed in the terminal (typically `http://localhost:5173/`). For production builds run `npm.cmd run build`. A webcam needs localhost or HTTPS.

## Player name

Enter a name with at least 2 characters (maximum 20) on the main menu before clicking **Start Campaign**. The game remembers your name in this browser's local storage. Changing it allows another player to record scores on the same computer. Training can be started without a name.

## Leaderboard / Run Log

- **Top 10:** each name's personal best score, sorted highest first.
- **Run History:** the 150 latest attempts (including victories and defeats), displaying score, accuracy, reached sector, result and date.
- **After Action Report:** logs your campaign result automatically when the mission is won or lost, once per run. Training runs are deliberately unranked.
- **Export CSV:** downloads a spreadsheet-compatible archive of your locally saved run history.
- **Clear History:** requires a second explicit confirmation.

All score data is stored **only in this browser and origin** using `localStorage`. It is not an internet/global leaderboard, does not synchronize between devices, and is not uploaded to any server. Clearing browser site data also clears scores, so export your CSV if you want a backup.

## Tests

```powershell
npm.cmd run test:leaderboard
npm.cmd run build
```

Leaderboard unit tests cover names, ranking, persistence, score history, invalid data and clearing. Browser camera + live gameplay are still to be tested on your PC.

---

# AETHER STRIKE v1.5.2 — Hand Tracking Regression Fix + Scope/ADS

A cover-to-cover first-person combat game using **only the supplied** `environment.glb`, `enemy(1).glb`, and `first person view.glb`. There are no replacement characters, weapons, or level models. The level is the original environment, now divided into **six sequential combat sectors** (28 intended soldier placements across the six waves). This is a longer mission on the same map, **not six different 3D maps**.

## Run (Windows PowerShell, VS Code)

1. Unzip into a folder, for example `A:\Downloads\AETHER_STRIKE_v1_5_SCOPE_ADS_HANDS`.
2. Open the extracted folder **containing `package.json`** in VS Code (the ZIP has `package.json` at its root).
3. Open a new PowerShell terminal in that folder and run:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the Vite localhost URL, usually `http://localhost:5173`. For production:

```powershell
npm.cmd run build
```

Use HTTPS for a hosted webcam-enabled build. The webcam works on localhost or HTTPS; it cannot be used on an insecure public HTTP URL. The installation script attempts to cache MediaPipe's model and WASM files locally; it falls back to official hosted files if this download is unavailable.

If npm reports `ENOENT package.json`, open the right folder. If it reports `ETARGET`, inspect the resolved package version; the requested MediaPipe version in this package is `0.10.35`.

## Webcam controls — hold your RIGHT hand within the frame

| Action | Gesture | Fallback input |
| --- | --- | --- |
| Look left/right | Move right palm left/right | Pointer-locked mouse/trackpad X; A/D |
| **Look up/down (new)** | **Move right palm up/down** | Pointer-locked mouse/trackpad Y |
| Aim (ADS) | Make a fist to **latch scope**; open your hand to release it | Right mouse or Shift |
| Shoot automatically | Hold thumb-index pinch; **scope stays on after a fist** | Left mouse or Space |
| Reload | Two short distinct pinches | R |
| Advance | Automatically after clearing the sector | Automatic |
| Pause | UI button | Escape |

The aiming detector uses the wrist and palm knuckles instead of fingertips to prevent aim jumps while switching gestures. Gesture control is relative: move your palm, then hold still to stop rotation. A lost hand immediately stops webcam firing and steering. Each gesture can be viewed in **Webcam Calibration**; LEFT/RIGHT and UP/DOWN rates are shown separately. Camera sensitivity and movement dead zone are adjustable in Settings. Use the model handedness toggle if your right hand isn't recognized.

## Weapon framing — fixed in v1.4

The first-person weapon and arm model was previously placed almost entirely below the bottom edge of the dedicated weapon camera. Its hip-fire position has been moved from `(0.10, -0.72, -0.58)` to `(0.14, -0.29, -0.85)`; ADS framing has likewise been raised. The model still uses its original mesh, materials, textures, orientation fix, and scale `0.39`. A new **Weapon framing height** slider in Settings gives an additional `-0.22` to `+0.26` adjustment without editing the model.

## Campaign — longer and progressively harder

| Sector | Location on the original map | Intended enemies |
| --- | --- | ---: |
| 1 | Courtyard entry | 3 |
| 2 | North alley | 4 |
| 3 | Mid courtyard | 4 |
| 4 | Central junction | 5 |
| 5 | Southern approach | 6 |
| 6 | Final defense | 6 |

The current game displays animated 2D tactical soldier silhouette PNGs rather than the old rigged 3D soldier. Later squads gain health, inflict more damage, shoot more often, and have a higher hit chance. Armor, heavy gunners, and priority targets become more common. Brief ammo/health resupply occurs at the next cover. Camera transitions use walkable waypoints projected onto the original environment mesh rather than free-flying or teleporting.

## Verification and known limits

- **Pass:** standalone JavaScript/TypeScript gesture tests, including upward and downward palm movement, disarming on lost tracking, fist ADS, held-pinch fire, deliberate double-pinch reload, and horizontal movement isolation.
- **Pass:** offline checks found existing original-mesh floor triangles beneath all six cover stations and 28 authored enemy anchors. An additional offline line-of-sight survey found all 28 anchors potentially visible from their associated stations. Runtime placement can still shift slightly to avoid walls/overlaps.
- **Pass:** all three GLB files in the package are identical to the user-provided originals (SHA-256 verified during packaging).
- **Not verified here:** `npm install`, production `npm run build`, live browser rendering, and actual webcam/gesture accuracy, because the test container could not resolve npm registry DNS and has no webcam/browser graphics session. **A browser playtest is still required before treating this as a bug-free release.**
- Source soldier has an idle animation only, and the weapon contains one combined clip, so locomotion, shooting and reloading use the previous procedural implementation.
- There is one environment map and a six-sector mission, not six distinct map models.

To run tests in your local project:

```powershell
npm.cmd test
npm.cmd run build
```

Optional Python geometry survey (only if `trimesh` and `numpy` are installed):

```powershell
python tests/verify_level_geometry.py
```

Refer to `QA_PATCH_1_4.md` for exact code changes and acceptance tests, and to `ASSET_REPORT.md` for source asset details.

## Changes in v1.5

- Original weapon/hands GLB has been enlarged from scale 0.39 to 0.53 and positioned nearer the camera; arm cut-off ends are placed below the screen while the physical optic stays aligned with the central reticle during ADS. A **Weapon / hands size** slider lets you fine-tune from 85% to 125% of the new base size. The framing-height slider remains available.
- One accurate enemy-lock crosshair remains at screen center. The separate browser pointer that appeared as a floating + over the canvas is hidden during gameplay. The red target-lock glow was not removed.
- ADS now latches with a fist and persists during a pinch/fire sequence. A sustained open hand exits ADS; losing hand tracking resets both ADS and fire for safety. The existing world-camera zoom is unchanged.
- ADS adds a circular, transparent scope glass with soft lens reflections, a scope rim and a peripheral dark vignette. No second scope reticle was added.
- Enemy health indicators are slightly larger and brighter.

**Suggested check:** Enter Webcam Calibration. Make a fist, then pinch without opening your full hand for four consecutive tracking frames. In-game, the scoped lens and target-lock reticle should remain visible during automatic fire. Open your hand deliberately to leave ADS. If the weapon feels too big on your monitor, open Settings and lower Weapon / hands size.

The browser and live webcam have not been verified in this environment; the included tests verify simulated gesture transitions, not your actual webcam conditions.

## v1.5.2 — Fix to the v1.5.1 hand-model regression

v1.5.1 introduced custom .task ZIP-central-directory validation and sent the
whole model as `modelAssetBuffer`. It could reject a legitimate official model
before MediaPipe was allowed to parse it. v1.5.2 restores `modelAssetPath`,
the **same browser API used by the working v1.4 build**, and tries both GPU
and CPU. Missing local files no longer block the official URL. If a local
model is present but MediaPipe cannot open it, the loader retries the official
model. The supplied models, scope, ADS lock, weapon, and six sectors are unchanged.

### Running in PowerShell

Extract the ZIP, open the folder containing `package.json`, and run:

```powershell
npm.cmd install
npm.cmd run dev
```

Check Webcam Calibration. If tracking still fails, run:

```powershell
npm.cmd run prepare:vision
npm.cmd run dev
```

If the local model isn't available through your network, manually download
[Google's official hand_landmarker.task](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task)
and save it at `public/mediapipe/hand_landmarker.task` in the project root.
Restart the dev server afterwards. Local and official model files must be
real binary `.task` files, not browser-saved HTML pages. A successful webcam
preview alone does not mean MediaPipe initialized; the green 21-point landmark
skeleton and TRACKING status confirm that the detector is running.

### Verification limitations

Offline tests cover missing/HTML model responses, local binary candidate
selection, fallback path selection and the gesture state machine. Live
MediaPipe initialization and browser webcam behavior cannot be tested in this
environment; they still require your local playtest.


## v1.5.4 note

This version replaces visible enemy rendering with stylized 2D hostile sprites (transparent red silhouette billboards with subtle animation) instead of the problematic 3D enemy mesh. Enemy AI, hit detection, combat states, and health bars remain active.


## v1.5.5 note

This version upgrades the 2D enemies to proper soldier silhouette sprites based on the supplied visual reference sheet.

## v1.5.6 — Smaller animated red enemy silhouettes

This version replaces the earlier oversized, floating silhouettes with 0.83-world-unit-high 2D enemies. Their 48 PNG animation frames live in `public/assets/enemy_animations/` and cover standing, actual walking with stride changes, and shooting with recoil. Enemies keep their feet aligned to the supplied map floor, emit a short muzzle flash when firing, and burst into bright red particles when defeated (rather than slowly fading). Combat logic and webcam controls are unchanged.

To check the generated PNG assets without a browser, run `python tests/verify_enemy_animations.py`. The game still starts with `npm.cmd install` and `npm.cmd run dev` from the directory containing `package.json`.
