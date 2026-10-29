// Проверяющий сайта: открывает каждую страницу в чистом headless Edge (как первый визит),
// на компьютере и телефоне, снимает скриншоты, ловит ошибки JS, упавшие запросы, битые картинки,
// горизонтальный скролл, жмёт каждую кнопку первого экрана и смотрит, что что-то произошло,
// следит за звуком (play() и AudioContext) и проверяет внутренние ссылки.
// Запуск: node tools/audit.mjs [https://potenceval.com/] [страница…]  → output/audit/<время>/report.json + *.jpg
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = new URL(process.argv[2] || 'https://potenceval.com/');
const PAGES = process.argv.length > 3 ? process.argv.slice(3) : ['', 'music/', 'geo/', 'opening/', 'where/', 'screen/', 'genie/', 'dice/', 'rap/', 'legal/privacy.html', 'legal/consent.html', 'legal/terms.html'];
const VIEWPORTS = {
  desktop: { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false },
  phone: { width: 375, height: 812, deviceScaleFactor: 1, mobile: true },
};
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const MAX_CLICKS = 20, SETTLE = 2500, AFTER_CLICK = 1800;
const OUT = join('output', 'audit', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = text => process.stderr.write(text + '\n');

// Подслушка звука: каждый play() и каждый AudioContext запоминаются, итог смотрим через __audit.sound().
const SPY = `(() => {
  const media = [], contexts = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const rec = { el: this, result: 'pending' };
    media.push(rec);
    const p = play.call(this);
    p?.then(() => rec.result = 'ok', e => rec.result = String(e?.name || e));
    return p;
  };
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const AC = window[name];
    if (AC) window[name] = class extends AC { constructor(...a) { super(...a); contexts.push(this); } };
  }
  // Web Audio: сколько буферов раскодировано/упало и сколько раз реально запущен звук.
  const web = { decoded: 0, decodeFailed: 0, started: 0 };
  const decode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (...a) {
    const p = decode.apply(this, a);
    p.then(() => web.decoded++, () => web.decodeFailed++);
    return p;
  };
  const start = AudioBufferSourceNode.prototype.start; // у буферного источника свой start, не родительский
  AudioBufferSourceNode.prototype.start = function (...a) { web.started++; return start.apply(this, a); };
  window.__audit = { sound: () => ({ web,
    media: media.map(({ el, result }) => ({ src: (el.currentSrc || el.src || '').slice(0, 120), result, error: el.error?.code || 0, time: +el.currentTime.toFixed(1), paused: el.paused })),
    contexts: contexts.map(c => c.state),
  }) };
})()`;

// Состояние страницы: что видно, что сломано. Горизонтальный скролл меряем от ширины экрана:
// на телефоне браузер сам растягивает раскладку под широкую таблицу, и innerWidth врёт.
const STATE = width => `(() => {
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const label = el => (el.getAttribute('aria-label') || el.innerText || el.title || el.value || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
  return {
    url: location.href,
    title: document.title,
    description: document.querySelector('meta[name=description]')?.content || '',
    lang: document.documentElement.lang,
    hscroll: document.documentElement.scrollWidth - ${width},
    pageHeight: document.documentElement.scrollHeight,
    brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && vis(i)).map(i => i.currentSrc || i.src),
    noAlt: [...document.images].filter(i => vis(i) && !i.hasAttribute('alt')).length,
    unnamedButtons: [...document.querySelectorAll('button,[role=button]')].filter(b => vis(b) && !label(b)).length,
    links: [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith(location.origin)),
    text: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 300),
    sound: window.__audit?.sound(),
  };
})()`;
// Отпечаток страницы: адрес, текст, число элементов и состояние всех кнопок (подсветка, aria-pressed…).
const SIGNATURE = `location.href + '|' + document.body.innerText.length + '|' + document.querySelectorAll('*').length + '|' +
  [...document.querySelectorAll('button,[role],input,dialog')].map(e => e.className + (e.getAttribute('aria-pressed') || '') + (e.getAttribute('aria-selected') || '') + (e.getAttribute('aria-checked') || '') + (e.checked ? 1 : 0) + (e.open ? 1 : 0)).join()`;
// Страница ещё собирается: кнопки «собираю…», «Загрузка…».
const BUSY = `[...document.querySelectorAll('button')].some(b => b.offsetParent && /собира|загрузк/i.test(b.innerText))`;
// Окна, которые закрывает первый визит: правила и баннер cookie.
const DISMISS = /^(Понятно|Только необходимые)/;
const COVERED = `(() => {
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && !el.disabled && +s.opacity > 0.05; };
  return [...document.querySelectorAll('button,[role=button],summary,input[type=button],input[type=submit]')].filter(vis).map(el => {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return null;
    const top = document.elementFromPoint(x, y);
    return top && !el.contains(top) && !top.contains(el) ? { label: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40), by: String(top.closest('[class]')?.className || top.tagName).slice(0, 40) } : null;
  }).filter(Boolean);
})()`;
const CANDIDATES = `(() => {
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && !el.disabled && +s.opacity > 0.05; };
  return [...document.querySelectorAll('button,[role=button],summary,input[type=button],input[type=submit]')].filter(vis)
    .map(el => (el.getAttribute('aria-label') || el.innerText || el.title || el.value || el.className || '?').replace(/\\s+/g, ' ').trim().slice(0, 50));
})()`;
const pointOf = (i) => `(() => {
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && !el.disabled && +s.opacity > 0.05; };
  const el = [...document.querySelectorAll('button,[role=button],summary,input[type=button],input[type=submit]')].filter(vis)[${i}];
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y); // кнопку может закрывать баннер или другое окно
  const covered = top && !el.contains(top) && !top.contains(el) ? (top.closest('[class]')?.className || top.tagName) + '' : '';
  return { x, y, covered: covered.slice(0, 60), offscreen: y < 0 || y > innerHeight };
})()`;

// --- браузер ---
const browser = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const port = 9300 + Math.floor(Math.random() * 300);
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'audit-'))}`, 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 50; i++) { await sleep(200); try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch {} }

async function openTab(vp) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let seq = 0; const pending = new Map(), problems = [], urls = new Map();
  const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const waiters = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); return; }
    const p = m.params;
    if (m.method === 'Runtime.exceptionThrown') problems.push({ kind: 'js', text: (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n').slice(0, 3).join(' ') });
    if (m.method === 'Runtime.consoleAPICalled' && p.type === 'error') problems.push({ kind: 'console', text: p.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300) });
    if (m.method === 'Network.requestWillBeSent') urls.set(p.requestId, p.request.url);
    if (m.method === 'Network.responseReceived' && p.response.status >= 400) problems.push({ kind: 'http', text: `${p.response.status} ${p.response.url.slice(0, 200)}` });
    if (m.method === 'Network.loadingFailed' && !p.canceled && p.errorText !== 'net::ERR_ABORTED') problems.push({ kind: 'net', text: `${p.errorText} ${(urls.get(p.requestId) || '').slice(0, 200)}` });
    if (m.method === 'Page.loadEventFired') waiters.splice(0).forEach(r => r());
  };
  for (const d of ['Runtime', 'Network', 'Page']) await send(`${d}.enable`);
  await send('Emulation.setDeviceMetricsOverride', vp);
  if (vp.mobile) { await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await send('Emulation.setUserAgentOverride', { userAgent: PHONE_UA }); }
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SPY });
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  return {
    problems, evaluate,
    async go(url) { // чистый визит: без cookie, localStorage — только из restore()
      await send('Storage.clearDataForOrigin', { origin: new URL(url).origin, storageTypes: 'all' });
      const loaded = new Promise(r => { waiters.push(r); setTimeout(r, 15000); });
      await send('Page.navigate', { url });
      await loaded; await sleep(SETTLE);
      for (let i = 0; i < 25 && await evaluate(BUSY); i++) await sleep(1000);
    },
    // Дальше каждая загрузка начинается как у вернувшегося посетителя: с этим localStorage.
    restore: snapshot => send('Page.addScriptToEvaluateOnNewDocument', { source: `for (const [k, v] of Object.entries(${snapshot})) localStorage.setItem(k, v)` }),
    async click(x, y) {
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    },
    async shot(file) {
      const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 55 });
      if (r.result?.data) writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'));
    },
    close: () => fetch(`http://127.0.0.1:${port}/json/close/${target.id}`),
  };
}

