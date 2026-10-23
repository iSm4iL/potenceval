import test from 'node:test';
import assert from 'node:assert/strict';
import { LENGTHS, POINTS, createGame, guess, skip, openStep, surrender, nextRound, replaceBroken, restoreGame } from './game.js';
import { normalizeDeezer, searchTracks, sameArtist, snapshotTrack, combineSuggestions } from './catalog.js';

const song = (n, artist = 'a') => ({ id: `dz-${n}`, deezerId: n, title: `Song ${n}`, artist: `Artist ${artist}`, artistIds: [artist], artistNames: [`Artist ${artist}`], answerKey: `${artist}|song ${n}`, preview: 'https://cdnt-preview.dzcdn.net/example.mp3', kind: 'online', start: 0 });
const tracks = Array.from({ length: 12 }, (_, i) => song(i + 1, i < 2 ? 'a' : 'b'));
const game = (rounds = 5) => createGame(tracks, { rounds, random: () => 0.999 });

const party = (pool, options = {}) => createGame(pool, { rounds: 3, maxPerArtist: 2, random: () => 0.999, ...options });
const queued = s => s.queue.map(id => s.tracks.find(t => t.id === id));
const collab = (n, artists) => ({ ...song(n, artists[0]), artistIds: artists });

test('artist quota counts every collaborator once and retains unused reserves', () => {
  const pool = [collab(1, ['a', 'b', 'b']), song(2, 'a'), song(3, 'b'), song(4, 'b'), song(5, 'c')];
  const s = party(pool, { rounds: 4 });
  assert.equal(s.maxPerArtist, 2);
  assert.deepEqual(s.queue, ['dz-1', 'dz-2', 'dz-3', 'dz-5']);
  assert.deepEqual(s.reserve, ['dz-4']);
});

test('selection backtracks out of a collaboration that blocks a feasible fresh party', () => {
  const s = party([collab(1, ['a', 'b']), song(2, 'a'), song(3, 'b'), song(4, 'c'), song(5, 'z')], {
    maxPerArtist: 1, recent: ['dz-5'],
  });
  assert.deepEqual(s.queue, ['dz-2', 'dz-3', 'dz-4']);
});

test('different editions cannot repeat either a work key or an answer key', () => {
  const pool = [
    { ...song(1, 'a'), workKey: 'shared-work' },
    { ...song(2, 'b'), workKey: 'shared-work' },
    { ...song(3, 'c'), answerKey: 'same-answer' },
    { ...song(4, 'd'), answerKey: 'same-answer' },
    song(5, 'e'),
  ];
  const s = party(pool);
  assert.deepEqual(s.queue, ['dz-1', 'dz-3', 'dz-5']);
  assert.equal(queued(s)[0].workKey, 'shared-work');
  assert.throws(() => party(pool, { rounds: 4 }), /песен|исполнител/i);
});

test('a work key matching an unrelated track ID does not make the party infeasible', () => {
  const s = party([{ ...song(1, 'a'), workKey: 'dz-2' }, song(2, 'b')], { rounds: 2 });
  assert.deepEqual(s.queue, ['dz-1', 'dz-2']);
});

test('recent IDs, answer keys and work keys all defer to a feasible fresh party', () => {
  const pool = Array.from({ length: 6 }, (_, i) => ({ ...song(i + 1, String(i)), workKey: `work-${i + 1}` }));
  const s = party(pool, { recent: ['dz-1', pool[1].answerKey, 'work-3'] });
  assert.deepEqual(s.queue, ['dz-4', 'dz-5', 'dz-6']);
  assert.equal(s.reserve.length, 3);
});

test('recent fallback uses the fewest recent works even when an early fresh song blocks others', () => {
  const pool = [collab(1, ['a', 'b']), song(2, 'a'), song(3, 'b'), song(4, 'c'), song(5, 'd')];
  const s = party(pool, { rounds: 4, maxPerArtist: 1, recent: ['dz-4', 'dz-5'] });
  assert.deepEqual(s.queue, ['dz-2', 'dz-3', 'dz-4', 'dz-5']);
});

test('recent IDs mark other editions of that same work as recent too', () => {
  const pool = [{ ...song(1), workKey: 'old' }, { ...song(2, 'b'), workKey: 'old' }, song(3, 'c')];
  assert.deepEqual(party(pool, { rounds: 1, recent: ['dz-1'] }).queue, ['dz-3']);
});

