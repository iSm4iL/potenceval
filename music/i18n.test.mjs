import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function inLanguage(language, code) {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    globalThis.localStorage = { getItem: () => '${language}' };
    ${code}
  `], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
}

test('English collections and restored Russian titles use the local language', () => {
  inLanguage('en', `
    const { PACKS, localizedPackTitle } = await import('./music/catalog.js');
    assert.ok(PACKS.every(p => !/[А-Яа-яЁё]/.test(p.title + p.description)));
    assert.equal(localizedPackTitle('new-wave', 'Новая школа'), 'New school');
    assert.equal(localizedPackTitle('ru-rap', 'Русский рэп · Сейчас в чартах'), 'Russian rap · In the charts');
    assert.equal(localizedPackTitle('artist-42', 'Björk'), 'Björk');
    assert.match(localizedPackTitle('drill', '', 'current'), /In the charts$/);
  `);
});

test('Russian clients localize English room titles and retain artist names', () => {
  inLanguage('ru', `
    const { localizedPackTitle } = await import('./music/catalog.js');
    assert.equal(localizedPackTitle('new-wave', 'New school'), 'Новая школа');
    assert.equal(localizedPackTitle('ru-rap', 'Russian rap · In the charts'), 'Русский рэп · Сейчас в чартах');
    assert.equal(localizedPackTitle('artist-42', 'Björk'), 'Björk');
  `);
});

test('English feedback and audio/catalog failures are localized', () => {
  inLanguage('en', `
    const { resultPresentation } = await import('./music/feedback.js');
    for (let step = 0; step < 6; step++) {
      for (const won of [true, false]) {
        assert.doesNotMatch(resultPresentation({ won, step, points: 100 }).label, /[А-Яа-яЁё]/);
      }
    }
    const { selectCollection } = await import('./music/collection.js');
    assert.throws(() => selectCollection(null, 'new-wave'), /catalog/i);
    const { AudioPlayer } = await import('./music/audio.js');
    await assert.rejects(new AudioPlayer().load({ preview: '' }), /preview/i);
  `);
});

async function renderInterfaceStates() {
  const vm = await import('node:vm');
  const fs = await import('node:fs');
  const { t, lang } = await import('./shared/i18n.js');
  const catalog = await import('./music/catalog.js');
  const game = await import('./music/game.js');
  const feedback = await import('./music/feedback.js');
  const multiplayerGame = await import('./music/multiplayer-game.js');
  const nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, {
      innerHTML: '', textContent: '', hidden: false, disabled: false, dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      querySelector: node, querySelectorAll: () => [], after() {}, append() {}, remove() {},
      setAttribute(key, value) { this[key] = value; }, getAttribute(key) { return this[key]; }, removeAttribute(key) { delete this[key]; },
      addEventListener() {}, dispatchEvent() {}, focus() {}, close() {}, showModal() {}, insertAdjacentHTML() {},
    });
    return nodes.get(key);
  };
  const tracks = Array.from({ length: 5 }, (_, i) => ({ id: `dz-${i + 1}`, deezerId: i + 1, title: `Song ${i + 1}`, artist: `Artist ${i + 1}`, artistIds: [String(i + 1)], artistNames: [`Artist ${i + 1}`], answerKey: `${i + 1}|song ${i + 1}` }));
  const sources = JSON.parse(fs.readFileSync('music/data/catalog.json', 'utf8')).sources;
  tracks[0].evidence = sources.map(source => ({ title: source.title, url: source.url, kind: source.kind, date: source.updatedAt, position: 2, period: 'Похожие знакомые песни', stale: true }));
  const outputs = [];
  const saved = new Map();
  const context = {
    ...catalog, ...game, ...feedback, ...multiplayerGame, t, lang, tracks, outputs, Event,
    $: node, esc: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
    LS: { get: key => saved.get(key) || null, set: (key, value) => saved.set(key, value) },
    document: { querySelectorAll: () => [], createElement: () => node(Symbol()), body: node('body'), head: node('head') },
    AudioPlayer: class { setVolume() {} }, createDeezerClient: () => ({}), createCatalogClient: () => ({}),
    multiplayer: { active: false, loading: false },
    setTimeout, clearTimeout, queueMicrotask, URL,
    location: { href: 'https://example.com/music/' }, history: { replaceState() {} }, me: { pid: 'p0' },
    MutationObserver: class { observe() {} }, reportPlaybackError() {},
  };
  vm.createContext(context);
  let source = fs.readFileSync('music/app.js', 'utf8').replace(/^import .*\r?\n/gm, '');
  source = source.slice(0, source.indexOf("$('#artistInput').oninput ="));
  vm.runInContext(source + `
    pool = tracks; availableRounds = [5, 10, 20]; renderSetup();
    outputs.push(stage.innerHTML);
    for (const answerMode of ['track', 'artist']) {
      state = createGame(tracks, { rounds: 1, answerMode, random: () => .999 });
      state.packId = 'new-wave'; state.packTitle = 'Новая школа';
      renderRound(); outputs.push(stage.innerHTML);
      ready = true; busy = false; heard = true; updateControls();
      outputs.push($('#playBtn')['aria-label']);
      if ($('#playBtn').disabled || $('#answerInput').disabled || $('#skipBtn').disabled || $('#surrenderBtn').disabled) throw new Error('Loaded controls remain disabled');
      const answer = trackById(state.queue[0]);
      showSuggestions(answerMode === 'artist' ? artistOptions(tracks) : tracks, '');
      outputs.push($('#suggestions').innerHTML);
      selectedTrack = answer; updateControls();
      if ($('#guessBtn').disabled) throw new Error('Selected answer cannot be submitted');
      const wrong = tracks.find(track => track.id !== answer.id);
      state = answerMode === 'artist' ? guessArtist(state, artistOptions([wrong])[0]) : guess(state, wrong);
      renderRound(); outputs.push(stage.innerHTML);
      state = answerMode === 'artist' ? guessArtist(state, artistOptions([answer])[0]) : guess(state, answer);
      renderReveal(answer); outputs.push(stage.innerHTML);
      state = nextRound(state); renderSummary(); outputs.push(stage.innerHTML);
      if (!LS.get('music.online.recent').includes(answer.id)) throw new Error('Played tracks were not remembered');
    }
  `, context);
  let onState;
  context.createNet = options => { onState = options.onState; return {}; };
  source = fs.readFileSync('music/multiplayer.js', 'utf8').replace(/^import .*\r?\n/gm, '').replace('export function', 'function').replaceAll('import.meta.url', "'https://example.com/music/multiplayer.js'");
  // Use a separate context because both UI modules declare their own stage/settings.
  const multiplayerContext = vm.createContext({ ...context });
  vm.runInContext(source + `
    createMultiplayer({ getMatch() {}, getSettings() {}, stopGame() {}, showHome() {}, showGame() {}, verifyTrack() {} });
  `, multiplayerContext);
  outputs.push([...nodes.values()].find(n => n.innerHTML.includes('id="friendTitle"')).innerHTML);
  const players = [{ id: 'p0', name: 'Alex', score: 1500, online: true, participating: true, won: true, done: true, rank: 1, multiplier: 1.5, points: 1500 }, { id: 'p1', name: 'Robin', score: 0, online: true, participating: true }];
  for (const phase of ['lobby', 'loading', 'round', 'reveal', 'summary']) {
    onState({ phase, code: 'ABCDE', hostId: 'p0', players, settings: { packId: 'new-wave', packTitle: 'Новая школа', rounds: 5 }, round: phase, index: 0, total: 5, nextMultiplier: 1.25 });
    outputs.push(node('#musicRoom').innerHTML, node('#stage').innerHTML);
  }
  source = fs.readFileSync('music/report.js', 'utf8').replace(/^import .*\r?\n/gm, '').replace('export const', 'const');
  node('#stage').dataset.reportTrack = JSON.stringify({ id: 1, artist: 'Artist', title: 'Song' });
  vm.runInContext(source + '\nopen();', vm.createContext({ ...context }));
  outputs.push([...nodes.values()].find(n => n.innerHTML.includes('name="reason"')).innerHTML);
  const { recordArt } = await import('./music/record-store-model.js');
  source = fs.readFileSync('music/record-store.js', 'utf8');
  source = source.slice(source.indexOf('const sign ='), source.indexOf('function decorateHome'));
  vm.runInContext(source + `\noutputs.push(sign(), deck(t('Новая школа', 'New school'), 'new-wave', true));`, vm.createContext({ ...context, colors: {}, recordArt }));
  if (lang === 'en') for (const output of outputs) assert.doesNotMatch(output, /[А-Яа-яЁё]/);
  else assert.ok(outputs.some(output => output.includes('Угадай этот трек')));
}

for (const language of ['en', 'ru']) test(`${language} renders home, loaded controls, guesses, results and multiplayer states`, () => {
  inLanguage(language, `await (${renderInterfaceStates.toString()})();`);
});
