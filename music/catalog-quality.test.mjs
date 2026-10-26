import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectCollection } from './collection.js';
import { normalize } from './catalog.js';

const data = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url), 'utf8'));
const people = genre => new Set(selectCollection(data, genre).tracks.flatMap(t => t.artistNames.map(normalize)));

test('Dead Inside contains exactly the performers requested by the players, including every guest', () => {
  const approved = ['Baby Cute', 'CUPSIZE', 'Boulevard Depo', 'Lil Peep', 'ONDA ANDAR', 'zhanulka', 'Кишлак', 'дора', 'Монеточка', 'Папин Олимпос', 'тёмный принц', 'Три дня дождя'].map(normalize);
  assert.deepEqual([...people('dead-inside')].sort(), approved.sort());
});

test('K-pop and US Hip-Hop cannot become collections of unrelated pop collaborations', () => {
  for (const name of ['Snoop Dogg', 'Coldplay', 'Jason Derulo', 'Alok', 'The Weeknd', 'Megan Thee Stallion', 'Tame Impala']) {
    assert.ok(!people('kpop').has(normalize(name)), `${name} is outside the K-pop selection`);
  }
  for (const name of ['TWICE', 'Jungkook', 'Andrea Bocelli', 'HUGEL', 'Maroon 5', 'Luciano']) {
    assert.ok(!people('us-hiphop').has(normalize(name)), `${name} is outside the US Hip-Hop selection`);
  }
  for (const name of ['Metro Boomin', 'Travis Scott', 'Kanye West', 'Lil Nas X', 'NLE Choppa']) {
    assert.ok(people('us-hiphop').has(normalize(name)), `${name} must remain represented`);
  }
});

test('SoundCloud Hits keeps its rap core and excludes crossover pop', () => {
  const artists = people('soundcloud');
  for (const name of ['XXXTentacion', 'Lil Uzi Vert', 'Juice WRLD', 'Lil Peep']) assert.ok(artists.has(normalize(name)));
  for (const name of ['Justin Bieber', '24kGoldn', 'The Kid LAROI']) assert.ok(!artists.has(normalize(name)));
});