test('technical replacement prefers unheard reserves, including after restoring', () => {
  const s = party([song(1, 'a'), song(2, 'b'), song(3, 'c')], { rounds: 1, recent: ['dz-3'] });
  assert.deepEqual(s.queue, ['dz-1']);
  assert.deepEqual(replaceBroken(restoreGame(JSON.parse(JSON.stringify(s)))).queue, ['dz-2']);
});

test('strict quota rejects insufficient diversity and invalid caps', () => {
  assert.throws(() => party(Array.from({ length: 200 }, (_, i) => song(i + 1, i < 100 ? 'a' : 'b')), { rounds: 5 }), /исполнител/i);
  for (const maxPerArtist of [0, -1, 1.5, NaN, null, '2']) {
    assert.throws(() => party(tracks, { maxPerArtist }), /исполнител/i);
  }
});

test('large impossible overlapping catalogs terminate without relaxing the quota', () => {
  const pairs = [['a', 'b'], ['b', 'c'], ['a', 'c'], ['d', 'e'], ['e', 'f'], ['d', 'f']];
  const pool = Array.from({ length: 600 }, (_, i) => collab(i + 1, pairs[i % pairs.length]));
  pool.push(song(601, 'z'));
  // Each triangle permits only one song, plus the solo: three, never four.
  assert.throws(() => party(pool, { rounds: 4, maxPerArtist: 1 }), /исполнител/i);
});

test('supplied random controls eligible selection reproducibly', () => {
  const pool = Array.from({ length: 8 }, (_, i) => song(i + 1, String(i)));
  assert.deepEqual(party(pool).queue, party(pool).queue);
  assert.notDeepEqual(party(pool).queue, party(pool, { random: () => 0 }).queue);
});

test('replacement quota includes completed and future tracks and retains ineligible reserves', () => {
  const pool = [song(1, 'a'), song(2, 'b'), song(3, 'a'), song(4, 'c'), song(5, 'a')];
  let s = nextRound(surrender(party(pool)));
  s = replaceBroken(s);
  assert.deepEqual(s.queue, ['dz-1', 'dz-4', 'dz-3']);
  assert.deepEqual(s.reserve, ['dz-5']);
  assert.equal(s.results.length, 1);
  const shortened = replaceBroken(s);
  assert.deepEqual(shortened.queue, ['dz-1', 'dz-3']);
  assert.deepEqual(shortened.reserve, ['dz-5']);
  assert.equal(shortened.score, 0);
});

test('replacement excludes reserve editions of another party work', () => {
  const pool = [{ ...song(1), workKey: 'work' }, song(2, 'b'), { ...song(3, 'c'), workKey: 'work' }];
  const s = replaceBroken(nextRound(surrender(party(pool, { rounds: 2 }))));
  assert.deepEqual(s.queue, ['dz-1']);
  assert.equal(s.phase, 'summary');
});

test('old unbounded saves remain valid and capped games restore round, reveal and summary', () => {
  const old = game();
  assert.equal(Object.hasOwn(old, 'maxPerArtist'), false);
  assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(old))), old);
  let s = party([song(1, 'a'), song(2, 'b'), song(3, 'c')]);
  assert.equal(s.maxPerArtist, 2);
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(s))), s);
    s = guess(s, queued(s)[s.index]);
    assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(s))), s);
    s = nextRound(s);
  }
  assert.equal(s.phase, 'summary');
  assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(s))), s);
  for (const maxPerArtist of [0, -1, 1.5, Infinity, null, '2']) {
    assert.equal(restoreGame({ ...old, maxPerArtist }), null);
  }
  assert.equal(restoreGame({ ...old, maxPerArtist: 2 }), null, 'forged cap cannot hide an over-quota queue');
});

test('all six snippet lengths award exactly the stated points once', () => {
  assert.deepEqual(LENGTHS, [0.5, 1, 2, 5, 10, 15]);
  assert.deepEqual(POINTS, [1000, 800, 600, 400, 200, 100]);
  for (let step = 0; step < 6; step++) {
    let s = game();
    for (let i = 0; i < step; i++) s = skip(s);
    s = guess(s, tracks[0]);
    assert.equal(s.phase, 'reveal');
    assert.equal(s.score, POINTS[step]);
    assert.equal(s.attempts.at(-1).status, 'correct');
    assert.equal(guess(s, tracks[0]), s);
  }
});

