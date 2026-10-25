import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.js';
import { createRoom, reduceRoom, roomView, gameFor } from './multiplayer-game.js';

const tracks = Array.from({ length: 8 }, (_, i) => ({ id: `dz-${i + 1}`, deezerId: i + 1, title: `Song ${i + 1}`, artist: `Artist ${i + 1}`, artistIds: [String(i + 1)], artistNames: [`Artist ${i + 1}`], answerKey: `${i + 1}|song ${i + 1}` }));
const game = () => ({ ...createGame(tracks, { rounds: 2, random: () => .999 }), packId: 'new-wave', packTitle: 'Новая школа' });
function lobby(count = 2) {
  let s = createRoom('p0', 'ABCDE');
  for (let i = 0; i < count; i++) s = reduceRoom(s, { type: 'join', name: `Player ${i}` }, `p${i}`);
  return s;
}
function start(count = 2) {
  let s = reduceRoom(lobby(count), { type: 'start', game: game() }, 'p0');
  for (const p of s.players) s = act(s, p.id, 'ready');
  return s;
}
const act = (s, pid, type, extra = {}) => reduceRoom(s, { type, round: s.round, step: s.games?.[pid]?.step, ...extra }, pid);
const target = s => s.base.tracks.find(t => t.id === s.base.queue[s.games.p0.index]);

test('only host starts; all players load the same song before answering', () => {
  const s = lobby();
  assert.equal(reduceRoom(s, { type: 'start', game: game() }, 'p1'), s);
  let t = reduceRoom(s, { type: 'start', game: game() }, 'p0');
  assert.equal(t.phase, 'loading');
  assert.deepEqual(t.base.queue, gameFor(t, 'p1').queue);
  assert.equal(act(t, 'p0', 'guess', { answer: target(t) }), t);
  t = act(t, 'p0', 'ready'); assert.equal(t.phase, 'loading');
  t = act(t, 'p1', 'ready'); assert.equal(t.phase, 'round');
});

test('rank and snippet length determine points once; answers stay hidden until everyone finishes', () => {
  let s = start(6), answer = target(s);
  s = act(s, 'p0', 'guess', { answer });
  assert.equal(s.players[0].score, 1500);
  assert.equal(roomView(s, 'p0').game, null);
  assert.equal(JSON.stringify(roomView(s, 'p1')).includes(answer.title), false);
  assert.equal(JSON.stringify(roomView(s, 'p1')).includes('Song 2'), false, 'future tracks are private');
  const duplicate = act(s, 'p0', 'guess', { answer }); assert.equal(duplicate, s);
  s = act(s, 'p1', 'open', { index: 1 });
  s = act(s, 'p1', 'guess', { answer });
  for (let i = 2; i < 6; i++) s = act(s, `p${i}`, 'guess', { answer });
  assert.equal(s.phase, 'reveal');
  assert.deepEqual(s.players.map(p => p.score), [1500, 1000, 1000, 750, 500, 500]);
  assert.equal(roomView(s, 'p1').game.results[0].points, 1000);
  assert.equal(roomView(s, 'p1').game.tracks[0].title, answer.title);
});

test('wrong guesses affect only the sender; repeated and stale packets do not consume attempts', () => {
  let s = start(), round = s.round;
  const wrong = s.base.tracks[3];
  s = act(s, 'p1', 'guess', { answer: wrong });
  assert.equal(s.games.p1.step, 1); assert.equal(s.games.p0.step, 0);
  assert.equal(reduceRoom(s, { type: 'skip', round, step: 0 }, 'p1'), s);
  s = act(s, 'p0', 'surrender'); s = act(s, 'p1', 'surrender');
  assert.equal(s.phase, 'reveal');
  assert.equal(act(s, 'p1', 'next'), s);
  s = act(s, 'p0', 'next'); assert.equal(s.phase, 'loading');
  assert.equal(reduceRoom(s, { type: 'ready', round }, 'p1'), s);
  s = act(s, 'p0', 'ready'); s = act(s, 'p1', 'ready');
  s = act(s, 'p0', 'surrender'); s = act(s, 'p1', 'surrender');
  s = act(s, 'p0', 'next'); assert.equal(s.phase, 'summary');
  assert.equal(roomView(s, 'p1').game.results.length, 2);
});

