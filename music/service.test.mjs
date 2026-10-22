import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeezerClient, deezerRequest } from './service.js';

function rawTrack(id, overrides = {}) {
  return {
    id, title: `Song ${id}`, title_short: `Song ${id}`,
    artist: { id: 7, name: 'Artist' }, contributors: [{ id: 7, name: 'Artist' }],
    preview: `https://cdn-preview-a.dzcdn.net/stream/${id}.mp3`,
    link: `https://www.deezer.com/track/${id}`,
    album: { id: 1, title: 'Album', cover_medium: 'https://cdn-images.dzcdn.net/cover.jpg' },
    ...overrides,
  };
}

function fixtureRequest(responses) {
  const calls = [];
  const request = async (path, params, options) => {
    calls.push({ path, params, options });
    assert.ok(Object.hasOwn(responses, path), `Unexpected endpoint: ${path}`);
    const response = responses[path];
    if (response instanceof Error) throw response;
    return typeof response === 'function' ? response() : response;
  };
  return { client: createDeezerClient({ request }), calls };
}

test('chart preserves API order, deduplicates answers, skips missing previews and records load time', async () => {
  const { client, calls } = fixtureRequest({
    'chart/0/tracks': { data: [rawTrack(9), rawTrack(2), rawTrack(3, { title: 'Song 9', title_short: 'Song 9' }), rawTrack(4, { preview: '' })] },
  });
  const signal = new AbortController().signal;
  const before = Date.now();
  const result = await client.loadPack({ id: 'all', title: 'All', genreId: 0 }, { signal });
  assert.deepEqual(result.tracks.map(track => track.id), ['dz-9', 'dz-2']);
  assert.equal(result.tracks[0].kind, 'online');
  assert.deepEqual(result.failures, []);
  assert.ok(result.loadedAt >= before && result.loadedAt <= Date.now());
  assert.deepEqual(calls, [{ path: 'chart/0/tracks', params: { limit: 100 }, options: { signal } }]);
});

test('chart requests its genre and returns at most 100 unique playable tracks', async () => {
  const rows = Array.from({ length: 110 }, (_, i) => rawTrack(i + 1));
  const { client, calls } = fixtureRequest({ 'chart/152/tracks': { data: rows } });
  const { tracks } = await client.loadPack({ id: 'rock', title: 'Rock', genreId: 152 });
  assert.equal(tracks.length, 100);
  assert.equal(tracks.at(-1).deezerId, 100);
  assert.equal(calls[0].path, 'chart/152/tracks');
});

test('artist pack merges in round-robin order regardless of response arrival and deduplicates answers', async () => {
  let finishFirst;
  const { client, calls } = fixtureRequest({
    'artist/10/top': () => new Promise(resolve => { finishFirst = resolve; }),
    'artist/20/top': { data: [rawTrack(3), rawTrack(4), rawTrack(5)] },
    'artist/30/top': { data: [rawTrack(6), rawTrack(7, { title: 'Song 1', title_short: 'Song 1' })] },
  });
  const signal = new AbortController().signal;
  const loading = client.loadPack({ id: 'mix', title: 'Mix', artists: [
    { id: 10, name: 'A' }, { id: 20, name: 'B' }, { id: 30, name: 'C' },
  ] }, { signal });
  await Promise.resolve();
  finishFirst({ data: [rawTrack(1), rawTrack(2)] });
  assert.deepEqual((await loading).tracks.map(track => track.deezerId), [1, 3, 6, 2, 4, 5]);
  assert.deepEqual(calls.map(({ params, options }) => ({ params, options })), [
    { params: { limit: 5 }, options: { signal } },
    { params: { limit: 5 }, options: { signal } },
    { params: { limit: 5 }, options: { signal } },
  ]);
});

