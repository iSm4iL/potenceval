import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioPlayer } from './audio.js';

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
    const ended = player.play(seconds); await tick();
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
