import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES } from './countries.js';
import { FACTS, PEOPLE, OMIT_PEOPLE, MONEY } from './content.js';
import { WORLD } from './atlas.js';
import { PROFILES_EN, FACTS_EN } from './content-en.js';
import { localizeCountry, localizeWorld } from './i18n.js';
import { nameIndex, matchCountry, currencyPrice, selectFacts } from './game.js';
import { banknoteFor } from './banknotes.js';

const ids = COUNTRIES.map(c => c.id).sort();
const escaped = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = text => new RegExp(`(?<![\\p{L}\\p{N}])${escaped(text)}(?![\\p{L}\\p{N}])`, 'iu');

test('all 112 dossiers retain all four facts in both languages and complete English clue text', () => {
  assert.equal(COUNTRIES.length, 112);
  assert.deepEqual(Object.keys(PROFILES_EN).sort(), ids);
  assert.deepEqual(Object.keys(FACTS_EN).sort(), ids);
  for (const raw of COUNTRIES) {
    const ru = localizeCountry(raw, 'ru'), en = localizeCountry(raw, 'en');
    assert.deepEqual(ru.facts, [...raw.facts, ...FACTS[raw.id]]);
    assert.equal(en.facts.length, ru.facts.length, raw.id);
    assert.equal(new Set(en.facts).size, 4, raw.id);
    for (const text of [en.name, en.food[0], en.currency, en.phrase[1], ...en.facts, ...(en.person?.slice(0, 2) || [])]) {
      assert.equal(typeof text, 'string', `${raw.id}: missing translation`);
      assert.ok(text.length > 1, raw.id);
      assert.doesNotMatch(text, /\p{Script=Cyrillic}|undefined|https?:|<[^>]+>/u, raw.id);
    }
    assert.equal(en.food[1], raw.food[1], `${raw.id}: preserve photo key`);
    assert.equal(en.person === null, OMIT_PEOPLE.includes(raw.id), raw.id);
    if (en.person) assert.equal(en.person[2], (PEOPLE[raw.id] || raw.person)[2]);
    // Every translated fact participates in the same rotation, including the additional facts.
    const first = selectFacts(en.facts, [], () => 0);
    assert.equal(new Set([...first, ...selectFacts(en.facts, first, () => 0)]).size, 4, raw.id);
  }
});

test('English facts, dishes, people and money do not spell out their own country or its aliases', () => {
  const demonyms = { RU:'Russian', UA:'Ukrainian', BY:'Belarusian', MD:'Moldovan', PL:'Polish', CZ:'Czech', SK:'Slovak', HU:'Hungarian', RO:'Romanian', BG:'Bulgarian', RS:'Serbian', HR:'Croatian', SI:'Slovenian', BA:'Bosnian', ME:'Montenegrin', MK:'Macedonian', AL:'Albanian', GR:'Greek', CY:'Cypriot', MT:'Maltese', IT:'Italian', SM:'Sammarinese', ES:'Spanish', PT:'Portuguese', AD:'Andorran', FR:'French', MC:'Monégasque', BE:'Belgian', NL:'Dutch', LU:'Luxembourgish', DE:'German', CH:'Swiss', LI:'Liechtensteiner', AT:'Austrian', GB:'British', IE:'Irish', IS:'Icelandic', NO:'Norwegian', SE:'Swedish', FI:'Finnish', DK:'Danish', EE:'Estonian', LV:'Latvian', LT:'Lithuanian', KZ:'Kazakh', UZ:'Uzbek', KG:'Kyrgyz', TJ:'Tajik', TM:'Turkmen', GE:'Georgian', AM:'Armenian', AZ:'Azerbaijani', TR:'Turkish', IR:'Iranian', IL:'Israeli', JO:'Jordanian', LB:'Lebanese', SA:'Saudi', AE:'Emirati', QA:'Qatari', OM:'Omani', IN:'Indian', PK:'Pakistani', NP:'Nepali', LK:'Sri Lankan', CN:'Chinese', MN:'Mongolian', JP:'Japanese', KR:'Korean', KP:'Korean', VN:'Vietnamese', TH:'Thai', KH:'Cambodian', MY:'Malaysian', SG:'Singaporean', ID:'Indonesian', PH:'Filipino', EG:'Egyptian', MA:'Moroccan', TN:'Tunisian', DZ:'Algerian', SN:'Senegalese', GH:'Ghanaian', NG:'Nigerian', CM:'Cameroonian', ET:'Ethiopian', KE:'Kenyan', TZ:'Tanzanian', ZA:'South African', MG:'Malagasy', NA:'Namibian', US:'American', CA:'Canadian', MX:'Mexican', CU:'Cuban', JM:'Jamaican', CR:'Costa Rican', PA:'Panamanian', CO:'Colombian', VE:'Venezuelan', EC:'Ecuadorian', PE:'Peruvian', BO:'Bolivian', BR:'Brazilian', CL:'Chilean', AR:'Argentinian', UY:'Uruguayan', AU:'Australian', NZ:'New Zealander', FJ:'Fijian', PG:'Papua New Guinean', WS:'Samoan' };
  for (const raw of COUNTRIES) {
    const c = localizeCountry(raw, 'en');
    for (const text of [...c.facts, c.currency, c.food[0], ...(c.person?.slice(0, 2) || [])]) {
      for (const alias of [c.name, ...raw.aliases]) assert.doesNotMatch(text, word(alias), `${c.id}: ${alias}`);
      assert.doesNotMatch(text, word(demonyms[c.id]), `${c.id}: demonym`);
    }
  }
});

test('all countries accept Russian and English names and aliases in either interface language', () => {
  for (const lang of ['ru', 'en']) {
    const countries = COUNTRIES.map(c => localizeCountry(c, lang));
    const world = localizeWorld(WORLD, lang);
    const index = nameIndex([...WORLD, ...world], countries);
    for (const c of countries) for (const name of [c.name, ...c.aliases]) assert.equal(matchCountry(name, index), c.id, name);
    assert.equal(matchCountry('United Arab Emirates', index), 'AE');
    assert.equal(matchCountry('United States of America', index), 'US');
    assert.equal(matchCountry('Turkey', index), 'TR');
    assert.equal(matchCountry('США', index), 'US');
    assert.equal(world.length, WORLD.length);
    world.forEach((w, i) => assert.deepEqual(w.slice(2), WORLD[i].slice(2)));
  }
});

test('translations preserve currency prices, reviewed snippets and birthplace qualifications', () => {
  const prices = Object.fromEntries(COUNTRIES.map(c => [c.id, currencyPrice(MONEY[c.id], Object.values(MONEY))]));
  for (const lang of ['ru', 'en']) for (const raw of COUNTRIES) {
    const c = localizeCountry(raw, lang);
    assert.equal(currencyPrice(MONEY[c.id], Object.values(MONEY)), prices[c.id]);
    assert.equal(banknoteFor(c.id, MONEY[c.id]), banknoteFor(raw.id, MONEY[raw.id]));
  }
  for (const id of ['BY','MK','LV','UZ','NP','TZ','IR']) {
    assert.match(localizeCountry(COUNTRIES.find(c => c.id === id), 'en').person[1], /born here/u, id);
  }
  assert.equal(localizeCountry(COUNTRIES.find(c => c.id === 'CZ'), 'en').currency, 'Koruna');
  assert.equal(localizeCountry(COUNTRIES.find(c => c.id === 'ID'), 'en').currency, 'Rupiah');
});
