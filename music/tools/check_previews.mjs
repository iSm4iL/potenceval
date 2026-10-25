// Проверка, что каждое превью каталога реально играет в браузере.
// Запуск: node music/tools/check_previews.mjs [catalog.json] > report.json
// Берёт свежую ссылку из API Deezer, скачивает и раскодирует mp3 в headless Edge/Chrome,
// меряет длину и тишину в начале. Сломанные ID потом идут в sources.json → excludeTracks.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const catalogPath = process.argv[2] || new URL('../data/catalog.json', import.meta.url);
const tracks = JSON.parse(readFileSync(catalogPath, 'utf8')).tracks;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = text => process.stderr.write(text + '\n');

// 1. Свежие ссылки на превью (Deezer: ~50 запросов за 5 секунд).
const details = [];
for (const [i, t] of tracks.entries()) {
  let raw = null;
  for (let attempt = 0; attempt < 3 && !raw; attempt++) {
    try { raw = await (await fetch(`https://api.deezer.com/track/${t.deezerId}`)).json(); } catch { await sleep(1000); }
    if (raw?.error) { if (raw.error.code === 4) { raw = null; await sleep(2000); } else break; }
  }
  details.push({ id: t.deezerId, title: t.title, artist: t.artist, genres: t.genres, readable: raw?.readable, preview: raw?.preview || '', apiError: raw?.error?.message || (raw ? '' : 'no response') });
  if (i % 100 === 0) log(`api ${i}/${tracks.length}`);
  await sleep(130);
}

// 2. Скачать и раскодировать в настоящем браузере.
const browsers = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
const port = 9600 + Math.floor(Math.random() * 300);
const proc = spawn(browsers.find(existsSync), ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'previews-'))}`, 'about:blank'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let seq = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); };
const evaluate = expression => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } })); });

const probe = `async url => {
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
    if (!response.ok) return { error: 'HTTP ' + response.status };
    const buffer = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await response.arrayBuffer());
    const data = buffer.getChannelData(0), rate = buffer.sampleRate;
    let first = -1, peak = 0;
    for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; if (first < 0 && v > 0.01) first = i; }
    return { duration: +buffer.duration.toFixed(2), silence: first < 0 ? buffer.duration : +(first / rate).toFixed(2), peak: +peak.toFixed(3) };
  } catch (error) { return { error: String(error.name || error) }; }
}`;
const results = [];
for (let i = 0; i < details.length; i += 6) {
  const batch = details.slice(i, i + 6);
  const reply = await evaluate(`Promise.all(${JSON.stringify(batch.map(d => d.preview))}.map(${probe}))`);
  const values = reply.result?.result?.value || batch.map(() => ({ error: 'probe failed' }));
  batch.forEach((d, j) => results.push({ ...d, ...(d.preview ? values[j] : { error: d.apiError || 'no preview' }) }));
  if (i % 60 === 0) log(`audio ${i}/${details.length}`);
}
ws.close(); proc.kill();

// Сломано: не скачалось/не раскодировалось, короче 15 с, тишина почти везде или нечитаемо на Deezer.
const broken = results.filter(r => r.error || r.readable === false || r.duration < 15 || r.peak < 0.02 || r.silence > 10);
const quietIntro = results.filter(r => !broken.includes(r) && r.silence > 0.3);
process.stdout.write(JSON.stringify({ checked: results.length, broken, quietIntro }, null, 2) + '\n');
log(`checked ${results.length}, broken ${broken.length}, quiet intro ${quietIntro.length}`);
process.exit(0);
