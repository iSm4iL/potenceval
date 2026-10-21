// node dice/game.test.mjs
import assert from 'node:assert/strict';
import { createState, reduce, colScore, total, botMove, BOT_ID } from './game.js';

// подсчёт как в Cult of the Lamb
assert.equal(colScore([4, 1, 4]), 17);
assert.equal(colScore([6, 6]), 24);
assert.equal(colScore([6, 6, 6]), 54);
assert.equal(colScore([1, 2, 3]), 6);
assert.equal(total([[6, 6], [5], []]), 29);

let rolls = [];
const rnd = () => (rolls.length ? (rolls.shift() - 1) / 6 + 0.01 : 0.5);
let s = createState('A', 'ABCDE');
const act = (a, from) => (s = reduce(s, a, from, 0, rnd));

act({ type: 'join', name: 'Тёма' }, 'A');
act({ type: 'join', name: 'Макс' }, 'B');
act({ type: 'join', name: 'Саня' }, 'C');
assert.equal(s, reduce(s, { type: 'join', name: 'x' }, BOT_ID), 'bot id cannot join');

rolls = [4];
act({ type: 'start' }, 'A');
assert.deepEqual(s.duel, ['A', 'B'], 'first two humans play, the rest watch');
assert.equal(s.turn, 'A');
assert.equal(s.die, 4);

const before = s;
act({ type: 'place', col: 0 }, 'B');
assert.equal(s, before, 'not your turn');

rolls = [4];
act({ type: 'place', col: 0 }, 'A');            // A: [4]
assert.equal(s.turn, 'B');
rolls = [2];
act({ type: 'place', col: 1 }, 'B');            // B: col1 [4]
rolls = [4];
act({ type: 'place', col: 0 }, 'A');            // A: col0 [4,2]
act({ type: 'place', col: 0 }, 'B');            // B rolls 4 → B col0 [4], A loses the 4 in col0
assert.deepEqual(s.boards.A[0], [2], 'matching dice destroyed in the same column');
assert.equal(s.last.destroyed, 1);

// конец игры: поле заполнено → победитель и счёт серии
s = structuredClone(s);
s.boards.A = [[6, 6, 6], [6, 6, 6], [6, 6]];
s.boards.B = [[1], [], []];
s.turn = 'A'; s.die = 5;
act({ type: 'place', col: 2 }, 'A');
assert.equal(s.phase, 'over');
assert.equal(s.winner, 'A');
assert.equal(s.wins.A, 1);

// царь горы: проигравший (B) уступает место третьему (C)
act({ type: 'start' }, 'A');
assert.deepEqual(s.duel, ['A', 'C'], 'winner stays, loser goes to the queue');
assert.deepEqual(s.players.map(p => p.id), ['A', 'C', 'B']);
assert.deepEqual(s.wins, {}, 'new pair — new series');

// один человек — играет против бота, бот ходит в допустимый столбец
let solo = reduce(reduce(createState('A', 'X'), { type: 'join', name: 'Я' }, 'A', 0), { type: 'start' }, 'A', 0, () => 0.5);
assert.deepEqual(solo.duel, ['A', BOT_ID]);
solo = reduce(solo, { type: 'place', col: 0 }, 'A', 0, () => 0.5);
assert.equal(solo.turn, BOT_ID);
const col = botMove(solo, () => 0);
assert.ok([0, 1, 2].includes(col));
solo = reduce(solo, { type: 'place', col }, BOT_ID, 0, () => 0.5);
assert.equal(solo.turn, 'A');

// реванш с той же парой: серия сохраняется, начинает другой
solo = structuredClone(solo);
solo.boards.A = [[6, 6, 6], [6, 6, 6], [6, 6]];
solo.die = 6;
solo = reduce(solo, { type: 'place', col: 2 }, 'A', 0, () => 0.5);
assert.equal(solo.winner, 'A');
solo = reduce(solo, { type: 'start' }, 'A', 0, () => 0.5);
assert.equal(solo.turn, BOT_ID, 'starter alternates');
assert.equal(solo.wins.A, 1, 'series kept for the same pair');
console.log('ok');
