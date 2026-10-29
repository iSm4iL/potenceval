import test from 'node:test';
import assert from 'node:assert/strict';
import { PACKS } from './catalog.js';
import { shelfPage, selectionPage, recordArt } from './record-store-model.js';

test('shelf arrows expose every collection without wrapping past either end', () => {
  const first = shelfPage(PACKS, -1);
  assert.deepEqual(first.items.map(p => p.id), PACKS.slice(0, 8).map(p => p.id));
  assert.equal(first.previous, false);
  assert.equal(first.next, true);
  const last = shelfPage(PACKS, 99);
  assert.equal(last.page, 1);
  assert.equal(last.pages, 2);
  assert.deepEqual(last.items.map(p => p.id), ['us-hiphop', 'soundcloud', 'dead-inside', 'drill', 'hookah']);
  assert.equal(last.previous, true);
  assert.equal(last.next, false);
});

test('catalog rerenders retain a browsed page until the selected collection changes', () => {
  assert.equal(selectionPage(PACKS, 'new-wave', 'new-wave', 1), 1);
  assert.equal(selectionPage(PACKS, 'us-hiphop', 'new-wave', 0), 1);
  assert.equal(selectionPage(PACKS, 'dad-rock', 'us-hiphop', 1), 0);
  assert.equal(selectionPage(PACKS, 'new-wave', null, 1), 0);
});

test('a custom artist remains reachable and gets a safe shared sleeve', () => {
  const all = [...PACKS, { id: 'artist-42' }];
  assert.equal(shelfPage(all, 1).items.at(-1).id, 'artist-42');
  assert.equal(recordArt('artist-42'), recordArt('new-wave'));
  assert.equal(recordArt('../secret'), recordArt('new-wave'));
  // своя обложка у каждой подборки; `art` — временно чужая, пока своя не нарисована
  const own = PACKS.filter(p => !p.art);
  assert.equal(new Set(own.map(p => recordArt(p.id))).size, own.length);
  for (const p of PACKS.filter(p => p.art)) assert.ok(own.some(o => o.id === p.art));
});
