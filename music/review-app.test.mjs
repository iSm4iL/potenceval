import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const original = readFileSync(new URL('./review.html', import.meta.url), 'utf8');
function openReview(html, storage = new Map()) {
  const nodes = new Map(), downloads = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: id === 'filter' ? 'all' : '', dataset: {}, innerHTML: '', textContent: '',
      events: {}, addEventListener(type, fn) { this.events[type] = fn; }, querySelectorAll: () => [], click() {}, remove() {} });
    return nodes.get(id);
  };
  for (const id of ['review-catalog', 'review-state']) node(id).textContent = html.match(new RegExp(`id="${id}">([\\s\\S]*?)<\\/script>`))[1];
  const document = { getElementById: node, body: { append() {} }, createElement: () => node('download-link'),
    documentElement: { cloneNode() {
      const seed = { textContent: node('review-state').textContent };
      return { querySelector: id => id === '#review-state' ? seed : {}, get outerHTML() {
        return html.replace(/(id="review-state">)[\s\S]*?(<\/script>)/, (_, a, b) => a + seed.textContent + b);
      } };
    } } };
  const context = vm.createContext({ document, window: { scrollY: 0, scrollTo() {} }, Blob,
    URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    setTimeout: () => 0, clearTimeout() {}, Date, console,
  });
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script, context);
  const click = (scope, key, action) => {
    const container = { dataset: { scope, key } }, button = { dataset: { action }, closest: () => container };
    node('artists').events.click({ preventDefault() {}, target: { closest: () => button } });
  };
  return { node, context, downloads, click, data: JSON.parse(node('review-catalog').textContent), storage };
}

test('standalone editor boots with every collection and the requested initial choices', () => {
  const app = openReview(original);
  assert.equal(app.data.collections.length, 13);
  assert.equal((app.node('collections').innerHTML.match(/data-collection=/g) || []).length, 13);
  const state = JSON.parse([...app.storage.values()][0]);
  assert.equal(state.artists['new-wave']['moneyken'].status, 'keep');
  assert.equal(state.artists['new-wave']['платина'].more, true);
  assert.equal(state.artists['new-wave']['loboda'].status, 'remove');
  assert.equal(state.artists['mom-pop'], undefined);
  assert.match(app.node('artists').innerHTML, /data-status="remove"/);
});

test('track and artist edits survive HTML export and reopening, with safe comments', async () => {
  const app = openReview(original);
  const first = app.data.collections[0].tracks[0];
  app.click('track', first.id, 'keep');
  app.click('track', first.id, 'similar');
  app.node('artists').events.input({ target: { dataset: { note: first.id }, value: '</script><img src=x onerror=alert(1)>' } });
  app.node('saveHtml').onclick();
  const exported = await app.downloads[0].text();
  assert.doesNotMatch(exported, /<img src=x onerror=alert\(1\)>/);
  const restored = openReview(exported);
  const state = JSON.parse([...restored.storage.values()][0]);
  assert.equal(state.tracks['new-wave'][first.id].status, 'keep');
  assert.equal(state.tracks['new-wave'][first.id].similar, true);
  assert.equal(state.tracks['new-wave'][first.id].note, '</script><img src=x onerror=alert(1)>');
  restored.click('artist', 'moneyken', 'remove');
  const updated = JSON.parse([...restored.storage.values()][0]);
  for (const t of restored.data.collections[0].tracks.filter(t => t.artistNames.includes('MONEYKEN'))) {
    assert.equal(updated.tracks['new-wave'][t.id].status, 'remove');
  }
});

test('every collection can be selected and JSON export retains track context', async () => {
  const app = openReview(original);
  for (const collection of app.data.collections) {
    app.node('collections').events.click({ target: { closest: () => ({ dataset: { collection: collection.id } }) } });
    assert.equal(app.node('collectionTitle').textContent, collection.title);
  }
  app.node('saveJson').onclick();
  const exported = JSON.parse(await app.downloads[0].text());
  assert.equal(exported.collections.length, 13);
  assert.ok(exported.collections[0].tracks.some(t => t.status === 'remove' && t.title && t.artistNames.length));
});

test('bulk flags follow individual edits and a later bulk click clears the selection', () => {
  const app = openReview(original);
  const tracks = app.data.collections[0].tracks.filter(t => t.artistNames.includes('MONEYKEN'));
  app.click('artist', 'moneyken', 'more');
  app.click('artist', 'moneyken', 'more');
  for (const track of tracks) app.click('track', track.id, 'more');
  const choices = JSON.parse([...app.storage.values()][0]);
  assert.equal(choices.artists['new-wave'].moneyken.more, true);
  app.click('artist', 'moneyken', 'more');
  const cleared = JSON.parse([...app.storage.values()][0]);
  assert.equal(cleared.artists['new-wave'].moneyken.more, false);
  assert.ok(tracks.every(t => !cleared.tracks['new-wave'][t.id].more));
});
