# QA PATCH 1.5.5

- Replaced the cartoony procedural 2D enemy drawing with silhouette sprite assets derived from the user-provided reference sheet.
- Added 8 silhouette variants under `public/assets/enemy_silhouettes/`.
- Visual treatment preserved: red outline + translucent red fill on transparent background.
- Enemy AI, health bars, hit detection, suppression, and farther placements remain intact.

Offline verification only:
- Confirmed silhouette assets present and referenced by `EnemyManager.ts`.
- Live browser playtest not available in this environment.
