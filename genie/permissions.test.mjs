import assert from 'node:assert/strict';
import { createState, reduce } from './game.js';
const base = () => ({ ...createState('A', 'TEST'), players: [
  { id: 'A', score: 0 }, { id: 'B', score: 0 }, { id: 'C', score: 0 }, { id: 'genie', genie: true }
], wisher: 'B', phase: 'hype', cards: [
  { by: 'A', text: 'first', fire: 0, adds: [] },
  { by: 'genie', text: 'last', fire: 0, adds: [{ by: 'C', text: 'twist' }] }
] });
for (const type of ['draw', 'custom', 'flip', 'next', 'decide']) {
  const s = { ...base(), phase: { draw: 'power', custom: 'power', flip: 'reveal', next: 'hype', decide: 'verdict' }[type], chosen: 0 };
  assert.equal(reduce(s, { type, text: 'power', take: true }, 'A'), s, `host cannot ${type} during another player turn`);
}
let s = base();
assert.equal(reduce(s, { type: 'fire', i: 0 }, 'stranger'), s);
s = reduce(s, { type: 'fire', i: 0 }, 'C');
assert.equal(s.cards[0].fire, 1);
assert.equal(reduce(s, { type: 'fire', i: 0 }, 'C'), s, 'duplicate vote ignored');
assert.equal(reduce(s, { type: 'fire', i: 1 }, 'C'), s, 'one vote across all cards');
s = reduce(s, { type: 'next' }, 'B');
assert.equal(s.chosen, 0, 'most votes wins over twists');
assert.equal(reduce(s, { type: 'choose', i: 1 }, 'B'), s, 'winner cannot be replaced');
assert.equal(reduce(s, { type: 'fire', i: 1 }, 'B'), s, 'votes close at verdict');
s = reduce(s, { type: 'decide', take: false }, 'B');
assert.equal(s.players.find(p => p.id === 'A').score, 1);
s = reduce(base(), { type: 'next' }, 'B');
assert.equal(s.chosen, 1, 'twists break vote ties');
assert.equal(s.cards[s.chosen].adds[0].text, 'twist');
s = base(); s.cards[1].adds = [];
assert.equal(reduce(s, { type: 'next' }, 'B').chosen, 1, 'last revealed breaks remaining tie');
console.log('genie regression ok');