const report = { base: BASE.href, when: new Date().toISOString(), pages: [], links: [] };
const allLinks = new Set();
for (const path of PAGES) {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const slug = (path.replace(/\/$/, '').replace(/[/.]/g, '_') || 'home') + '-' + vpName;
    const url = new URL(path, BASE).href;
    const tab = await openTab(vp);
    await tab.go(url);
    const state = await tab.evaluate(STATE(vp.width));
    state.links?.forEach(l => allLinks.add(l.split('#')[0]));
    await tab.shot(`${slug}.jpg`);
    // Первый визит: что чем перекрыто (например, баннер cookie поверх кнопки в правилах).
    const page = { path, viewport: vpName, shot: `${slug}.jpg`, ...state, links: undefined, firstVisitCovered: await tab.evaluate(COVERED), problems: tab.problems.splice(0), clicks: [] };
    // Закрываем правила и баннер, как сделал бы человек, и дальше жмём кнопки уже «вернувшимся».
    for (let n = 0; n < 4; n++) {
      const labelsNow = (await tab.evaluate(CANDIDATES)) || [];
      const i = labelsNow.findIndex(l => DISMISS.test(l));
      if (i < 0) break;
      const p = await tab.evaluate(pointOf(i));
      if (p) { await tab.click(p.x, p.y); await sleep(900); }
    }
    await tab.restore(await tab.evaluate('JSON.stringify(Object.fromEntries(Object.entries(localStorage)))'));
    await tab.go(url);
    page.problems.push(...tab.problems.splice(0));
    const labels = (await tab.evaluate(CANDIDATES)) || [];
    log(`${slug}: ${page.problems.length} problems, ${labels.length} buttons`);
    for (let i = 0; i < Math.min(labels.length, MAX_CLICKS); i++) {
      if (i) { await tab.go(url); tab.problems.splice(0); }
      const now = (await tab.evaluate(CANDIDATES)) || [];
      if (now[i] !== labels[i]) { page.clicks.push({ i, label: labels[i], skipped: 'button moved after reload' }); continue; }
      const point = await tab.evaluate(pointOf(i));
      if (!point) continue;
      await sleep(300);
      const before = await tab.evaluate(SIGNATURE);
      await tab.click(point.x, point.y);
      await sleep(AFTER_CLICK);
      const after = await tab.evaluate(SIGNATURE);
      const shot = `${slug}-b${String(i).padStart(2, '0')}.jpg`;
      await tab.shot(shot);
      const sound = await tab.evaluate('window.__audit?.sound()');
      page.clicks.push({ i, label: labels[i], changed: before !== after, covered: point.covered, offscreen: point.offscreen, url: after?.split('|')[0], shot, problems: tab.problems.splice(0), sound });
    }
    report.pages.push(page);
    await tab.close();
  }
}

