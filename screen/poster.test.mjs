import test from 'node:test';
import assert from 'node:assert/strict';
import { START_TILE, tileCost, revealTile } from './poster.js';

test('only one corner tile is visible at the start', () => {
  assert.equal(START_TILE, 0);
  const state = new Set([START_TILE]);
  assert.deepEqual([...state], [0]);
});

test('a central tile costs more than an edge tile', () => {
  assert.equal(tileCost(0), 6);
  assert.equal(tileCost(7), 12);
  assert.equal(tileCost(10), 20);
});

test('opening a tile charges once and cannot reopen the free tile', () => {
  const state = new Set([START_TILE]);
  assert.deepEqual(revealTile(state, 10), { opened: true, cost: 20 });
  assert.equal(state.has(10), true);
  assert.deepEqual(revealTile(state, 10), { opened: false, cost: 0 });
  assert.deepEqual(revealTile(state, START_TILE), { opened: false, cost: 0 });
});
