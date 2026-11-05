# QA PATCH 1.5.4

- Replaced visible enemy rendering with stylized 2D billboard sprites.
- Visual style: red outline, translucent red fill, transparent background.
- Added subtle animation: idle bob, alert aura, hit flash, fade on defeat.
- Preserved combat logic: hit detection, AI, suppression, and health bars.
- Kept farther enemy placements from v1.5.3.

Offline checks only:
- Type-level import compatibility visually reviewed.
- EnemyManager API preserved for GameEngine.
- Live browser playtest not available in this environment.
