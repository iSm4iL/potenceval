import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSession, buildChoices, createRound, startRound, answerRound, scoreAnswer, remainingTime, interruptRound } from './game.js';

const catalog = Array.from({ length: 12 }, (_, i) => ({ animeId: `a${i}`, franchiseId: `f${i}`, trackId: i + 1, distractorIds: ['a0','a1','a2','a3','a4','a5'].filter(id => id !== `a${i}`) }));
test('session contains ten distinct anime and never mutates the catalog', () => {
  const ids = catalog.map(x => x.animeId);
  const session = buildSession(catalog, 10, () => .35);
  assert.equal(session.length, 10);
  assert.equal(new Set(session.map(x => x.animeId)).size, 10);
  assert.deepEqual(catalog.map(x => x.animeId), ids);
});
test('choices have one correct answer and three unique curated distractors', () => {
  const choices = buildChoices(catalog[0], catalog, () => .2);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices.map(x => x.animeId)).size, 4);
  assert.equal(choices.filter(x => x.animeId === 'a0').length, 1);
  assert.ok(choices.filter(x => x.animeId !== 'a0').every(x => catalog[0].distractorIds.includes(x.animeId)));
});
test('same franchise and same recording cannot be distractors', () => {
  const pool = structuredClone(catalog);
  pool[1].franchiseId = 'f0'; pool[2].trackId = 1;
  const ids = buildChoices(pool[0], pool, () => .9).map(x => x.animeId);
  assert.ok(!ids.includes('a1')); assert.ok(!ids.includes('a2'));
  pool[0].distractorIds = ['a1','a2','missing'];
  assert.throws(() => buildChoices(pool[0], pool), /вариант/);
});
test('a session rejects a pool too small to play and deduplicates franchises', () => {
  assert.throws(() => buildSession(catalog.slice(0, 3), 10), /аниме/);
  const pool = structuredClone(catalog); pool[1].franchiseId = pool[0].franchiseId;
  const session = buildSession(pool, 10);
  assert.equal(new Set(session.map(x => x.franchiseId)).size, 10);
});
test('time starts only with actual playback and repeated starts preserve the deadline', () => {
  const round = createRound(catalog[0]);
  assert.equal(remainingTime(round, 90000), 30000);
  assert.equal(answerRound(round, 'a0', 5), false);
  startRound(round, 1000); startRound(round, 2000);
  assert.equal(round.deadline, 31000);
  assert.equal(remainingTime(round, 11000), 20000);
  assert.equal(remainingTime(round, 90000), 0);
});
test('correct answer scores once; expired correct answers score zero', () => {
  const round = createRound(catalog[0]); startRound(round, 1000);
  assert.equal(answerRound(round, 'a0', 11000), true);
  assert.equal(round.points, 300); assert.equal(round.correct, true);
  assert.equal(answerRound(round, 'a1', 12000), false);
  assert.equal(round.points, 300);
  const late = createRound(catalog[0]); startRound(late, 0);
  answerRound(late, 'a0', 30000);
  assert.equal(late.correct, false); assert.equal(late.points, 0);
});
test('wrong answers and timeout reveal the answer with no score', () => {
  for (const id of ['a1', null]) {
    const round = createRound(catalog[0]); startRound(round, 0); answerRound(round, id, 1000);
    assert.equal(round.phase, 'revealed'); assert.equal(round.points, 0);
  }
  assert.equal(scoreAnswer(true, 30000), 400);
  assert.equal(scoreAnswer(true, 15000), 250);
  assert.equal(scoreAnswer(true, -10), 0);
  assert.equal(scoreAnswer(false, 30000), 0);
});
test('interrupted playback or a restored page voids the round without awarding a timeout loss', () => {
  const round = createRound(catalog[0]); startRound(round, 0);
  assert.equal(interruptRound(round), true);
  assert.equal(round.phase, 'error');
  assert.equal(answerRound(round, 'a0', 40000), false);
  assert.equal(round.points, 0);
  assert.equal(interruptRound(round), false);
  const answered = createRound(catalog[0]); startRound(answered, 0); answerRound(answered, 'a0', 1000);
  assert.equal(interruptRound(answered), false);
  assert.equal(answered.points, 390);
});
test('each category plays its own titles and never offers another category as a distractor', () => {
  const films = catalog.map(x => ({...x, animeId: 'film-'+x.animeId, franchiseId:'film-'+x.franchiseId, trackId:x.trackId+100,category:'film',distractorIds:x.distractorIds.map(id=>'film-'+id)}));
  const pool = [...catalog, ...films];
  assert.ok(buildSession(pool, 10, () => .3, {category:'film'}).every(x=>x.category==='film'));
  const entry = {...films[0],distractorIds:['a1','film-a1','film-a2','film-a3','film-a4']};
  assert.ok(buildChoices(entry, pool, () => .3).every(x=>x.category==='film'));
});
test('new parties use unplayed titles before repeating and can wrap a nearly exhausted collection', () => {
  const seenIds = catalog.slice(0, 10).map(x=>x.animeId);
  const next = buildSession(catalog, 10, () => .3, {category:'anime', seenIds});
  assert.deepEqual(new Set(next.slice(0,2).map(x=>x.animeId)),new Set(['a10','a11']));
  assert.equal(new Set(next.map(x=>x.animeId)).size,10);
  assert.equal(buildSession(catalog,10,()=>.3,{category:'anime',seenIds:catalog.map(x=>x.animeId)}).length,10);
});
test('an unplayed sequel can replace a played title from the same franchise', () => {
  const sequel={...catalog[0],animeId:'sequel',trackId:99};
  const party=buildSession([...catalog,sequel],12,()=>.3,{seenIds:['a0']});
  assert.ok(party.some(x=>x.animeId==='sequel'));
  assert.ok(!party.some(x=>x.animeId==='a0'));
});
