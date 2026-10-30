import test from 'node:test';
import assert from 'node:assert/strict';
import { artistGroups, setArtistChoice, setTrackChoice, selectionFor, validateReview } from './review-model.js';

const tracks = [
  { id: 'dz-1', title: 'A', artistIds: ['1', '2'], artistNames: ['THRILL PILL', 'Guest'] },
  { id: 'dz-2', title: 'B', artistIds: ['1'], artistNames: ['Thrill Pill'] },
];
test('artist listing collapses case variants and counts collaborations once', () => {
  const groups = artistGroups(tracks);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(g => g.key === 'thrill pill').tracks.length, 2);
});
test('bulk choices include guests, stay collection-specific and allow track overrides', () => {
  const state = { version: 1, tracks: {}, artists: {} };
  setArtistChoice(state, 'new-wave', 'guest', tracks, 'status', 'remove');
  assert.equal(selectionFor(state, 'new-wave', 'dz-1').status, 'remove');
  assert.equal(selectionFor(state, 'new-wave', 'dz-2').status, 'unreviewed');
  assert.equal(selectionFor(state, 'ru-rap', 'dz-1').status, 'unreviewed');
  setTrackChoice(state, 'new-wave', 'dz-1', 'status', 'keep');
  setTrackChoice(state, 'new-wave', 'dz-1', 'more', true);
  setTrackChoice(state, 'new-wave', 'dz-1', 'similar', true);
  assert.deepEqual(selectionFor(state, 'new-wave', 'dz-1'), { status: 'keep', more: true, similar: true });
  assert.equal(validateReview(JSON.parse(JSON.stringify(state))).version, 1);
});
test('import rejects malformed and prototype-polluting choices', () => {
  for (const bad of [null, { version: 2 }, { version: 1, tracks: [], artists: {} },
    JSON.parse('{"version":1,"tracks":{"__proto__":{}},"artists":{}}'),
    { version: 1, tracks: { a: { b: { status: 'invalid' } } }, artists: {} }]) {
    assert.throws(() => validateReview(bad));
  }
});
