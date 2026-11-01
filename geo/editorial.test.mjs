import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRIES as RAW} from './countries.js';
import {FACT_PAIRS,PERSON_ROSTER,editorialFacts} from './editorial.js';
import {localizeCountry} from './i18n.js';
import {selectFacts} from './game.js';
const ids=RAW.map(c=>c.id).sort();
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
test('curated runtime is complete, never revives legacy facts or people and has compatible pairs',()=>{
 assert.deepEqual(Object.keys(FACT_PAIRS).sort(),ids);
 for(const raw of RAW)for(const locale of ['ru','en']){
  const c=localizeCountry(raw,locale),entries=editorialFacts(c.id,locale);
  assert.deepEqual(c.factEntries,entries);assert.deepEqual(c.facts,entries.map(f=>f.text));
  assert.equal(c.person===null,!PERSON_ROSTER[c.id],c.id);
  for(const history of [[],c.facts])for(const n of [0,.3,.9]){
   const pair=selectFacts(entries,history,()=>n,c.personSubjects);assert.equal(pair.length,2,c.id);
   const [a,b]=pair.map(text=>entries.find(e=>e.text===text));assert.notEqual(a.topic,b.topic,c.id);
   assert(!a.subjects.some(s=>b.subjects.includes(s)),c.id);
  }
  for(const text of c.facts){
   assert.doesNotMatch(text,/Азиатск.{0,12}игр|Asian Games|1966|Эз-Зубара|Когурё/iu,c.id);
   if(locale==='ru')for(const name of [raw.name,...raw.aliases])assert.doesNotMatch(text,new RegExp(`(?<![\\p{L}])${escape(name)}(?![\\p{L}])`,'iu'),c.id);
   if(c.person)assert(!text.includes(c.person[0]),c.id);
  }
 }
});
test('footballers are the two explicitly requested worldwide exceptions',()=>{
 const players=Object.entries(PERSON_ROSTER).filter(([,p])=>/footballer/i.test(p[3]));
 assert.deepEqual(players.map(([id])=>id).sort(),['AR','PT']);
 for(const [id,p] of Object.entries(PERSON_ROSTER)){
  assert(ids.includes(id));assert.equal(p.length,6);assert(p.slice(0,4).every(s=>typeof s==='string'&&s.length>=3));
 }
});
