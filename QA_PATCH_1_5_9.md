# QA Patch 1.5.9 — Full preload + sector activation only

**Based strictly on the v1.5.7 leaderboard build**, not the v1.5.8 background preparation design.

## Root cause found

The v1.5.7 arrival transition synchronously called `EnemyManager.spawn(wave)`. That method cleared/reconstructed enemies and could evaluate as many as 80 terrain-placement candidates for each soldier. Each candidate could run repeated source-mesh raycasts for floor and visibility checks, which can block the main browser thread. Enemy animation textures were also loaded lazily on first use, producing possible GPU uploads during gameplay.

## Changes made

1. `EnemyManager.prepareAll(renderer, onProgress)` is awaited during `GameEngine.load()` before the Start button enables.
2. All **48 existing** PNG frames are loaded/decoded and GPU-initialized on the loading screen.
3. For every one of the six sectors, spawn positions are resolved against the **same original environment**. If an authored placement is valid it is used immediately; otherwise the existing spiral fallback search is retained. The work yields to the UI/render loop while loading.
4. All enemy sprite instances are created once and retained in separate `THREE.Group` objects with `visible=false` at rest.
5. `activate(wave)` changes only the current group visibility and active enemy array; `deactivate()` hides the group and removes all enemies from the active combat array. **Neither method creates enemies or performs terrain raycasts.**
6. `shot`, `acquire`, `suppressNear`, `update` and `alert` operate only on the active sector; future sprites have no AI or combat interactions.
7. `resetCampaign()` cheaply resets health, states, positions, animation frames and visuals for a replay rather than rebuilding scenes.
8. The sector-clear delay decreases from 2.6 seconds to 1.25 seconds; resupply remains unchanged: `reserve = min(900, reserve + 70)` and `health = min(100, health + max(5, 16 - wave*2))`.
9. A cancellation guard avoids finishing load after the React component has been disposed.
10. The original v1.5.7 scoreboard and input systems were not changed except for the build label.

## Intended runtime behavior

- Opening the game: menu displays `ENEMY SPRITES ...` then `PREPARING SECTOR ...`; Start is disabled until all sectors are ready.
- Start Campaign: sector 1 is activated immediately; other sectors remain hidden and non-interactive.
- On sector clear: wait ~1.25s, lower weapon, hide existing enemies, walk normally to cover.
- On arrival: show the new, already prepared enemies with **no procedural spawn work**.
- On mission restart: reuse the same enemy objects, now with fresh HP and idle frames.

## Offline checks executed

- `node tests/preload-architecture.mjs` — PASSED. Verifies preloading call before ready, GPU upload, hidden groups, isolation of active enemies, no synchronous `.spawn` during sector transitions, resupply formulas, reset, six authored encounter groups and 48 expected PNG files.
- `node --experimental-strip-types tests/gestures.mjs` — PASSED.
- `node --experimental-strip-types tests/leaderboard.mjs` — PASSED.
- `node --experimental-strip-types tests/model-bundle.mjs` — PASSED.
- `python tests/verify_enemy_animations.py` — PASSED.
- `python tests/verify_level_geometry.py` — PASSED (28 authored anchors and six cover points have floor support).
- TypeScript `transpileModule` syntax validation — PASSED for 16 source files.

## Limits and what to verify on your PC

- `npm install` could not complete in this container: npm registry DNS returned `EAI_AGAIN`. Therefore **the full TypeScript production build and live WebGL/Webcam playtest remain unverified**.
- On first load the menu should stay visible and responsive but the Start button deliberately waits for all enemies/frames to be ready. This is a one-time preparation delay per page load, not a gameplay stall.
- The authored placement still uses the v1.5.7 floor and line-of-sight checks. If a candidate fails all checks it is skipped with a console warning; actual spawned counts could therefore be less than the intended 28. Check the console count at startup.
- If the camera *still* stutters between sectors after preloading, the remaining source may be collision raycasts during player walking or general rendering performance rather than enemy spawning. A browser performance trace is required to identify that definitively.

**Manual acceptance test:** clear sector 1, note the HUD health increase occurs after arriving at cover 2, verify that sector 2 enemies only appear at arrival, then repeat through all sectors. Restart and verify all enemies respawn with full health and the leaderboard remains functional.
