import test from 'node:test';
import assert from 'node:assert/strict';
import { prunePreviews } from './prune_previews.mjs';

const track = id => ({ id: `dz-${id}`, deezerId: id, title: `Song ${id}`, artist: 'Artist', genres: ['new-wave'], sources: [{ id: 'p', genres: ['new-wave'] }] });
test('confirmed bad previews are removed everywhere and cannot return through a saved review', () => {
  const catalog = { sources: [{ id: 'p', count: 2 }], tracks: [track(1), track(2)] };
  const config = { excludeTracks: [9], sources: [{ id: 'p', tracks: [{ url: 'https://www.deezer.com/track/1' }, { url: 'https://www.deezer.com/track/2' }] }],
    collectionTrackAllowlist: { 'new-wave': { ids: [1, 2], workKeys: ['work'], excludedIds: [] } } };
  const review = { tracks: { 'new-wave': { 'dz-1': { status: 'keep', more: true }, 'dz-2': { status: 'keep' } } } };
  const report = { results: [{ id: 1, title: 'Bad', sources: ['new-wave'], attempts: [{ status: 'too_short' }, { status: 'too_short' }] },
    { id: 2, attempts: [{ status: 'transient' }, { status: 'playable' }] }] };
  const result = prunePreviews(catalog, config, review, report);
  assert.deepEqual(result.catalog.tracks.map(t => t.deezerId), [2]);
  assert.deepEqual(result.config.excludeTracks, [1, 9]);
  assert.equal(result.config.sources[0].tracks.length, 1);
  assert.deepEqual(result.config.collectionTrackAllowlist['new-wave'].ids, [2]);
  assert.deepEqual(result.config.collectionTrackAllowlist['new-wave'].excludedIds, [1]);
  assert.equal(result.review.tracks['new-wave']['dz-1'], undefined);
  assert.equal(result.review.tracks['new-wave']['dz-2'].status, 'keep');
  assert.equal(result.catalog.sources[0].count, 1);
  assert.equal(catalog.tracks.length, 2, 'input snapshot stays available for comparison');
});

test('network failures and previews that succeeded on any retry stay in the catalog', () => {
  const result = prunePreviews({ sources: [], tracks: [track(1), track(2)] }, { sources: [] }, null, { results: [
    { id: 1, attempts: [{ status: 'transient' }, { status: 'transient' }] },
    { id: 2, attempts: [{ status: 'http404' }, { status: 'playable' }, { status: 'http404' }, { status: 'http404' }] },
  ] });
  assert.equal(result.catalog.tracks.length, 2);
  assert.equal(result.removed.length, 0);
});