test('history distinguishes wrong song, matching artist and correct song', () => {
  let s = guess(game(), tracks[2]);
  assert.equal(s.attempts[0].status, 'wrong');
  assert.equal(s.attempts[0].title, tracks[2].title);
  s = guess(s, tracks[1]);
  assert.equal(s.attempts[1].status, 'artist');
  assert.equal(s.step, 2);
  s = guess(s, tracks[0]);
  assert.equal(s.attempts[2].status, 'correct');
  assert.equal(s.score, 600);
  assert.deepEqual(s.results[0].attempts, s.attempts);
});

test('invalid and repeated attempts do not consume a step', () => {
  let s = game();
  assert.equal(guess(s, null), s);
  assert.equal(guess(s, { id: 'missing' }), s);
  s = guess(s, tracks[1]);
  assert.equal(s.step, 1);
  assert.equal(guess(s, tracks[1]), s);
  assert.equal(s.attempts.length, 1);
});

test('a real search result outside the pack is accepted as an attempt', () => {
  const s = guess(game(), song(999, 'z'));
  assert.equal(s.step, 1);
  assert.equal(s.attempts[0].status, 'wrong');
});

test('same work with another release ID can be a correct answer', () => {
  const otherRelease = { ...tracks[0], id: 'dz-999', deezerId: 999, title: 'Song 1 (Remastered)' };
  assert.equal(guess(game(), otherRelease).score, 1000);
});

test('collaborators count as a matching artist, distinct artists with the same name do not', () => {
  assert.equal(sameArtist({ artistIds: ['a', 'b'] }, { artistIds: ['b'] }), true);
  assert.equal(sameArtist({ artistIds: ['a'], artist: 'Space' }, { artistIds: ['b'], artist: 'Space' }), false);
});

test('six skips reveal with zero points and do not fabricate guesses', () => {
  let s = game();
  for (let i = 0; i < 6; i++) s = skip(s);
  assert.equal(s.phase, 'reveal');
  assert.equal(s.score, 0);
  assert.deepEqual(s.attempts, []);
  assert.equal(skip(s), s);
});

test('advancing completes a party and preserves all previous guesses', () => {
  let s = nextRound(guess(game(2), tracks[0]));
  assert.deepEqual(s.attempts, []);
  assert.equal(s.results[0].attempts[0].status, 'correct');
  s = nextRound(surrender(s));
  assert.equal(s.phase, 'summary');
  assert.equal(s.results.length, 2);
  assert.equal(s.score, 1000);
});

test('shuffle has no repeats and cannot create an impossible party', () => {
  const s = game();
  assert.equal(new Set([...s.queue, ...s.reserve]).size, tracks.length);
  assert.throws(() => createGame(tracks, { rounds: 20 }), /песен/i);
  assert.throws(() => createGame([], { rounds: 5 }), /песен/i);
  assert.equal(s.tracks.some(t => Object.hasOwn(t, 'preview')), false, 'expiring preview URLs are not persisted');
});

test('technical replacements reset hints without a score penalty', () => {
  const s = guess(game(), tracks[1]);
  const next = replaceBroken(s);
  assert.notEqual(next.queue[0], s.queue[0]);
  assert.equal(next.queue.length, s.queue.length);
  assert.equal(next.score, 0);
  assert.equal(next.step, 0);
  assert.deepEqual(next.attempts, []);
  let short = createGame(tracks.slice(0, 2), { rounds: 2, random: () => 0.999 });
  short = nextRound(guess(short, tracks[0]));
  short = replaceBroken(short);
  assert.equal(short.phase, 'summary');
  assert.equal(short.score, 1000);
});

test('saved online game restores history and rejects forged scores and artist hints', () => {
  const s = guess(game(), tracks[1]);
  assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(s))), s);
  assert.equal(restoreGame({ ...s, step: 99 }), null);
  assert.equal(restoreGame({ ...s, score: 999 }), null);
  assert.equal(restoreGame({ ...s, attempts: [{ ...s.attempts[0], status: 'correct' }] }), null);
  assert.equal(restoreGame({ ...s, queue: [s.queue[0], s.queue[0]] }), null);
  assert.equal(restoreGame(null), null);
  const reveal = guess(s, tracks[0]);
  assert.deepEqual(restoreGame(reveal), reveal);
});

