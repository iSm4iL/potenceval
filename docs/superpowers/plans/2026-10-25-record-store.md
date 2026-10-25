# Record store implementation plan

**Goal:** Bring the approved record-store concept into the existing music game, including a paginated wooden crate, generated sleeve art, coded neon sign, and layered animated turntable.

**Architecture:** Keep `app.js`, catalog, audio, saved settings and game rules. Replace the cabinet presentation entry point with a small record-store decorator that moves existing controls without replacing their handlers. Static generated art is local; all labels, controls, lighting and motion remain HTML/CSS/JS.

**Tech stack:** Existing buildless HTML, CSS, browser ES modules, Node test runner. No new runtime dependencies.

**Approved design:** User approved the record-store concept and the layer/animation description in this chat and asked to begin. Palette: graphite #0d0c14, walnut #693d25, amber #f2b85b, coral #ff7466, paper #f1dfbc. Onest for controls, Cyrillic handwritten display lettering for the neon and sleeves. A four-by-two crate occupies the left, turntable and settings the right. The game uses a near-overhead turntable with a paper answer panel.

## Constraints and review focus

- Preserve existing uncommitted files and unrelated games.
- All ten existing collections remain reachable, including custom artist collections.
- Page arrows are always visible on the wooden lip, correctly disabled at boundaries. Selection survives pagination and catalog rerenders.
- Generated scene assets share warm lighting and use transparent backgrounds where needed. Hidden songs never expose their artwork on the central label.
- Reuse all answer, audio error/retry/replacement, resume and results controls. Playback motion follows actual audio and respects reduced motion.
- At 390px the layout has no horizontal overflow; keyboard focus remains visible after navigation and rerenders.

## Tasks

- [x] 1. Generate background, wood, turntable body, tonearm and ten individual sleeve illustrations; persist prompts and final assets in `music/assets/record-store/`.
- [x] 2. Write and run failing behavior tests for page bounds, selection retention and collection artwork fallback. Implement the small pure model in `music/record-store-model.js` and run its tests.
- [x] 3. Build `music/record-store.js` and `music/record-store.css`, connect them in `music/index.html`, and document the new presentation in `music/README.md`.
- [x] 4. Run the music suite, JS syntax checks and browser QA on desktop/mobile. Exercise both shelf pages, collection selection, settings, real round/reveal and audio failure paths. Review and fix observed problems, save screenshots and open the result for the user.

No deployment or catalog regeneration is required for this local implementation.

## Verification

- `node --test --test-isolation=none music/*.test.mjs genie/game.test.mjs dice/game.test.mjs`: 83 passed, 0 failed. Audio error/retry/cancellation paths are covered by the existing unit suite; a live upstream failure was not forced in browser QA.
- JS syntax checks: `record-store.js`, `record-store-model.js`, and `app.js` passed. All 14 WebP images decode, all 14 generator prompts are saved. Original PNG assets remain under `output/imagegen/record-store-assets-2026-10-25/`.
- Browser QA: 1440×900 desktop and 390×844 mobile, all images loaded; no mobile horizontal overflow. Both shelf pages measured 612.6875px high at the desktop breakpoint. A mode change on page two kept the selected record and page.
- Real Deezer preview played automatically after starting a game. Search, a wrong answer, attempt history, score reduction, surrender/reveal, and resume after selecting a different setup collection were exercised. Wrong-answer rerender retained `#answerInput` focus. The live answer-score label and turntable collection label were checked.
- Desktop round with open suggestions and attempt history: document height 900px at a 900px viewport; the answer panel scrolls when necessary. Mobile uses the natural vertical layout.
- Independent read-only code review identified sleeve clipping, missing current-score display, answer focus loss and setup/resume lifecycle issues; all were corrected and exercised or inspected after the fix.
- Screenshots: `.superpowers/record-store-home-desktop.png`, `.superpowers/record-store-game-desktop.png`, `.superpowers/record-store-home-mobile.png`.
- Local preview: `http://127.0.0.1:4173/music/`. No external deployment or git commit was performed.
