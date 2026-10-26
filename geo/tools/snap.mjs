// Прогулка начинается рядом со знаменитым местом. Берём его координаты из английской Википедии и ставим
// точку на ближайшую дорогу по OpenStreetMap: панорама Google без ключа открывает ближайший к точке снимок,
// и на дороге это съёмка машины Google, а не чьё-то фото из кафе. Пишет geo/walks.js.
// Запуск из корня сайта: node geo/tools/snap.mjs
import { writeFileSync } from 'node:fs';
import { COUNTRIES } from '../countries.js';

const UA = { 'User-Agent': 'potenceval-geo-build/1.0 (github.com/iSm4iL/potenceval)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const metres = ([a, b], [c, d]) => Math.hypot(a - c, (b - d) * Math.cos(a * Math.PI / 180)) * 111000;

async function retry(fn) {
  for (let tries = 0; tries < 7; tries++) {
    const res = await fn().catch(() => null);
    if (res?.ok) return res.json();
    await sleep(3000 * 2 ** tries);
  }
  throw new Error('Сервер не отвечает');
}

// 1. Координаты знаменитых мест.
const titles = [...new Set(COUNTRIES.flatMap(c => c.walk || []))];
const where = new Map();
for (let i = 0; i < titles.length; i += 50) {
  const r = await retry(() => fetch('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', prop: 'coordinates', colimit: 'max', redirects: '1', format: 'json', titles: titles.slice(i, i + 50).join('|') }), { headers: UA }));
  const back = new Map();
  for (const n of [...(r.query.normalized || []), ...(r.query.redirects || [])]) back.set(n.to, [...(back.get(n.from) || [n.from]), ...(back.get(n.to) || [])]);
  for (const p of Object.values(r.query.pages)) {
    const c = p.coordinates?.[0];
    if (c) for (const t of [p.title, ...(back.get(p.title) || [])]) where.set(t, [c.lat, c.lon]);
  }
  await sleep(1000);
}
const lost = titles.filter(t => !where.has(t));
if (lost.length) console.warn('Нет координат:', lost.join(' | '));

// 2. Ближайшая дорога: сначала крупные, потом любые проезжие улицы.
const near = (pts, radius, kinds) => `(${pts.map(([lat, lng]) => `way(around:${radius},${lat},${lng})[highway~"^(${kinds})$"];`).join('')});node(w);out skel;`;
const MAJOR = 'trunk|primary|secondary|tertiary', ANY = `${MAJOR}|unclassified|residential|living_street`;
const WALKS = {};
for (const c of COUNTRIES.filter(c => c.walk)) {
  const pts = c.walk.map(t => where.get(t)).filter(Boolean);
  if (!pts.length) continue;
  const q = `[out:json][timeout:60];${near(pts, 350, MAJOR)}`;
  let nodes = (await retry(() => fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: q }), headers: UA }))).elements.map(n => [n.lat, n.lon]);
  const snap = p => nodes.reduce((a, n) => (!a || metres(n, p) < metres(a, p) ? n : a), null);
  if (pts.some(p => { const s = snap(p); return !s || metres(s, p) > 350; })) {
    await sleep(1500);
    const q2 = `[out:json][timeout:60];${near(pts, 350, ANY)}`;
    nodes = nodes.concat((await retry(() => fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: q2 }), headers: UA }))).elements.map(n => [n.lat, n.lon]));
  }
  WALKS[c.id] = pts.map(p => { const s = snap(p); return (s && metres(s, p) <= 350 ? s : p).map(v => +v.toFixed(6)); });
  console.log(c.id, pts.map((p, i) => Math.round(metres(p, WALKS[c.id][i]))).join(' '));
  await sleep(1500);
}
writeFileSync(new URL('../walks.js', import.meta.url), `// Сгенерировано tools/snap.mjs: точки прогулки рядом со знаменитыми местами, на ближайших дорогах.
// Координаты мест — Википедия, дороги — © участники OpenStreetMap.
export const WALKS = ${JSON.stringify(WALKS)};
`);
console.log('готово:', Object.keys(WALKS).length, 'стран');
