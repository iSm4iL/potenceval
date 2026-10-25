# Music friend lobbies

Reuse `shared/net.js` and the existing music player/search. Keep solo play and its saved game intact.

1. Add a pure host-authoritative multiplayer reducer and tests. One shared queue, independent snippet lengths/attempts, readiness before each round, rank multipliers 1.5 / 1.25 / 1 / .75 / .5, no timer. Hide the answer until everyone finishes. Guard duplicate/stale network actions and host-only controls.
2. Add create/join/share lobby controls, player standings, waiting/reveal/final screens, reconnect and host removal of disconnected players. Match the record store design.
3. Check reducer regressions and two independent browser clients, including next round and reload. Review the change.
4. Publish only music-related files to the existing GitHub site and verify the public page.

## Verification

- 91 checks pass across music, genie and dice, including 8 multiplayer reducer tests.
- Two independent browser origins joined the same MQTT room. Checked shared readiness, playback, one player's wrong answer leaving the other's snippet unchanged, hidden answer while waiting, synchronized reveal, host-only next round, full five-track completion and restart.
- Reloaded both host and guest and resumed the same round. The pre-existing solo save (200 points) remained available after leaving the lobby.
- Independent review findings about audio loading failure, cached-page handlers, offline consolation points and stale asynchronous lookups were fixed and rechecked.
- Publication is limited to the music feature, its record-store assets and these plans; unrelated concurrent workspace changes are excluded.
