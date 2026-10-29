# Distinct game identities and readable geography clues

User feedback: six warm room photos blend into the room background; identify each game before reading. Preserve the vintage club mood but use six large isolated objects on distinct colored display surfaces. Emerald/brass genie, oxblood/ivory dice, ochre/black vinyl, navy/blue globe, plum/silver cinema, petrol/chrome studio. Quiet the shared background behind the gallery and shorten its hero so the games appear sooner. Keep Onest text and Marck Script titles.

- Generate six transparent object assets in shared/assets/gallery-v2, preserving the existing game scene images.
- Replace gallery image stages and wood frames with colored game-box surfaces; retain all routes and descriptions.
- Verify Romanian Mulțumesc against a dictionary; use upright readable type for foreign phrases.
- Add explicit cardinal direction words to wrong country guesses and explain the approximate center-to-center distance.
- Replace Romania's celebrity clue with singer INNA and a verified Commons photograph.
- Check desktop and 375px gallery/geo, tests in the exact publication snapshot, image alpha and public routes. Publish only these files over f0b900a; preserve unrelated local music and legal drafts.

## Completed verification

- Six 900×900 alpha WebPs generated, visually reviewed and decoded; ~1.13MB total. Runtime markup uses the correct square dimensions.
- Browser gallery at 1366px: figures ~403.7×234.7, images ~403.7×233.9, all loaded. At 375px: figures 326.4×192, images 326.4×191.2; no horizontal overflow. No intrinsic-height problem.
- Geography language clue uses Onest/Arial, upright diacritics. A real wrong guess produced the correct named compass direction and unhid the explanatory note at 375px without overflow.
- Mulțumesc verified via DEX online. Romania now uses INNA with the Commons Global Records portrait and CC BY-SA 4.0 attribution; image URL loads in the browser. No full audit of the other language/celebrity clues was performed.
- Exact publication tree: 103 tests passed, 0 failed; syntax checks passed. Read-only review found no actionable regression.
- Published commit `70d599a957a1272e45e065a0fa57f086203f256d`, local saved branch `codex/gallery-identities-20261025`. GitHub Pages run `40172704441`: success. All six new public gallery images loaded; deployed geo wrong-answer direction text verified.
- Public gallery screenshot saved as `gallery-identities.png` in the task visualization directory. Temporary viewport emulation reset. Unrelated current-checkout edits preserved.
