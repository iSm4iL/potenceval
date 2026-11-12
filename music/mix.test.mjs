import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMix, relatedInLibrary } from './mix.js';

const song = (id, artistIds, answerKey = String(id)) => ({
  id: `dz-${id}`, deezerId: id, title: `Song ${id}`, artistIds,
  artistNames: artistIds.map(id => `Artist ${id}`), answerKey,
});

test('mix prefers catalog credits, supplements sparse artists, and excludes unrelated and duplicate songs', async () => {
  const library = [song(1, ['150616292', '4']), song(2, ['2']), song(3, ['8'])];
  const result = await buildMix([{ id: 268236102, name: '9mice' }, { id: 2, name: 'Artist 2' }], library, {
    async loadPack() {
      return { tracks: [song(4, ['2'], '2'), song(5, ['2']), song(6, ['8'])], failures: [] };
    },
  });
  assert.deepEqual(result.tracks.map(t => t.deezerId), [1, 2, 5]);
  assert.deepEqual(relatedInLibrary(library, 268236102).map(a => a.id), [4]);
});

test('known tracks remain playable when Deezer top tracks fail', async () => {
  const library = [song(1, ['2'])];
  const result = await buildMix([{ id: 2, name: 'Artist 2' }], library, {
    async loadPack() { throw new Error('Offline'); },
  });
  assert.deepEqual(result.tracks, library);
  assert.deepEqual(result.failures, ['Offline']);
});
