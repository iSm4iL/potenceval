import test from 'node:test';
import assert from 'node:assert/strict';
import { searchTracks, combineSuggestions, searchArtistOptions, artistOptions, combineArtistSuggestions } from './catalog.js';

const track = (id, title, artist, artistId = id) => ({ id: `dz-${id}`, title, artist, artistIds: [String(artistId)], artistNames: [artist], answerKey: `${artistId}|${title}` });
const songs = [track(1, 'Nothing Else Matters', 'Metallica'), track(2, 'Another Brick in the Wall', 'Pink Floyd'), track(3, 'Перелётная птица', 'Кристина Орбакайте'), track(4, 'Bohemian Rhapsody', 'Queen')];

test('song search understands typos, swapped letters and transliteration', () => {
  for (const [query, id] of [['металика', 'dz-1'], ['пинк флойд', 'dz-2'], ['kristina orbakaite', 'dz-3'], ['перелетная птциа', 'dz-3'], ['Nothing Else Maters', 'dz-1'], ['квин', 'dz-4']]) {
    assert.equal(searchTracks(songs, query)[0]?.id, id, query);
  }
  assert.deepEqual(searchTracks(songs, 'бессмысленный запрос'), []);
  assert.deepEqual(searchTracks(songs, '##'), []);
});

test('exact spelling ranks ahead of approximate matches and stable local answers remain first', () => {
  const exact = track(5, 'Maters', 'Other');
  assert.equal(searchTracks([songs[0], exact], 'Maters')[0].id, exact.id);
  assert.equal(combineSuggestions([songs[0]], [track(6, 'Nothing Else Maters', 'Cover')], 'nothing else maters')[0].id, songs[0].id);
});

test('artist options contain no song titles and deduplicate by artist identity, including collaborators', () => {
  const options = artistOptions([...songs, track(8, 'One', 'Metallica', 1), { ...track(9, 'Duet', 'A, B'), artistIds: ['30', '31'], artistNames: ['A', 'B'] }]);
  assert.equal(options.filter(a => a.name === 'Metallica').length, 1);
  assert.ok(options.some(a => a.artistId === '31' && a.name === 'B'));
  assert.ok(options.every(a => a.kind === 'artist' && !('title' in a)));
  assert.equal(searchArtistOptions(options, 'металика')[0]?.name, 'Metallica');
  assert.equal(searchArtistOptions(options, 'пинк флойд')[0]?.name, 'Pink Floyd');
});

test('familiar Russian names find classic rock bands and repeated guesses do not hide new options', () => {
  const bands = artistOptions(['The Beatles', 'Deep Purple', 'Iron Maiden', "Guns N’ Roses"].map((name, i) => track(i + 20, 'Song', name)));
  for (const [query, expected] of [['битлз', 'The Beatles'], ['дипперпл', 'Deep Purple'], ['айрон мейден', 'Iron Maiden'], ['ганз энд роузес', 'Guns N’ Roses']]) assert.equal(searchArtistOptions(bands, query)[0]?.name, expected, query);
  const options = artistOptions(Array.from({length:12}, (_,i) => track(i + 30, 'Song', `Band ${i}`)));
  const tried = options.slice(0, 8).map(a => a.id);
  assert.equal(combineArtistSuggestions(options, [], 'Band', tried).length, 4);
});