test('a single artist requests only the top 10 tracks and skips unavailable previews', async () => {
  const { client, calls } = fixtureRequest({ 'artist/10/top': { data: [rawTrack(1, { preview: '' }), rawTrack(2)] } });
  const result = await client.loadPack({ id: 'a', title: 'A', artists: [{ id: 10, name: 'A' }] });
  assert.deepEqual(result.tracks.map(track => track.deezerId), [2]);
  assert.deepEqual(calls[0].params, { limit: 10 });
});

test('artist packs default to the top five per artist and enforce that limit even if the API overfills it', async () => {
  const artists = [{ id: 10, name: 'A' }, { id: 20, name: 'B' }];
  const responses = Object.fromEntries(artists.map(({ id }) => [
    `artist/${id}/top`, { data: Array.from({ length: 12 }, (_, i) => rawTrack(id * 100 + i)) },
  ]));
  const { client, calls } = fixtureRequest(responses);
  const { tracks } = await client.loadPack({ artists });
  assert.deepEqual(calls.map(c => c.params.limit), [5, 5]);
  assert.deepEqual(tracks.map(t => t.deezerId), [1000, 2000, 1001, 2001, 1002, 2002, 1003, 2003, 1004, 2004]);
});

test('an explicit top limit excludes deep cuts, validates limits and still deduplicates collaborations', async () => {
  const artists = [{ id: 10, name: 'A' }, { id: 20, name: 'B' }];
  const responses = {
    'artist/10/top': { data: [rawTrack(1), rawTrack(2), rawTrack(90)] },
    'artist/20/top': { data: [rawTrack(1), rawTrack(3), rawTrack(91)] },
  };
  const { client, calls } = fixtureRequest(responses);
  assert.deepEqual((await client.loadPack({ artists, topLimit: 2 })).tracks.map(t => t.deezerId), [1, 2, 3]);
  assert.deepEqual(calls.map(c => c.params.limit), [2, 2]);
  for (const topLimit of [0, -1, 1.5, '5', 101]) {
    await assert.rejects(client.loadPack({ artists, topLimit }));
  }
  assert.equal(calls.length, 2, 'invalid limits do not issue requests');
});

