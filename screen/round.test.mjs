import test from 'node:test';
import assert from 'node:assert/strict';
import { revealPaidClue, BLUR, SHARPEN } from './round.js';

test('unaffordable clues preserve the remaining points and unopened clues', () => {
  const round = { score: 10, done: false };
  const tiles = new Set();
  assert.equal(revealPaidClue(round, tiles, 12, 20), false);
  assert.equal(round.score, 10);
  assert.equal(tiles.size, 0);
});

test('all clue types share the budget, charge once and stop after the round', () => {
  const round = { score: 30, done: false };
  const tiles = new Set();
  const actors = new Set();
  assert.equal(revealPaidClue(round, tiles, 12, 20), true);
  assert.equal(revealPaidClue(round, tiles, 12, 20), false);
  assert.equal(revealPaidClue(round, actors, 0, 14), false);
  assert.equal(revealPaidClue(round, actors, 0, 10), true);
  assert.equal(round.score, 0);
  round.score = 100;
  round.done = true;
  assert.equal(revealPaidClue(round, actors, 1, 14), false);
  assert.equal(round.score, 100);
});

test('sharpening steps end at a clear poster and fit into the round budget', () => {
  assert.equal(BLUR.length, SHARPEN.length + 1);
  assert.equal(BLUR.at(-1), 0);
  assert.ok(BLUR.every((b, i) => i === 0 || b < BLUR[i - 1]));
  assert.ok(SHARPEN.reduce((a, b) => a + b, 0) < 100);
});
