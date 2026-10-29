# Game club visual refresh

**Goal:** Apply the approved warm record-store visual language across the game collection and publish the existing movie game, «До титров».

**Architecture:** Preserve each game's data, rules, search, audio and lobby logic. Add a scoped `shared/club.css` material/typography/navigation layer and small page-specific styles. New generated WebP scene illustrations live in `shared/assets/club/`. Existing music presentation remains intact. No framework or new runtime dependency.

**Design:** Near-black walnut #15100c, amber #edb965, parchment #ead7b5, ink #443324, oxblood #873e34, muted green #344a3b. Onest for body, Marck Script for physical signs, Unbounded only for score/code emphasis. Real wood, brass, paper and soft practical lighting. Text and controls stay code-native. Images are decorative, never contain answers or essential text. Responsive from 375px; visible keyboard focus; reduced motion.

- [x] Generate seven lounge/game scene assets; inspect and optimize to WebP.
- [x] Shared club styling, gallery home and all-game navigation.
- [x] Genie and dice home/lobby/game/rules visual treatment without gameplay changes.
- [x] Movie selection and guessing/reveal screens in a cinema theme, preserving clues and catalogue.
- [x] Detective page and beats workshop follow the common material language.
- [x] Run meaningful tests and browser smoke checks for each page, including a dice move, movie clue/answer/reveal and mobile layouts. Review integration.
- [x] Publish exact source/assets needed by all listed pages to existing GitHub Pages, retaining unrelated drafts. Verify deployment and public movie URL.

## Ownership

Root: shared theme, gallery/menu, geo, rap, browser verification and publication.
Scene worker: generated images and provenance manifest only.
Genie/dice worker: only genie/ and dice/ presentation files.
Cinema worker: only screen/ presentation files and optional page-local decorator.

## Rulings

- User already chose the music design as the reference and explicitly authorized a site-wide implementation/publication; execute without an additional design approval round.
- Work in the existing checkout so untracked movie/detective drafts are preserved and can be published. Use selective Git staging; do not remove or reset unrelated files.
- «Биты» is an existing audio workshop, not a finished multiplayer game. Keep its real capabilities clear.
- Real movie imagery/catalogue stays unchanged; generated decoration must not replace the guessing clues.
- Concurrent consent, legal/server and music logic drafts are outside this refresh. Publication uses the previous published music source plus only the new shared navigation/theme links; local drafts remain intact.

## Verification and publication

- Published commit: `f0b900abdd6ae66334baf789720cade5caf5980e`, parent `1f57c2abd912a27262ff10d6510dc7f389125d0b`. Saved locally as `codex/club-restyle-20261025` without changing the current checkout or its unrelated work.
- GitHub Pages run `40169468309`: completed / success. Public gallery and all six game routes load; all six gallery WebP images load.
- Exact exported publication tree: 103 tests passed, 0 failed. Syntax checks passed for the changed modules. A read-only review replayed the movie overspending case after the fix and found no remaining blocker.
- Browser: dice lobby, bot turn and own move; genie lobby and power draw; cinema paid actor clue and correct answer (+90) including the deployed version; geo language clue and correct answer (+925); five generated beats with playable audio and WAV links.
- All public game home pages and cinema round checked at 375px without horizontal overflow; genie power card and geo board also inspected on a narrow screen. Desktop public gallery/cinema screenshots saved in the task visualization directory.
- Fixed pre-existing movie clue overspending and round-choice retention, plus hidden-tab dice demo zero-delay scheduling. No full physical-device multiplayer replay performed for this visual refresh.
