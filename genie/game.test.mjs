// node genie/game.test.mjs
import assert from 'node:assert/strict';
import { createState, reduce, publicView } from './game.js';

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let s = createState('A', 'ABCDE');
const act = (a, from, now = 0) => (s = reduce(s, a, from, now, rnd));

act({ type: 'join', name: 'Тёма' }, 'A');
act({ type: 'join', name: '<b>Макс</b>' }, 'B');
assert.equal(s.players.length, 3, 'two humans + genie');
assert.equal(s.players.at(-1).id, 'genie', 'genie stays last');

const before = s;
act({ type: 'start' }, 'B');
assert.equal(s, before, 'only host can start');

act({ type: 'start' }, 'A');
assert.equal(s.phase, 'power');
const wisher = s.wisher, other = wisher === 'A' ? 'B' : 'A';

act({ type: 'next' }, wisher);
assert.equal(s.phase, 'power', 'cannot leave power phase without a power');
act({ type: 'draw' }, wisher);
assert.ok(s.power.title);

act({ type: 'next' }, wisher, 1000);
assert.equal(s.phase, 'write');
assert.equal(s.cards.length, 1, 'genie card is ready');
assert.equal(publicView(s, other).cards[0].text, null, 'genie text hidden while writing');

act({ type: 'submit', text: 'становишься тупее' }, wisher);
assert.equal(s.cards.length, 1, 'wisher cannot submit');
act({ type: 'submit', text: 'становишься тупее' }, other);
assert.equal(s.phase, 'reveal', 'all writers done -> reveal');
assert.equal(s.cards.at(-1).by, 'genie', 'genie revealed last');
assert.equal(publicView(s, other).cards[0].text, null, 'unrevealed hidden');

act({ type: 'flip' }, wisher);
act({ type: 'fire', i: 0 }, other);
act({ type: 'fire', i: 1 }, other);
assert.equal(s.cards[0].fire, 1);
assert.equal(s.cards[1].fire, 0, 'cannot fire an unrevealed card');

act({ type: 'next' }, wisher);
assert.equal(s.phase, 'hype');
act({ type: 'add', i: 0, text: '…и умнеешь, только если идёшь пешком' }, other);
assert.equal(s.cards[0].adds.length, 1);

act({ type: 'next' }, wisher);
act({ type: 'next' }, wisher);
assert.equal(s.phase, 'verdict', 'cannot skip verdict without decision');
const human = s.cards.findIndex(c => c.by === other);
act({ type: 'choose', i: human }, 'Z');
assert.equal(s.chosen, null, 'only driver chooses');
act({ type: 'choose', i: human }, wisher);
act({ type: 'decide', take: false }, wisher);
assert.equal(s.players.find(p => p.id === other).score, 1, 'refused -> author scores');

act({ type: 'next' }, wisher);
assert.equal(s.phase, 'share');
act({ type: 'next' }, wisher);
assert.equal(s.phase, 'power');
assert.equal(s.wisher, other, 'next player wishes');

// таймер: хост закрывает приём подвохов по истечении времени
act({ type: 'custom', text: 'Летать' }, other);
act({ type: 'next' }, other, 0);
act({ type: 'timeout' }, 'A', 30_000);
assert.equal(s.phase, 'write', 'timer not expired yet');
act({ type: 'timeout' }, 'A', 61_000);
assert.equal(s.phase, 'reveal');

act({ type: 'next' }, 'A'); act({ type: 'next' }, 'A');
act({ type: 'choose', i: 0 }, 'A'); act({ type: 'decide', take: true }, 'A');
assert.equal(s.players.find(p => p.id === other).score, 2, 'took -> wisher scores');
act({ type: 'next' }, 'A'); act({ type: 'next' }, 'A');
assert.equal(s.phase, 'final');
console.log('ok');
