# «Полсекунды» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Playable music guessing mode matching potenceval, with six snippet lengths, autocomplete, scoring, results and locally imported songs.

**Architecture:** Static ES modules like the existing games. Pure game rules, Web Audio playback, and a small IndexedDB library; no new runtime dependencies. Local files remain in the player's browser. Provide a clearly labeled warm-up of original synthesized arrangements of public-domain melodies so the game works immediately without pretending that streaming integrations exist.

**Tech Stack:** HTML, CSS, JavaScript, Web Audio, IndexedDB, Node.js built-in test runner.

**Spec:** ../specs/2026-10-21-music-quiz-design.md

## Global Constraints

- Snippets: 0.5, 1, 2, 5, 10, 15 seconds; points: 1000, 800, 600, 400, 200, 100.
- Shared-screen cooperative play, no accounts or mandatory networking.
- Preserve shared styles, fonts and navigation; add only music-specific styles.
- Spotify/VK/Yandex are not implemented streaming sources. No secrets or unofficial account-token flows.
- The user's instruction to begin development authorizes execution without an additional plan approval round.

## Review Focus

- A player clicks repeatedly or changes page during audio loading: old sound must never start afterward.
- Broken files and storage quota failures: explain how to recover, preserve other tracks and score.
- Reload midway through a game: validate saved state, restore the same step, never autoplay.
- Sparse genre/era filters: disallow impossible lengths and never repeat tracks within a game.
- Keyboard autocomplete, mobile width, long song names and HTML-like imported filenames.

## Task 1: Rules and catalogue

**Files:** music/game.js, music/catalog.js, music/game.test.mjs.

**Interfaces:** createGame(tracks, options), guess(state, id), skip(state), surrender(state), nextRound(state), replaceBroken(state), restoreGame(saved, tracks); searchTracks(tracks, query), tracksFor(tracks, pack, era), parseFilename(name).

- [x] Write and run failing tests for every score step, failure progression, rejected/repeated answers, neutral replacements, seeded no-repeat shuffle, search normalization and saved-state validation.
- [x] Implement pure state transitions and a small built-in warm-up catalogue with aliases and original synthesized arrangements of old melodies.
- [x] Run new and existing game tests.

## Task 2: Real audio and local library

**Files:** music/audio.js, music/library.js, music/audio.test.mjs.

**Interfaces:** AudioPlayer.load(track), play(seconds), stop(), setVolume(value), inspect(file); loadTracks(), saveTrack(record), removeTrack(id).

- [x] Write a failing scheduling/cancellation test with a minimal Web Audio boundary double; actual sound is also checked in the browser.
- [x] Implement sample-duration playback with AudioBufferSourceNode.start, gain fades and cancellation tokens. Decode local files and generate the warm-up audio in memory.
- [x] Persist imported audio and editable metadata in IndexedDB; surface storage/decode failures.
- [x] Verify playback lengths, replacement during loading and interrupted playback.

## Task 3: Complete interface and integration

**Files:** music/index.html, music/style.css, music/app.js; modify shared/menu.js; music/README.md.

**Design:** Reuse #0e0a1c background, #1a1333 panels, #7c5cff violet, #ff4d6d pink and #ffc94a gold. Onest body and Unbounded display. A playable vinyl record is the focal element; genre selection and controls remain quiet. Desktop has an editorial left-aligned introduction and setup panel; play uses one large central listening area. No new branding or generic dashboard.

- [x] Build setup, labelled warm-up/custom packs, import/edit/delete library, genre and era filters, round screen, autocomplete, reveal and summary.
- [x] Preserve progress and preferences; enable keyboard controls and reduced motion. Replace unavailable tracks without penalties.
- [x] Add the mode to shared navigation and document local preview and real-source limitations.
- [x] Run all game tests, browser-check a complete game, reload, uploads and a narrow viewport, then request a fresh code review and fix material findings.

## Execution notes

- Ruling: Work in the user's existing D:/CLGames checkout; changes are limited to the new mode, its documentation and the menu entry.
- Ruling: Use a genuine playable warm-up plus local audio imports while external playback remains unconfirmed. This provides a working mode now; an automatically populated catalogue of current hits still requires a suitable source.
- Git metadata is read-only in this environment; no automatic commit, branch or push is part of this task.

## Verification record

- 19 checks passed with Node built-in test runner, including existing genie/dice suites.
- Browser verified: full five-round party, keyboard suggestions, wrong and correct answers, 1000-point result, reload/resume, local WAV import, rejected short/broken audio, metadata editing and genre/era filters.
- Browser regression with a delayed library save confirmed that returning to a game is not overwritten by the background operation.
- Responsive UI inspected in a 471px viewport; no horizontal overflow in the checked result view.
- Fresh review reported two async UI findings; both were fixed. No re-review was dispatched.
- Native confirmation automation prevented completion of the optional delete/desktop screenshot check; these are not claimed as verified.
- Public streaming integrations and an automatically populated contemporary-hit catalogue remain outside this first working version.
