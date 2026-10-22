import test from 'node:test';
import assert from 'node:assert/strict';
import { resultPresentation } from './feedback.js';

test('earlier correct guesses get progressively stronger celebrations', () => {
  const levels = Array.from({ length: 6 }, (_, step) => resultPresentation({ won: true, step }));
  assert.match(levels[0].label, /полсекунды/i);
  assert.equal(levels[0].tier, 'instant');
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i - 1].particles > levels[i].particles);
    assert.ok(levels[i].particles > 0);
  }
  assert.equal(levels.at(-1).tier, 'calm');
});

test('surrender and exhausted attempts have no winning celebration at any step', () => {
  for (let step = 0; step < 6; step++) {
    const result = resultPresentation({ won: false, step });
    assert.equal(result.particles, 0);
    assert.equal(result.tier, 'missed');
    assert.match(result.label, /не угадали/i);
  }
});