test('offline players do not block a round; rejoining preserves score and new arrivals spectate', () => {
  let s = start();
  s = reduceRoom(s, { type: 'join', name: 'Late' }, 'late');
  assert.equal(roomView(s, 'late').spectator, true);
  s = reduceRoom(s, { type: 'online', id: 'p1', on: false }, 'p0');
  s = act(s, 'p0', 'guess', { answer: target(s) }); assert.equal(s.phase, 'reveal');
  assert.equal(s.games.p1.results[0].won, false);
  s = reduceRoom(s, { type: 'join', name: 'Back' }, 'p1');
  assert.equal(s.players[1].online, true); assert.equal(s.players[0].score, 1500);
  s = act(s, 'p0', 'next');
  assert.equal(s.games.late, undefined);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(act(act(restored, 'p0', 'ready'), 'p1', 'ready').phase, 'round');
});

test('only host can replace a broken shared track, and scored rounds cannot be replaced', () => {
  let s = start(), old = s.round;
  assert.equal(act(s, 'p1', 'replace'), s);
  s = act(s, 'p0', 'replace');
  assert.equal(s.phase, 'loading'); assert.notEqual(s.round, old);
  assert.deepEqual(s.base.queue, gameFor(s, 'p1').queue);
  s = act(act(s, 'p0', 'ready'), 'p1', 'ready');
  s = act(s, 'p0', 'guess', { answer: target(s) });
  assert.equal(act(s, 'p0', 'replace'), s);
});

test('artist mode, host permissions, capacity and malformed actions', () => {
  let s = lobby(8);
  assert.equal(reduceRoom(s, { type: 'join', name: 'Ninth' }, 'p8'), s);
  assert.equal(reduceRoom(s, { type: 'kick', id: 'p0' }, 'p1'), s);
  s = reduceRoom(s, { type: 'kick', id: 'p1' }, 'p0');
  assert.equal(reduceRoom(s, { type: 'join', name: 'Again' }, 'p1'), s);
  let g = game(); g.answerMode = 'artist';
  s = reduceRoom(s, { type: 'start', game: g }, 'p0');
  for (const p of s.players) s = act(s, p.id, 'ready');
  assert.equal(act(s, 'p0', 'guess', { answer: null }), s);
  const t = target(s);
  s = act(s, 'p0', 'guess', { answer: { kind: 'artist', id: `artist-${t.artistIds[0]}`, artistId: t.artistIds[0], name: t.artist } });
  assert.equal(s.players[0].score, 1500);
});

test('a disconnected player keeps the artist consolation bonus in the standings', () => {
  let s = start(); const answer = target(s);
  const edition = { ...tracks[4], id: 'dz-999', deezerId: 999, artist: answer.artist, artistIds: answer.artistIds, artistNames: answer.artistNames };
  s = reduceRoom(s, { type: 'verifiedGuess', by: 'p1', round: s.round, step: 0, answer: edition }, 'p0');
  s = reduceRoom(s, { type: 'online', id: 'p1', on: false }, 'p0');
  s = act(s, 'p0', 'surrender');
  assert.equal(s.phase, 'reveal');
  assert.equal(s.games.p1.score, 100); assert.equal(s.players[1].score, 100);
});

test('audio failures are visible to the host and a retry clears the failure', () => {
  let s = reduceRoom(lobby(), { type: 'start', game: game() }, 'p0');
  s = act(s, 'p1', 'audio-error');
  assert.equal(roomView(s, 'p0').players[1].audioError, true);
  s = act(s, 'p1', 'ready');
  assert.equal(roomView(s, 'p0').players[1].audioError, false);
});
