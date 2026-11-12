import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectCollection } from './collection.js';
import { normalize } from './catalog.js';
import { createGame } from './game.js';

const data = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url), 'utf8'));
const people = genre => new Set(selectCollection(data, genre).tracks.flatMap(t => t.artistNames.map(normalize)));

test('Street 36 centers on Scriptonite and A$XV Prince and keeps guests within the brief', () => {
  const artists = people('street-36');
  const { tracks } = selectCollection(data, 'street-36');
  const leads = tracks.map(t => t.artistNames[0]);
  assert.ok(tracks.every(track => track.artistNames.every((name, i) => name !== '104' || track.artistIds[i] === '11296432')));
  for (const name of ['Скриптонит', 'A$XV Prince']) assert.ok(leads.filter(lead => lead === name).length >= 15);
  for (const name of ['Truwer', '104', 'Gruppa Skryptonite', 'ATL']) assert.ok(artists.has(normalize(name)));
  for (const name of ['тёмный принц', 'Иван Дорн', 'Miyagi', 'Эндшпиль']) assert.ok(!artists.has(normalize(name)));
});

test('New School and Global Pop exclude the requested artists even in guest credits', () => {
  const newWave = people('new-wave');
  assert.ok(selectCollection(data, 'new-wave').tracks.length < 200);
  for (const name of ['i61', 'High Self', 'HELLOVERCAVI', 'GBAN', 'Слава КПСС']) assert.ok(!newWave.has(normalize(name)));
  assert.ok(newWave.has(normalize('тёмный принц')));
  const globalPop = people('modern-pop');
  for (const name of ['Juicy J', 'Justice', 'Khalid']) assert.ok(!globalPop.has(normalize(name)));
});

test('On Repeat features the three requested artists and supports ten rounds', () => {
  const { tracks } = selectCollection(data, 'repeat-hits');
  for (const name of ['Barns Courtney', 'Imagine Dragons', 'The Weeknd']) {
    assert.ok(tracks.filter(t => t.artistNames[0] === name).length >= 10);
  }
  assert.equal(createGame(tracks, { rounds: 10, maxPerArtist: 2, random: () => 0.999999 }).queue.length, 10);
});

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