test('large artist packs retain balance within the 100-track cap', async () => {
  const artists = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Artist ${i + 1}` }));
  const responses = Object.fromEntries(artists.map(({ id }) => [
    `artist/${id}/top`, { data: Array.from({ length: 20 }, (_, i) => rawTrack(id * 100 + i)) },
  ]));
  const { tracks } = await fixtureRequest(responses).client.loadPack({ id: 'mix', artists, topLimit: 20 });
  assert.equal(tracks.length, 100);
  assert.deepEqual(tracks.slice(0, 6).map(track => track.deezerId), [100, 200, 300, 400, 500, 600]);
  const counts = artists.map(({ id }) => tracks.filter(track => Math.floor(track.deezerId / 100) === id).length);
  assert.deepEqual(counts, [17, 17, 17, 17, 16, 16]);
});

test('partial artist errors keep working artists and identify failures', async () => {
  const { client } = fixtureRequest({
    'artist/10/top': new Error('offline'),
    'artist/20/top': { data: [rawTrack(2)] },
  });
  const result = await client.loadPack({ id: 'mix', artists: [{ id: 10, name: 'A' }, { id: 20, name: 'B' }] });
  assert.deepEqual(result.tracks.map(track => track.deezerId), [2]);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /A.*offline/);
});

test('all artist errors reject while successful empty lists stay empty', async () => {
  const artists = [{ id: 10, name: 'A' }, { id: 20, name: 'B' }];
  const { client } = fixtureRequest({ 'artist/10/top': new Error('offline'), 'artist/20/top': new Error('denied') });
  await assert.rejects(client.loadPack({ id: 'mix', artists }), /offline|denied/);
  const empty = fixtureRequest({ 'artist/10/top': { data: [rawTrack(1, { preview: '' })] } });
  assert.deepEqual((await empty.client.loadPack({ id: 'empty', artists: [artists[0]] })).tracks, []);
});

test('chart errors and malformed lists reject instead of pretending the pack is empty', async () => {
  await assert.rejects(fixtureRequest({ 'chart/0/tracks': new Error('offline') }).client.loadPack({ genreId: 0 }), /offline/);
  await assert.rejects(fixtureRequest({ 'chart/0/tracks': {} }).client.loadPack({ genreId: 0 }));
});

test('AbortError from any artist propagates even while another artist is pending', async () => {
  const abort = new DOMException('Cancelled', 'AbortError');
  const { client } = fixtureRequest({
    'artist/10/top': abort,
    'artist/20/top': () => new Promise(() => {}),
  });
  await assert.rejects(client.loadPack({ artists: [{ id: 10, name: 'A' }, { id: 20, name: 'B' }] }), error => error === abort);
});

test('track requests the exact ID, normalizes it, and rejects an unavailable preview', async () => {
  const { client, calls } = fixtureRequest({ 'track/42': rawTrack(42), 'track/43': rawTrack(43, { preview: '' }) });
  const signal = new AbortController().signal;
  assert.equal((await client.track(42, { signal })).id, 'dz-42');
  assert.deepEqual(calls[0], { path: 'track/42', params: {}, options: { signal } });
  await assert.rejects(client.track(43), /preview|недоступ/i);
  await assert.rejects(client.track('../search'));
});

test('searchTracks sends the plain query and limit, preserves order, and removes duplicate or unplayable answers', async () => {
  const { client, calls } = fixtureRequest({ search: { data: [
    rawTrack(9), rawTrack(2, { preview: '' }), rawTrack(3, { title: 'Song 9', title_short: 'Song 9' }), rawTrack(4),
  ] } });
  const signal = new AbortController().signal;
  assert.deepEqual((await client.searchTracks('Би-2 & AC/DC "live"', { signal })).map(track => track.deezerId), [9, 4]);
  assert.deepEqual(calls, [{ path: 'search', params: { q: 'Би-2 & AC/DC "live"', limit: 12 }, options: { signal } }]);
});

test('searchArtists returns actual API results in order and never substitutes a guessed artist', async () => {
  const { client, calls } = fixtureRequest({ 'search/artist': { data: [
    { id: 20, name: 'Different spelling', picture_medium: 'https://example.com/medium.jpg', picture: 'https://example.com/small.jpg' },
    { id: 10, name: 'Another result', picture: 'https://example.com/another.jpg' },
  ] } });
  const signal = new AbortController().signal;
  assert.deepEqual(await client.searchArtists('actual query', { signal }), [
    { id: 20, name: 'Different spelling', picture: 'https://example.com/medium.jpg' },
    { id: 10, name: 'Another result', picture: 'https://example.com/another.jpg' },
  ]);
  assert.deepEqual(calls, [{ path: 'search/artist', params: { q: 'actual query', limit: 8 }, options: { signal } }]);
  assert.deepEqual(await fixtureRequest({ 'search/artist': { data: [] } }).client.searchArtists('unknown'), []);
});

test('already aborted operations never send requests', async () => {
  const controller = new AbortController();
  controller.abort();
  const { client, calls } = fixtureRequest({});
  for (const action of [
    () => client.loadPack({ genreId: 0 }, { signal: controller.signal }),
    () => client.track(42, { signal: controller.signal }),
    () => client.searchTracks('song', { signal: controller.signal }),
    () => client.searchArtists('artist', { signal: controller.signal }),
  ]) await assert.rejects(action(), { name: 'AbortError' });
  assert.deepEqual(calls, []);
});

// Only the browser boundary is replaced; the JSONP lifecycle runs unchanged.
function browserFixture(t) {
  const scripts = [], timers = new Map();
  let nextTimer = 0;
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement(tag) {
      assert.equal(tag, 'script');
      return { remove() { this.removed = true; } };
    },
    head: { appendChild(script) { scripts.push(script); } },
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
    for (const script of scripts) delete globalThis[new URL(script.src).searchParams.get('callback')];
  });
  return { scripts, timers, callback(script) { return new URL(script.src).searchParams.get('callback'); } };
}

test('JSONP uses only the Deezer HTTPS origin, encodes queries and owns output/callback parameters', async t => {
  const browser = browserFixture(t);
  const pending = deezerRequest('/search', { q: 'Би-2 & "live"', limit: 12, output: 'json', callback: 'evil()' });
  const script = browser.scripts[0], url = new URL(script.src);
  assert.equal(url.origin, 'https://api.deezer.com');
  assert.equal(url.pathname, '/search');
  assert.equal(url.searchParams.get('q'), 'Би-2 & "live"');
  assert.equal(url.searchParams.get('limit'), '12');
  assert.equal(url.searchParams.get('output'), 'jsonp');
  const callback = browser.callback(script);
  assert.match(callback, /^[A-Za-z_$][\w$]*$/);
  assert.notEqual(callback, 'evil()');
  globalThis[callback]({ data: [] });
  assert.deepEqual(await pending, { data: [] });
  assert.equal(script.removed, true);
  assert.equal(browser.timers.size, 0);
  assert.doesNotThrow(() => globalThis[callback]({ error: { message: 'late' } }));
  for (const path of ['https://evil.example/search', '//evil.example/search', 'http://api.deezer.com/search', 'https://user:pass@api.deezer.com/search']) {
    await assert.rejects(deezerRequest(path));
  }
  assert.equal(browser.scripts.length, 1);
});

test('simultaneous JSONP requests have unique callbacks and resolve independently', async t => {
  const browser = browserFixture(t);
  const first = deezerRequest('track/1'), second = deezerRequest('track/2');
  const [a, b] = browser.scripts.map(script => browser.callback(script));
  assert.notEqual(a, b);
  globalThis[b]({ id: 2 });
  globalThis[a]({ id: 1 });
  assert.deepEqual(await Promise.all([first, second]), [{ id: 1 }, { id: 2 }]);
  assert.ok(browser.scripts.every(script => script.removed));
  assert.equal(browser.timers.size, 0);
});

test('JSONP rejects API errors and script loading errors, cleaning both up', async t => {
  const browser = browserFixture(t);
  const api = deezerRequest('track/1');
  globalThis[browser.callback(browser.scripts[0])]({ error: { type: 'DataException', message: 'no data', code: 800 } });
  await assert.rejects(api, /no data/);
  const network = deezerRequest('track/2');
  browser.scripts[1].onerror();
  await assert.rejects(network, /Deezer|network|загруз/i);
  assert.ok(browser.scripts.every(script => script.removed));
  assert.equal(browser.timers.size, 0);
  for (const script of browser.scripts) assert.doesNotThrow(() => globalThis[browser.callback(script)]({ id: 99 }));
});

test('JSONP times out at 12 seconds and ignores later responses', async t => {
  const browser = browserFixture(t);
  const pending = deezerRequest('search', { q: 'song' });
  assert.equal(browser.timers.size, 1);
  const timer = [...browser.timers.values()][0];
  assert.equal(timer.delay, 12000);
  timer.fn();
  await assert.rejects(pending, /timeout|timed out|время/i);
  assert.equal(browser.scripts[0].removed, true);
  assert.equal(browser.timers.size, 0);
  assert.doesNotThrow(() => globalThis[browser.callback(browser.scripts[0])]({ data: [] }));
});

test('JSONP supports abort before and during loading and removes the abort listener', async t => {
  const browser = browserFixture(t), controller = new AbortController();
  const remove = t.mock.method(controller.signal, 'removeEventListener');
  const pending = deezerRequest('track/1', {}, { signal: controller.signal });
  controller.abort('cancelled');
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(browser.scripts[0].removed, true);
  assert.equal(browser.timers.size, 0);
  assert.equal(remove.mock.callCount(), 1);
  assert.doesNotThrow(() => globalThis[browser.callback(browser.scripts[0])]({ id: 1 }));
  await assert.rejects(deezerRequest('track/2', {}, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(browser.scripts.length, 1);
});
