import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { snapshotTrack } from './catalog.js';

test('refreshing audio never changes the party answer, including retry and lobby paths', async () => {
  const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  const prepare = source.slice(source.indexOf('async function prepareAudio('), source.indexOf('\nfunction preload('));
  for (const active of [false, true]) for (const preloadedBuffer of [false, true]) {
    const answer = { id: 'dz-1', deezerId: 1, title: 'Song', artist: '9mice', artistIds: ['150616292'], artistNames: ['9mice'], answerKey: '150616292|song' };
    const state = { phase: 'round', tracks: [answer], queue: ['dz-1'], index: 0, attempts: [] };
    const full = { ...answer, artist: 'Other', artistIds: ['99'], artistNames: ['Other'], answerKey: '99|song', preview: 'fresh-url' };
    let loaded;
    const context = vm.createContext({
      state, audioController: null, audioVersion: 0, busy: false, ready: false, screenVersion: 1, autoPlay: false,
      AbortController, snapshotTrack, persistGame() {}, t: ru => ru, $: () => ({}), updateControls() {},
      multiplayer: { active, ready() {} }, service: { track: async () => full },
      player: { load: async track => { loaded = track; return true; }, useBuffer(track) { loaded = track; } },
      preloaded: new Map(preloadedBuffer ? [['dz-1', Promise.resolve({ full, buffer: {} })]] : []),
      preload() {}, trackById() {},
    });
    await vm.runInContext(prepare + '\nprepareAudio(state.tracks[0], 1)', context);
    assert.deepEqual(context.state.tracks, [answer]);
    assert.equal(loaded.preview, 'fresh-url');
    assert.equal(context.ready, true);
  }
});
