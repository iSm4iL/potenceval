import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioPlayer, audibleStart } from './audio.js';

test('snippets skip a silent preview intro but always leave 15 seconds to play', () => {
  const rate = 100, samples = new Float32Array(30 * rate);
  samples.fill(0.3, 2 * rate);
  const buffer = { duration: 30, sampleRate: rate, getChannelData: () => samples };
  assert.ok(Math.abs(audibleStart(buffer) - 1.97) < 0.001);
  assert.equal(audibleStart({ duration: 30, sampleRate: rate, getChannelData: () => new Float32Array(30 * rate) }), 0, 'silence everywhere keeps the start');
  assert.equal(audibleStart({ duration: 30 }), 0);
});

function context() {
  const sources = [];
  return { sources, currentTime: 12, destination: {}, resume: async () => {}, decodeAudioData: async () => ({ duration: 30 }),
    createGain: () => ({ connect() {}, disconnect() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} } }),
    createBufferSource() { const source = { connect() {}, disconnect() {}, start(...args) { this.args = args; }, stop() { this.onended?.(); } }; sources.push(source); return source; },
  };
}
const track = { kind: 'online', id: 'dz-1', preview: 'https://cdnt-preview.dzcdn.net/example.mp3', start: 0 };
const response = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
const tick = () => new Promise(resolve => setImmediate(resolve));
const make = (ctx = context(), fetchAudio = async () => response()) => new AudioPlayer({ context: ctx, fetchAudio });

test('online preview is fetched with no persistent cache and plays all exact snippet lengths', async () => {
  const ctx = context(), calls = [];
  const player = make(ctx, async (...args) => { calls.push(args); return response(); });
  assert.equal(await player.load(track), true);
  assert.equal(calls[0][0], track.preview);
  assert.equal(calls[0][1].cache, 'no-store');
  assert.equal(calls[0][1].credentials, 'omit');
  for (const seconds of [0.5, 1, 2, 5, 10, 15]) {
    let started = false;
    const ended = player.play(seconds, { onStart: () => { started = true; } }); await tick();
    assert.equal(started, true);
    const source = ctx.sources.at(-1);
    assert.equal(source.args[1], 0); assert.equal(source.args[2], seconds);
    source.onended(); assert.equal(await ended, true);
  }
  assert.equal(calls.length, 1, 'replays reuse only the in-memory current preview');
});

test('stopping aborts an online request and never allows stale audio to start', async () => {
  let aborted = false;
  const player = make(context(), async (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); })));
  const loading = player.load(track); player.stop();
  assert.equal(await loading, false); assert.equal(aborted, true); assert.equal(player.track, null);
});

test('pausing a hidden tab preserves a pending decode and interrupts playback', async () => {
  const ctx = context(), player = make(ctx); let decode;
  ctx.decodeAudioData = () => new Promise(resolve => { decode = resolve; });
  const loading = player.load(track); await tick(); player.pause(); decode({ duration: 30 });
  assert.equal(await loading, true);
  const ended = player.play(15); await tick(); player.pause(); assert.equal(await ended, false);
});

test('interruption while unlocking audio cannot start old playback', async () => {
  const ctx = context(), player = make(ctx); await player.load(track); let resume;
  ctx.resume = () => new Promise(resolve => { resume = resolve; });
  const ended = player.play(0.5); player.stop(); resume();
  assert.equal(await ended, false); assert.equal(ctx.sources.length, 0);
});

test('unavailable previews, unsafe sources and short audio fail clearly', async () => {
  await assert.rejects(make(context(), async () => ({ ok: false, status: 403 })).load(track), /доступ|превью/i);
  await assert.rejects(make().load({ ...track, preview: 'https://untrusted.example/a.mp3' }), /источник|превью/i);
  const ctx = context(); ctx.decodeAudioData = async () => ({ duration: 10 });
  await assert.rejects(make(ctx).load(track), /15/);
});

test('background preload does not interrupt current playback and is reused without refetching', async () => {
  const ctx = context(), calls = [];
  const player = make(ctx, async (...args) => { calls.push(args); return response(); });
  await player.load(track);
  const playing = player.play(15); await tick();
  const next = { ...track, id: 'dz-2', preview: 'https://cdnt-preview.dzcdn.net/next.mp3' };
  const buffer = await player.fetchBuffer(next);
  assert.equal(player.track.id, 'dz-1', 'current track is untouched while preloading');
  assert.equal(calls.at(-1)[1].cache, 'no-store');
  player.useBuffer(next, buffer);
  assert.equal(await playing, false, 'switching to the preloaded song stops the old snippet');
  assert.equal(player.track.id, 'dz-2'); assert.equal(player.buffer, buffer); assert.equal(calls.length, 2);
  await assert.rejects(player.fetchBuffer({ ...next, preview: 'https://untrusted.example/a.mp3' }), /превью/i);
});

test('background download has a deadline even when the network never settles', { timeout: 1000 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const player = make(context(), () => new Promise(() => {}));
  const result = player.fetchBuffer(track);
  const rejected = assert.rejects(result, /загруз|соединени/i);
  t.mock.timers.tick(15000);
  await rejected;
});

test('decoding has a deadline and cannot replace the current buffer after timeout', { timeout: 1000 }, async t => {
  const ctx = context(); let decode;
  ctx.decodeAudioData = () => new Promise(resolve => { decode = resolve; });
  const player = make(ctx);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = player.load(track);
  await tick();
  const rejected = assert.rejects(result, /подготов|прочитать|декод/i);
  t.mock.timers.tick(15000);
  await rejected;
  decode({ duration: 30 }); await tick();
  assert.equal(player.buffer, null);
});

test('a browser that never enables sound reports an error and allows a retry', { timeout: 1000 }, async t => {
  const ctx = context(), player = make(ctx);
  await player.load(track);
  ctx.resume = () => new Promise(() => {});
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = player.play(0.5);
  const rejected = assert.rejects(result, /браузер|звук/i);
  t.mock.timers.tick(5000);
  await rejected;
  assert.equal(ctx.sources.length, 0);
  ctx.resume = async () => {};
  const retry = player.play(0.5); await tick();
  ctx.sources.at(-1).onended();
  assert.equal(await retry, true);
});

test('loading reports download and decode separately', async () => {
  const stages = [];
  await make().load(track, { onStatus: status => stages.push(status) });
  assert.equal(stages.length, 2);
  assert.match(stages[0], /загружа/i);
  assert.match(stages[1], /подгот/i);
});

test('a stalled audio device cannot leave playback spinning forever', { timeout: 1000 }, async t => {
  const player = make(); await player.load(track);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = player.play(0.5); await tick();
  const rejected = assert.rejects(result, /звук|воспроизвед/i);
  t.mock.timers.tick(4000);
  await rejected;
  assert.equal(player.source, null);
});
