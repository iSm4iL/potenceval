import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCollection, createCatalogClient } from './collection.js';
import { snapshotTrack } from './catalog.js';

const now = '2026-10-22T12:00:00Z';
const source = { id: 'chart', title: 'Top 100', url: 'https://music.apple.com/us/playlist/test', kind: 'apple-chart', status: 'fresh', updatedAt: now };
const track = { id: 'dz-1', deezerId: 1, title: 'Song', artist: 'Artist', artistIds: ['2'], artistNames: ['Artist'], answerKey: '2|song', workKey: 'work', genres: ['indie'], currentGenres: ['indie'], sources: [{ id: 'chart', position: 3, genres: ['indie'] }] };
const catalog = { version: 1, generatedAt: now, sources: [source], tracks: [track] };
test('filters genre and attaches evidence without preview URLs', () => {
  const result = selectCollection(catalog, 'indie', 'hits', Date.parse(now));
  assert.equal(result.tracks.length, 1);
  assert.equal(result.tracks[0].evidence[0].position, 3);
  assert.equal(result.tracks[0].evidence[0].title, 'Top 100');
  assert.equal(selectCollection(catalog, 'classics').tracks.length, 0);
  assert.equal(result.counts.indie, 1);
});
test('current mode excludes stale charts and old snapshots, retains historical hits', () => {
  const stale = { ...catalog, sources: [{ ...source, status: 'stale' }] };
  assert.equal(selectCollection(stale, 'indie', 'current', Date.parse(now)).tracks.length, 0);
  assert.equal(selectCollection(stale, 'indie', 'hits').tracks.length, 1);
  assert.equal(selectCollection(catalog, 'indie', 'current', Date.parse('2026-10-28')).tracks.length, 0);
});
test('rejects unsupported catalogs and ignores tracks with missing or unsafe evidence', () => {
  assert.throws(() => selectCollection({}), /каталог/i);
  assert.equal(selectCollection({ ...catalog, sources: [{ ...source, url: 'javascript:alert(1)' }] }, 'indie').tracks.length, 0);
  assert.equal(selectCollection({ ...catalog, tracks: [{ ...track, sources: [] }] }, 'indie').tracks.length, 0);
});
test('a fresh chart cannot lend freshness to another chart genre', () => {
  const mixed = { ...catalog, sources: [source, { ...source, id: 'old', status: 'stale' }], tracks: [{ ...track, currentGenres: ['indie', 'ru-rap'], sources: [...track.sources, { id: 'old', genres: ['ru-rap'] }] }] };
  assert.equal(selectCollection(mixed, 'ru-rap', 'current', Date.parse(now)).tracks.length, 0);
  assert.equal(selectCollection(mixed, 'indie', 'current', Date.parse(now)).tracks.length, 1);
});
test('saved rounds retain work identity and evidence but not temporary audio URLs', () => {
  const t = selectCollection(catalog, 'indie').tracks[0];
  const saved = snapshotTrack({ ...t, preview: 'https://test.dzcdn.net/a.mp3' });
  assert.equal(saved.workKey, 'work');
  assert.deepEqual(saved.evidence, t.evidence);
  assert.equal(saved.preview, undefined);
});
test('client reuses metadata until explicitly refreshed, forwards cancellation', async () => {
  let requests = 0, time = 0;
  const client = createCatalogClient({ now: () => time, fetcher: async (url, options) => { requests++; assert.equal(options.cache, 'no-cache'); return { ok: true, json: async () => catalog }; } });
  await client.load('indie'); await client.load('classics');
  assert.equal(requests, 1);
  await client.load('indie', { refresh: true });
  assert.equal(requests, 2);
  time = 300001;
  await client.load('indie');
  assert.equal(requests, 3);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(client.load('indie', { signal: controller.signal }), { name: 'AbortError' });
});