// Внутренние ссылки: каждая должна открываться.
for (const link of allLinks) {
  let status = 0;
  try { status = (await fetch(link, { redirect: 'follow' })).status; } catch {}
  if (status !== 200) report.links.push({ link, status });
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
proc.kill();
// Сводка: только то, на что стоит посмотреть глазами (скриншоты рядом с report.json).
for (const p of report.pages) {
  const lines = [
    ...p.problems.map(x => `ошибка ${x.kind}: ${x.text}`),
    ...(p.hscroll > 0 ? [`шире экрана на ${p.hscroll}px`] : []),
    ...p.brokenImages.map(src => `битая картинка ${src}`),
    ...(p.firstVisitCovered || []).map(c => `первый визит: «${c.label}» закрыта ${c.by}`),
    ...p.clicks.flatMap(c => [
      ...(c.problems || []).map(x => `[${c.label}] ошибка ${x.kind}: ${x.text}`),
      ...(c.changed === false ? [`[${c.label}] нажатие ничего не меняет${c.covered ? `, кнопку закрывает ${c.covered}` : ''} → ${c.shot}`] : []),
      ...(c.changed && c.covered ? [`[${c.label}] кнопку частично закрывает ${c.covered}`] : []),
    ]),
  ];
  if (lines.length) log(`\n${p.path || '/'} (${p.viewport}):\n  ` + lines.join('\n  '));
}
report.links.forEach(l => log(`битая ссылка ${l.status} ${l.link}`));
log(`\n→ ${OUT}`);
