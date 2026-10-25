// Собирает where/spots.js: случайные точки по всему миру, где есть панорама, снятая машиной Google
// (не чьё-то фото из кафе). Для каждой страны берём случайную точку внутри границ и спрашиваем у Google
// ближайшую официальную панораму — тем же запросом, что делает карта Google в браузере, ключ не нужен.
// Страны без съёмки отваливаются сами: три промаха подряд — и дальше не ищем.
// Запуск из корня сайта:  node where/tools/spots.mjs путь/к/ne_50m_admin_0_countries.geojson
// Файл границ: https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_admin_0_countries.geojson
import { readFileSync, writeFileSync } from 'node:fs';

const ne = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso = p => (p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2);
const ringArea = r => Math.abs(r.reduce((s, [x1, y1], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x1 * y2 - x2 * y1; }, 0) / 2);
const inRing = ([x, y], r) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
// ponytail: дырки в полигонах (Лесото внутри ЮАР) не учитываем — точку в дырке перехватит страна-дырка, она в списке раньше не стоит.
const inCountry = (pt, c) => c.polys.some(p => inRing(pt, p[0]));

const countries = ne.features.map(f => {
  const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const km2 = polys.reduce((s, p) => { const lat = p[0][0][1]; return s + ringArea(p[0]) * 111 * 111 * Math.cos(lat * Math.PI / 180); }, 0);
  return { id: iso(f.properties), name: f.properties.NAME_RU, polys, km2 };
}).filter(c => c.id !== '-99' && c.id !== 'AQ')
  .filter((c, i, all) => !all.some((d, j) => d.id === c.id && (d.km2 > c.km2 || (d.km2 === c.km2 && j < i)))) // у кода бывают мелкие владения
  .filter(c => !process.env.ONLY || process.env.ONLY.split(',').includes(c.id)); // ONLY=FI,MC — проверить пару стран
const whose = pt => countries.find(c => inCountry(pt, c))?.id;

function randomPoint(c, rnd = Math.random) {
  let pick = rnd() * c.polys.reduce((s, p) => s + ringArea(p[0]), 0), poly = c.polys[0];
  for (const p of c.polys) { pick -= ringArea(p[0]); if (pick <= 0) { poly = p; break; } }
  const xs = poly[0].map(p => p[0]), ys = poly[0].map(p => p[1]);
  for (let k = 0; k < 500; k++) {
    const pt = [Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs)), Math.min(...ys) + rnd() * (Math.max(...ys) - Math.min(...ys))];
    if (inRing(pt, poly[0])) return pt;
  }
  return poly[0][0];
}

// Ответ: [статус, [_, [2, id панорамы], _, адрес, _, [[_, [[_, _, lat, lng], …, страна?]]], [… [год, месяц]]]].
async function search(lat, lng, radius) {
  const body = `[["apiv3"],[[null,null,${lat},${lng}],${radius}],[[null,null,null,null,null,null,null,null,null,null,[null,null]],null,null,null,null,null,null,null,[1],null,[[[2,true,2]]]],[[2,6]]]`;
  for (let tries = 0; tries < 4; tries++) {
    const res = await fetch('https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/SingleImageSearch', {
      method: 'POST', body, headers: { 'content-type': 'application/json+protobuf', 'x-user-agent': 'grpc-web-javascript/0.1' },
    }).catch(() => null);
    if (res?.ok) {
      const r = await res.json(), pano = r[1]?.[1], at = r[1]?.[5]?.[0]?.[1]?.[0];
      // id из 22 знаков и тип 2 — съёмка самой Google; у фото пользователей id длинный «AF1Qip…»
      if (pano?.[0] !== 2 || pano[1]?.length !== 22 || !at) return null;
      return { id: pano[1], lat: at[2], lng: at[3], year: r[1]?.[6]?.[7]?.[0] || null };
    }
    if (res && res.status < 500 && res.status !== 429) return null; // «здесь ничего нет»
    await sleep(2000 * 2 ** tries);
  }
  throw new Error('Google не отвечает');
}

const SPOTS = [], NAMES = {};
const near = (a, b) => Math.hypot(a.lat - b[1], (a.lng - b[2]) * Math.cos(a.lat * Math.PI / 180)) * 111 < 3;
for (const c of countries.sort((a, b) => a.name.localeCompare(b.name, 'ru'))) {
  // больше страна — больше точек; ponytail: корень из площади подобран на глаз, чтобы США не съели всю колоду
  const want = Math.max(2, Math.min(25, Math.round(Math.sqrt(c.km2) / 60)));
  const radius = Math.round(Math.max(1000, Math.min(50000, Math.sqrt(c.km2) * 250)));
  let got = 0, tries = 0;
  while (got < want && tries < want * 4 && !(tries >= 3 && got === 0)) {
    tries++;
    const [lng, lat] = randomPoint(c);
    const p = await search(lat, lng, radius);
    await sleep(150);
    if (!p) continue;
    const cc = whose([p.lng, p.lat]) || c.id;
    if (cc !== c.id || SPOTS.some(s => near(p, s))) continue; // за границей или почти там же, где уже есть
    SPOTS.push([cc, +p.lat.toFixed(6), +p.lng.toFixed(6), p.id, p.year]);
    NAMES[cc] = c.name;
    got++;
  }
  if (got) console.log(c.id, c.name, got + '/' + want, 'попыток', tries);
}
writeFileSync(new URL('../spots.js', import.meta.url), `// Сгенерировано tools/spots.mjs — руками не править. Панорамы: Google Street View. Границы: Natural Earth.
// [код страны, широта, долгота, id панорамы, год съёмки]
export const SPOTS = ${JSON.stringify(SPOTS)};
export const NAMES = ${JSON.stringify(NAMES)};
`);
console.log('готово:', SPOTS.length, 'точек,', Object.keys(NAMES).length, 'стран');
