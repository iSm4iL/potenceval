import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, guess, buyDirection, guidance, DIRECTION_COST, approximateKm, openClue, refundWalk, surrender, selectFacts } from './game.js';
const at=id=>({A:[0,0],B:[0,10],C:[10,0]})[id];
test('each guess buys its own direction once and reveals rounded distance only after payment',()=>{
 const r=newRound('A'); assert.equal(buyDirection(r,'B'),false);
 guess(r,'B',at);guess(r,'C',at);assert.deepEqual(guidance(r,at),[]);
 assert.equal(buyDirection(r,'B'),true);assert.equal(r.score,900-DIRECTION_COST);
 assert.deepEqual(guidance(r,at),[{id:'B',dir:'←',km:1000}]);
 assert.equal(buyDirection(r,'B'),false);assert.equal(guidance(r,at).length,1);
 assert.equal(buyDirection(r,'C'),true);assert.equal(guidance(r,at).length,2);
 r.score=49;guess(r,'D',()=>[0,0]);assert.equal(buyDirection(r,'D'),false);
 surrender(r);assert.equal(buyDirection(r,'D'),false);
});
test('rounding uses 50 km for neighbours, 250 km below 1000 and 500 km above',()=>{
 assert.equal(approximateKm(10),50);assert.equal(approximateKm(620),500);
 assert.equal(approximateKm(1112),1000);assert.equal(approximateKm(1678),1500);
 assert.equal(approximateKm(6021),6000);
});
test('street walk refund never refunds purchased directions',()=>{
 const r=newRound('A');openClue(r,'walk');guess(r,'B',at);buyDirection(r,'B');
 const before=r.score;assert.equal(refundWalk(r),true);assert.equal(r.score,before+150);
});
test('fact selection avoids shared topics, subjects and the person clue, including when history is exhausted',()=>{
 const facts=[{text:'a',topic:'space',subjects:['gagarin']},{text:'b',topic:'space',subjects:['satellite']},{text:'c',topic:'nature',subjects:['lake']},{text:'d',topic:'music',subjects:['queen']}];
 for(const history of [[],['a','b','c','d']])for(const n of [0,.3,.8]){
  const pair=selectFacts(facts,history,()=>n,['gagarin']);
  assert.equal(pair.length,2);assert(!pair.includes('a'));
  const rows=pair.map(t=>facts.find(f=>f.text===t));assert.notEqual(rows[0].topic,rows[1].topic);
 }
 assert.deepEqual(selectFacts([{text:'a',topic:'x'},{text:'b',topic:'x'}]),[], 'never silently pair two incompatible clues');
});
