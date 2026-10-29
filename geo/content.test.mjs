import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUNTRIES } from './countries.js';
import { FACTS, PEOPLE, OMIT_PEOPLE, MONEY } from './content.js';

const ids = COUNTRIES.map(c => c.id).sort();
const normalize = text => text.normalize('NFKC').toLowerCase().replaceAll('ё', 'е').replace(/[^\p{L}\p{N}]/gu, '');
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const named = name => new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, 'iu');
// Explicit adjective stems catch inflections that exact names/aliases cannot catch.
const demonyms = /(?<!\p{L})(?:российск|русск|украинск|белорусск|беларусск|молдавск|молдовск|польск|поляк|чешск|чех|словацк|венгерск|румынск|болгарск|сербск|хорватск|словенск|боснийск|черногорск|македонск|албанск|греческ|кипрск|мальтийск|итальянск|испанск|португальск|андоррск|французск|монегаск|бельгийск|голландск|нидерландск|люксембургск|немецк|германск|швейцарск|лихтенштейнск|австрийск|британск|английск|ирландск|исландск|норвежск|шведск|финск|финляндск|датск|эстонск|латвийск|латышск|литовск|казахск|казахстанск|узбекск|киргизск|кыргызск|таджикск|туркменск|грузинск|армянск|азербайджанск|турецк|иранск|израильск|иорданск|ливанск|саудовск|эмиратск|катарск|оманск|индийск|пакистанск|непальск|ланкийск|китайск|монгольск|японск|корейск|северокорейск|южнокорейск|вьетнамск|тайск|таиландск|камбоджийск|малайзийск|сингапурск|индонезийск|филиппинск|египетск|марокканск|тунисск|алжирск|сенегальск|ганск|нигерийск|камерунск|эфиопск|кенийск|танзанийск|южноафриканск|малагасийск|намибийск|американск|канадск|мексиканск|кубинск|ямайск|костариканск|панамск|колумбийск|венесуэльск|эквадорск|перуанск|боливийск|бразильск|чилийск|аргентинск|уругвайск|австралийск|новозеландск|фиджийск|папуасск|самоанск)\p{L}*/iu;

test('every country has at least two unique additional facts, with no recycled dossier text', () => {
  assert.deepEqual(Object.keys(FACTS).sort(), ids);
  const old = new Set(COUNTRIES.flatMap(c => c.facts).map(normalize));
  const seen = new Set();
  for (const [id, facts] of Object.entries(FACTS)) {
    assert.ok(Array.isArray(facts) && facts.length >= 2, id);
    for (const fact of facts) {
      assert.equal(typeof fact, 'string', id);
      assert.ok(fact.trim() === fact && fact.length >= 35, `${id}: nonempty readable fact`);
      const key = normalize(fact);
      assert.ok(!old.has(key), `${id}: recycled fact`);
      assert.ok(!seen.has(key), `${id}: duplicate fact`);
      seen.add(key);
      assert.doesNotMatch(fact, /https?:|<[^>]+>|сам(?:ый|ая|ое|ые|ых)\s|крупнейш|старейш|больше всех|до сих пор|на сегодняшний день/iu, id);
    }
  }
});

test('facts and money do not spell out the answer or use country demonyms', () => {
  for (const c of COUNTRIES) {
    for (const text of [...FACTS[c.id], MONEY[c.id]]) {
      for (const name of [c.name, ...c.aliases]) {
        assert.doesNotMatch(text, named(name), `${c.id}: answer ${name}`);
      }
      assert.doesNotMatch(text, demonyms, `${c.id}: demonym`);
    }
  }
});

test('person replacements are complete tuples with achievements and valid unique country ids', () => {
  const names = new Set();
  for (const [id, tuple] of Object.entries(PEOPLE)) {
    assert.ok(ids.includes(id), id);
    assert.ok(Array.isArray(tuple), id);
    assert.equal(tuple.length, 3, id);
    for (const value of tuple) {
      assert.equal(typeof value, 'string', id);
      assert.ok(value.trim() === value && value.length > 0, id);
      assert.doesNotMatch(value, /https?:|<[^>]+>/iu, id);
    }
    assert.ok(tuple[1].length >= 20, `${id}: meaningful achievement`);
    assert.ok(!names.has(tuple[0]), `${id}: repeated person`);
    names.add(tuple[0]);
    assert.ok(!OMIT_PEOPLE.includes(id), `${id}: replacement is also omitted`);
  }
  for (const id of ['BY', 'MK', 'LV', 'UZ', 'NP', 'TZ', 'IR']) {
    assert.match(PEOPLE[id][1], /родил(?:ся|ась) здесь/u, `${id}: birthplace is not nationality`);
  }
});

test('omissions are unique real country ids, including unfair birthplace/ancestry associations', () => {
  assert.ok(Array.isArray(OMIT_PEOPLE));
  assert.equal(new Set(OMIT_PEOPLE).size, OMIT_PEOPLE.length);
  for (const id of OMIT_PEOPLE) assert.ok(ids.includes(id), id);
  for (const id of ['BO', 'PG', 'MG', 'SM', 'AD', 'LI', 'WS', 'JO', 'SA', 'ID']) assert.ok(OMIT_PEOPLE.includes(id), id);
});

test('money is a complete text-only map without identifying unit names or old currency histories', () => {
  assert.deepEqual(Object.keys(MONEY).sort(), ids);
  for (const [id, label] of Object.entries(MONEY)) {
    assert.equal(typeof label, 'string', id);
    assert.ok(label.trim() === label && label.length > 0, id);
    assert.doesNotMatch(label, /https?:|\.(?:jpg|png|svg)|банкнот|купюр|боливиано|афгани|сомони|·|до \d/iu, id);
  }
  assert.equal(MONEY.BO, '100 сентаво = 1 денежная единица');
  assert.equal(MONEY.TJ, '100 дирамов = 1 денежная единица');
  assert.equal(MONEY.EC, 'Доллар США');
  assert.equal(MONEY.BG, 'Евро');
});

test('source ledger covers every country and states verification limits', () => {
  const sources = readFileSync(new URL('./content-sources.md', import.meta.url), 'utf8');
  for (const id of ids) assert.match(sources, new RegExp(`^\\| ${id} \\| .+https://`, 'm'), id);
  assert.match(sources, /не.*провер/iu);
});
