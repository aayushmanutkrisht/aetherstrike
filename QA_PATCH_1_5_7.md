# QA — v1.5.7 Player Names & Leaderboard

## Changes
- Main menu name field (2–20 characters), remembered via browser-local storage.
- Campaign launch requires a name; training remains available unranked.
- Finished campaigns (victory and defeat) automatically record a run once.
- Leaderboard modal supports Top 10 personal bests, 150-entry run history, CSV export, and confirmed clear.
- After-action report links to the leaderboard and displays score-saving status.
- No enemy, webcam, weapon, shader, animation, level, or GLB asset changes.

## Verified
- `npm.cmd run test:leaderboard` / `node --experimental-strip-types tests/leaderboard.mjs`: passed in the authoring environment.
- All 17 TypeScript and TSX source files parsed with the TypeScript compiler: 0 syntax errors.
- Project package and original 3D assets remain present.

## Not verified
- `npm install` failed with DNS EAI_AGAIN while fetching from the npm registry here. Consequently the production build and live browser gameplay could not be exercised in this environment.

## Storage caveat
Scores are client-local (`localStorage`), not a shared online competition ranking. Deleting site data removes the log. CSV export is available.
