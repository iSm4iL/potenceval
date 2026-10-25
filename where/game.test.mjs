// node where/game.test.mjs
import assert from 'node:assert/strict';
import { createState, reduce, publicView, points, distanceKm, deal, RUSH } from './game.js';
import { SPOTS } from './spots.js';

// очки как в GeoGuessr: в точку — 5000, дальше тают
assert.equal(points(0), 5000);
assert.ok(points(1000) > 2500 && points(1000) < 2600);
assert.ok(points(20000) < 5);
assert.ok(Math.abs(distanceKm([55.75, 37.62], [59.94, 30.31]) - 634) < 5); // Москва — Питер

// колода: разные страны, пока они не кончились
const spots = [['A', 0, 0], ['A', 1, 1], ['B', 2, 2], ['C', 3, 3]];
const d = deal(3, Math.random, spots);
assert.equal(new Set(d.map(i => spots[i][0])).size, 3);
assert.equal(deal(4, Math.random, spots).length, 4);

let now = 0, s = createState('A', 'ABCDE');
const act = (a, from) => (s = reduce(s, a, from, now));
act({ type: 'join', name: 'Аня' }, 'A');
act({ type: 'join', name: 'Боря' }, 'B');
act({ type: 'set', k: 'rounds', v: 3 }, 'B');
assert.equal(s.rounds, 5, 'настройки меняет только хост');
act({ type: 'set', k: 'rounds', v: 3 }, 'A');
act({ type: 'start' }, 'A');
assert.equal(s.phase, 'guess');
assert.equal(s.endsAt, 60000);

// Аня ставит точку прямо в место — 5000, а Боре остаётся RUSH секунд
const [, lat, lng] = s.spot;
act({ type: 'guess', lat, lng }, 'A');
assert.equal(s.players[0].score, 5000);
assert.equal(s.endsAt, RUSH * 1000);
act({ type: 'guess', lat: 1, lng: 1 }, 'A');
assert.equal(s.guesses.A.pts, 5000, 'второй раз не ставится');
assert.equal(publicView(s, 'B').guesses.A.done, true, 'чужую точку до конца раунда не видно');
assert.equal(publicView(s, 'B').guesses.A.lat, undefined);

// время вышло — Боря без очков
act({ type: 'timeout' }, 'A');
assert.equal(s.phase, 'guess', 'раньше срока не закрывается');
now = RUSH * 1000;
act({ type: 'timeout' }, 'A');
assert.equal(s.phase, 'reveal');
assert.equal(s.log.length, 1);

// второй раунд: Боря ушёл со связи — ответ открывается после Ани
act({ type: 'next' }, 'A');
assert.equal(s.round, 2);
act({ type: 'online', id: 'B', on: false }, 'A');
act({ type: 'guess', lat: 0, lng: 0 }, 'A');
assert.equal(s.phase, 'reveal');
act({ type: 'next' }, 'A');
act({ type: 'guess', lat: 0, lng: 0 }, 'A');
act({ type: 'next' }, 'A');
assert.equal(s.phase, 'over');

// данные: точки на месте и в своих странах
assert.ok(SPOTS.length > 100);
assert.ok(SPOTS.every(([cc, la, ln, id]) => cc.length === 2 && Math.abs(la) <= 90 && Math.abs(ln) <= 180 && id.length === 22));
console.log('ok');
