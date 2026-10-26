// Собирает geo/atlas.js: контуры стран из досье, центры всех стран мира (для «тепло/холодно»)
// и ссылки на фото из статей ru.wikipedia.
// Запуск из корня сайта:  node geo/tools/build.mjs путь/к/ne_50m_admin_0_countries.geojson
// Файл границ: https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_admin_0_countries.geojson
import { readFileSync, writeFileSync } from 'node:fs';
import { COUNTRIES } from '../countries.js';

const ne = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const iso = p => (p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2);
// Код страны бывает и у её мелких владений (острова Эшмор у Австралии и т. п.) — основная страна главнее.
const byIso = new Map();
for (const f of ne.features) {
  const id = iso(f.properties);
  if (id !== '-99' && (!byIso.has(id) || f.properties.ISO_A2 === id)) byIso.set(id, f);
}

// Все страны мира: код, русское название, точка подписи (её и считаем «центром»).
const WORLD = [...byIso.values()].map(({ properties: p }) => [iso(p), p.NAME_RU, +p.LABEL_Y.toFixed(2), +p.LABEL_X.toFixed(2)])
  .sort((a, b) => a[1].localeCompare(b[1], 'ru'));

const ringArea = r => Math.abs(r.reduce((s, [x1, y1], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x1 * y2 - x2 * y1; }, 0) / 2);

// Контур страны → SVG-путь в рамке 1000×1000. Мелкие острова отбрасываем, чтобы форма читалась.
function shape(feature) {
  const g = feature.geometry;
  let polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const lons = polys.flat(2).map(p => p[0]);
  if (Math.max(...lons) - Math.min(...lons) > 300) polys = polys.map(p => p.map(r => r.map(([x, y]) => [x < 0 ? x + 360 : x, y])));
  const total = polys.reduce((s, p) => s + ringArea(p[0]), 0);
  // Заморские владения (Французская Гвиана, Гавайи) сжимают саму страну в точку — убираем всё далёкое и
  // небольшое. ponytail: порог 15% подобран на глаз — Аляска (≈17% США) остаётся, Гвиана (≈13% Франции) уходит.
  const mid = p => p[0].reduce(([a, b], [x, y]) => [a + x / p[0].length, b + y / p[0].length], [0, 0]);
  const main = mid(polys.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a)));
  const far = p => { const [x, y] = mid(p); return Math.hypot((x - main[0]) * Math.cos(main[1] * Math.PI / 180), y - main[1]) * 111 > 3000; };
  polys = polys.filter(p => ringArea(p[0]) > total * 0.004 && (!far(p) || ringArea(p[0]) > total * 0.15));
  const pts = polys.flat(2);
  const lat0 = (Math.max(...pts.map(p => p[1])) + Math.min(...pts.map(p => p[1]))) / 2;
  const k = Math.cos(lat0 * Math.PI / 180);
  const xy = ([x, y]) => [x * k, -y];
  const all = pts.map(xy), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)], span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  const w = (Math.max(...xs) - minX) / span * 1000, h = (Math.max(...ys) - minY) / span * 1000;
  const ox = (1000 - w) / 2, oy = (1000 - h) / 2;
  const d = polys.flatMap(p => p).map(r => {
    const out = [];
    for (const pt of r) {
      const [x, y] = xy(pt), q = [Math.round(ox + (x - minX) / span * 1000), Math.round(oy + (y - minY) / span * 1000)];
      if (!out.length || Math.abs(q[0] - out.at(-1)[0]) + Math.abs(q[1] - out.at(-1)[1]) >= 3) out.push(q);
    }
    return out.length > 2 ? 'M' + out.map(q => q.join(' ')).join('L') + 'Z' : '';
  }).join('');
  return d;
}

const SHAPES = {};
for (const c of COUNTRIES) {
  const f = byIso.get(c.id);
  if (!f) throw new Error('Нет границ для ' + c.id);
  SHAPES[c.id] = shape(f);
}

// Фото: главное изображение статьи. Флаги, гербы и карты отбрасываем — они выдают ответ.
// Нет фото в русской статье — берём из английской (по межъязыковой ссылке или прямо «en:Название»).
const titles = [...new Set(COUNTRIES.flatMap(c => [c.food[1], c.money[1], c.person[2]]))];
const PHOTOS = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function lookup(lang, list) {
  const out = new Map();
  for (let i = 0; i < list.length; i += 50) {
    const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ action: 'query', prop: 'pageimages|langlinks', piprop: 'thumbnail|name', pithumbsize: '640', lllang: 'en', lllimit: 'max', redirects: '1', format: 'json', titles: list.slice(i, i + 50).join('|') });
    let r;
    for (let tries = 0; !r; tries++) {
      const res = await fetch(url, { headers: { 'User-Agent': 'potenceval-geo-build/1.0 (github.com/iSm4iL/potenceval)' } });
      if (res.ok) r = await res.json(); else if (tries > 4) throw new Error('Wikipedia: ' + res.status); else await sleep(3000 * (tries + 1));
    }
    const alias = new Map();
    for (const n of [...(r.query.normalized || []), ...(r.query.redirects || [])]) alias.set(n.to, [...(alias.get(n.from) || []), n.from, ...(alias.get(n.to) || [])]);
    for (const page of Object.values(r.query.pages)) {
      const src = page.thumbnail?.source;
      const bad = !src || /flag|coat|map|карта|герб|флаг|locator|location|emblem|logo|symbol|sign/i.test(page.pageimage || '');
      const keys = [page.title, ...(alias.get(page.title) || []), ...[...alias].filter(([, v]) => v.includes(page.title)).flatMap(([k, v]) => [k, ...v])];
      for (const t of keys) if (list.includes(t)) out.set(t, { src: bad ? null : src, en: page.langlinks?.[0]?.['*'] });
    }
    await sleep(1500);
  }
  return out;
}
const ru = await lookup('ru', titles.filter(t => !t.startsWith('en:')));
const enOf = new Map(titles.map(t => [t, t.startsWith('en:') ? t.slice(3) : !ru.get(t)?.src && ru.get(t)?.en]).filter(([, e]) => e));
const en = await lookup('en', [...new Set(enOf.values())]);
for (const t of titles) PHOTOS[t] = ru.get(t)?.src || en.get(enOf.get(t))?.src || null;
const missing = titles.filter(t => !PHOTOS[t]);
if (missing.length) console.warn('Без фото:', missing.join(', '));

const json = v => JSON.stringify(v);
writeFileSync(new URL('../atlas.js', import.meta.url), `// Сгенерировано tools/build.mjs — руками не править.
// Границы: Natural Earth (общественное достояние). Фото: Wikipedia / Wikimedia Commons.
export const WORLD = ${json(WORLD)};
export const SHAPES = ${json(SHAPES)};
export const PHOTOS = ${json(PHOTOS)};
`);
console.log('countries', WORLD.length, 'shapes', Object.keys(SHAPES).length, 'photos', titles.length - missing.length, '/', titles.length);
