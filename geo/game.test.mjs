import test from 'node:test';
import assert from 'node:assert/strict';
import { START, WRONG, CLUES, nameIndex, matchCountry, newRound, canOpen, cluePrice, currencyPrice, openClue, refundWalk, guess, guidance, surrender, distanceKm, arrow, createGame, award, nextRound, countryOrder, selectFacts } from './game.js';
import { COUNTRIES, PACKS } from './countries.js';
import { WORLD, SHAPES, PHOTOS } from './atlas.js';
import { WALKS } from './walks.js';

const at = id => WORLD.find(w => w[0] === id).slice(2);

test('every dossier has its shape, centre and two facts; available walks have valid coordinates', () => {
  for (const c of COUNTRIES) {
    assert.ok(SHAPES[c.id]?.startsWith('M'), c.id);
    assert.ok(WORLD.some(w => w[0] === c.id), c.id);
    assert.equal(c.facts.length, 2, c.id);
    assert.ok(c.walk === null || c.walk.length > 0, c.id);
    if (WALKS[c.id]) {
      assert.ok(WALKS[c.id].length, c.id);
      for (const [lat, lon] of WALKS[c.id]) assert.ok(Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180, `${c.id}: координаты прогулки`);
    }
    assert.ok(PACKS.some(p => p.id === c.area), c.id);
    assert.ok(c.food[1] in PHOTOS && c.person[2] in PHOTOS, c.id);
  }
});

test('answers match names, aliases, ё and case', () => {
  const idx = nameIndex(WORLD, COUNTRIES);
  assert.equal(matchCountry('казахстан', idx), 'KZ');
  assert.equal(matchCountry('Киргизия', idx), 'KG');
  assert.equal(matchCountry('соединенные штаты', idx), 'US');
  assert.equal(matchCountry('Нарния', idx), null);
});

test('clues cost once, contour needs no other clues, unavailable and unaffordable clues cannot open', () => {
  const r=newRound('KZ', [], ['walk']);
  assert.equal(canOpen(r,'shape'),true);
  assert.equal(openClue(r,'fact2'),true);
  assert.equal(openClue(r,'fact2'),false);
  assert.equal(r.score,START-50);
  assert.equal(openClue(r,'walk'),false);
  assert.equal(openClue(r,'invented'),false);
  assert.equal(openClue(r,'compass'),false);
  r.score=199;assert.equal(openClue(r,'shape'),false);
  r.score=200;assert.equal(openClue(r,'shape'),true);assert.equal(r.score,0);
});

test('a free clue opens without charge', () => {
  const r = newRound('BY', ['walk']);
  openClue(r, 'walk');
  assert.equal(r.score, START);
});

test('wrong guess reveals no geography before compass is purchased', () => {
  const r = newRound('KZ');
  const miss = guess(r, 'RU', at);
  assert.equal(miss.correct, false);
  assert.equal(miss.dir,undefined);
  assert.equal(miss.km,undefined);
  assert.deepEqual(guidance(r,at),[]);
  assert.equal(r.score, START - WRONG);
  assert.equal(openClue(r,'compass'),true);
  assert.equal(r.score,START-WRONG-100);
  assert.deepEqual(guidance(r,at),[{id:'RU',dir:'↘'}]);
  guess(r,'UZ',at);assert.equal(guidance(r,at).length,2);
  assert.equal(openClue(r,'compass'),false);
  assert.equal(guess(r, 'RU', at), null, 'same wrong answer is not charged twice');
  assert.deepEqual(guess(r, 'KZ', at), { correct: true });
  assert.equal(guess(r, 'UZ', at), null);
});

test('geometry helpers', () => {
  assert.equal(distanceKm([0, 0], [0, 0]), 0);
  assert.ok(Math.abs(distanceKm([55.75, 37.62], [59.94, 30.31]) - 634) < 15);
  assert.equal(arrow([0, 0], [0, 10]), '→');
  assert.equal(arrow([0, 0], [10, 0]), '↑');
});

test('a game awards points to whoever solved and ends after its rounds', () => {
  const g = createGame(['KZ', 'RU', 'UZ'], 2, ['Аня', 'Боря'], { rnd: () => 0.5 });
  assert.equal(g.order.length, 2);
  guess(g.round, g.round.id, at);
  const pts = g.round.score;
  award(g, 1);
  assert.equal(g.players[1].score, pts);
  assert.ok(nextRound(g));
  surrender(g.round);
  award(g, 0);
  assert.equal(g.players[0].score, 0);
  assert.equal(nextRound(g), null);
  assert.equal(g.log.length, 2);
});

test('country order prioritizes unseen countries and avoids duplicates at a cycle boundary',()=>{
  assert.deepEqual(countryOrder(['RO','RU','PL','RO'],3,['RO','RU'],()=>0),['PL','RO','RU']);
  const g=createGame(['RO','RU','PL'],2,['Ты'],{recent:['RO']});
  assert.ok(!g.order.includes('RO'));assert.equal(new Set(g.order).size,2);
});
test('facts rotate before reuse and remain distinct',()=>{
  const facts=['a','b','c','d'],first=selectFacts(facts,[],()=>.5),next=selectFacts(facts,first,()=>.5);
  assert.equal(next.length,2);assert.ok(next.every(f=>!first.includes(f)));
  assert.equal(new Set(selectFacts(['a','a','b'],[],()=>0)).size,2);
});

test('unusable walk is refunded once and cannot be bought again in the same round',()=>{
  const r=newRound('FR');assert.equal(refundWalk(r),false);
  openClue(r,'walk');assert.equal(r.score,START-150);
  assert.equal(refundWalk(r),true);assert.equal(r.score,START);
  assert.equal(refundWalk(r),false);assert.equal(canOpen(r,'walk'),false);
  const finished=newRound('FR');openClue(finished,'walk');surrender(finished);
  assert.equal(refundWalk(finished),false);assert.equal(finished.score,0);
});

test('currency price reflects specificity and actual charge survives the next round',()=>{
  assert.equal(currencyPrice('euro',Array(8).fill('euro')),50);
  assert.equal(currencyPrice('ruble',['ruble','ruble']),100);
  assert.equal(currencyPrice('yen',['yen','euro']),175);
  assert.equal(currencyPrice('Доллар США',Array(8).fill('Доллар')),50);
  assert.equal(currencyPrice('Риял',['Риал','Риял']),100);
  const g=createGame(['JP','FR'],2,['Ты'],{pricesOf:()=>({money:175})});
  assert.equal(cluePrice(g.round,'money'),175);
  openClue(g.round,'money');assert.equal(g.round.score,825);
  nextRound(g);assert.equal(cluePrice(g.round,'money'),175);
});

test('walk refund cannot recover points already exhausted by wrong answers',()=>{
  const r=newRound('FR');openClue(r,'walk');
  for(let i=0;i<20;i++)guess(r,'fake-'+i,()=>[0,0]);
  assert.equal(r.score,0);assert.equal(refundWalk(r),true);assert.equal(r.score,0);
});
