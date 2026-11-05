# QA PATCH 1.5.3

- Switched runtime enemy asset path from `public/assets/enemy.glb` to `public/assets/enemy(1).glb`.
- Bundled uploaded `enemy(1).glb` into the project without altering the original model file.
- Pushed authored enemy encounter anchors farther downrange.
- Tightened spawn-search cone and increased minimum spawn distance so enemies appear farther from cover positions.
- Slightly reduced runtime enemy scale to improve the impression of distance while preserving visibility.

Verification completed offline only:
- Confirmed `enemy(1).glb` exists in `public/assets/`.
- Confirmed `AssetManager.ts` points to `assets/enemy(1).glb`.
- Confirmed six encounter tables updated.
- Live browser playtest not available in this environment.