test('normalization accepts only actual online previews and keeps artist identities', () => {
  const raw = { id: 1, title: 'Song (Remastered)', title_short: 'Song', preview: 'https://cdnt-preview.dzcdn.net/a.mp3', artist: { id: 2, name: 'Skrillex' }, contributors: [{ id: 3, name: 'Guest' }] };
  const t = normalizeDeezer(raw);
  assert.equal(t.id, 'dz-1');
  assert.deepEqual(t.artistIds, ['2', '3']);
  assert.equal(t.answerKey, '2|song');
  assert.equal(normalizeDeezer({ ...raw, preview: '' }), null);
  assert.equal(normalizeDeezer({ ...raw, preview: 'javascript:alert(1)' }), null);
  assert.equal(normalizeDeezer({ ...raw, preview: 'https://untrusted.example/song.mp3' }), null);
  assert.equal(Object.hasOwn(snapshotTrack(t), 'preview'), false);
});

test('search matches titles and artists without case or ё differences', () => {
  const sample = [{ id: 'x', title: 'Всё идёт', artist: 'Артист', aliases: ['Vse idet'] }];
  assert.equal(searchTracks(sample, '  ВСЕ   ИДЕТ ')[0].id, 'x');
  assert.equal(searchTracks(sample, 'артист')[0].id, 'x');
  assert.equal(searchTracks(sample, 'vse idet')[0].id, 'x');
  assert.deepEqual(searchTracks(sample, ''), []);
});

test('collaborations display all performers and can be found by a guest artist', () => {
  const track = normalizeDeezer({
    id: 1, title: 'ДИНАСТИЯ', artist: { id: 2, name: 'VILLIAN' },
    contributors: [{ id: 2, name: 'VILLIAN' }, { id: 3, name: 'madk1d' }],
    preview: 'https://cdnt-preview.dzcdn.net/a.mp3',
  });
  assert.equal(track.artist, 'VILLIAN, madk1d');
  assert.equal(searchTracks([track], 'madk1d')[0]?.id, track.id);
  const restored = { ...track, artist: 'VILLIAN' };
  assert.equal(searchTracks([restored], 'madk1d')[0]?.id, track.id, 'older snapshots also search contributor names');
});

test('exact artist plus title ranks above covers and medleys', () => {
  const sample = [
    { id: 'cover', title: 'Daft Punk Medley One More Time', artist: 'Cover Band' },
    { id: 'original', title: 'One More Time', artist: 'Daft Punk' },
  ];
  assert.equal(searchTracks(sample, 'Daft Punk One More Time')[0].id, 'original');
});

test('remote results cannot displace an already displayed local answer', () => {
  const original = { ...song(1), title: 'Bangarang (feat. Sirah)', artist: 'Skrillex' };
  const cover = { ...song(2, 'b'), title: 'Bangarang', artist: 'Gard' };
  assert.deepEqual(combineSuggestions([original], [], 'Bangarang'), [original]);
  assert.equal(combineSuggestions([original], [cover], 'Bangarang')[0].id, original.id);
  assert.equal(combineSuggestions([original], [original, cover], 'Bangarang').length, 2);
  assert.equal(combineSuggestions([original], [cover], 'Bangarang', [original.id])[0].id, cover.id);
});

test('duplicate pool and saved tracks cannot occupy the autocomplete result limit', () => {
  const local = Array.from({ length: 12 }, (_, i) => song(i + 1));
  const result = combineSuggestions([...local, ...local], [], 'Artist');
  assert.equal(result.length, 8);
  assert.equal(new Set(result.map(t => t.id)).size, 8);
  assert.deepEqual(result.map(t => t.id), searchTracks(local, 'Artist').map(t => t.id));
});

test('openStep jumps straight to a longer snippet and scores like that step', () => {
  const s = openStep(game(), 4);
  assert.equal(s.step, 4);
  assert.equal(openStep(s, 2), s);
  assert.equal(openStep(s, 6), s);
  assert.equal(guess(s, tracks[0]).score, POINTS[4]);
});
