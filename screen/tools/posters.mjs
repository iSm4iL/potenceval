// Постеры к каталогу: главная картинка статьи английской Википедии (у фильмов это почти всегда постер).
// Сами файлы не копируем — игра показывает их по ссылке с upload.wikimedia.org. Пишет screen/posters.js.
// Запуск из корня сайта: node screen/tools/posters.mjs
import { writeFileSync } from 'node:fs';
import { TITLES } from '../catalog.js';
import { EXTRA_TITLES } from '../catalog.extra.js';

// Статьи по порядку предпочтения: у сериалов постер обычно на странице первого сезона, на общей — логотип.
const WIKI = {
  'movie-299536': ['Avengers: Infinity War'], 'tv-1396': ['Breaking Bad season 1', 'Breaking Bad'],
  'tv-1429': ['Attack on Titan (TV series)', 'Attack on Titan'], 'movie-8587': ['The Lion King'],
  'movie-603': ['The Matrix'], 'movie-27205': ['Inception'], 'movie-329': ['Jurassic Park (film)'],
  'movie-19995': ['Avatar (2009 film)'], 'tv-1399': ['Game of Thrones season 1', 'Game of Thrones'],
  'tv-66732': ['Stranger Things season 1', 'Stranger Things'], 'tv-100088': ['The Last of Us season 1', 'The Last of Us (TV series)'],
  'tv-119051': ['Wednesday season 1', 'Wednesday (TV series)', 'ru:Уэнсдэй (сериал)'], 'tv-31911': ['Fullmetal Alchemist: Brotherhood', 'ru:Стальной алхимик: Братство'],
  'tv-85937': ['Demon Slayer: Kimetsu no Yaiba (TV series)', 'Demon Slayer: Kimetsu no Yaiba'],
  'tv-120089': ['Spy × Family (TV series)', 'Spy × Family'], 'tv-95479': ['Jujutsu Kaisen (TV series)', 'Jujutsu Kaisen'],
  'movie-862': ['Toy Story'], 'movie-808': ['Shrek'], 'movie-12': ['Finding Nemo'], 'movie-150540': ['Inside Out (2015 film)'],
  'tv-105': ['Sex and the City season 1', 'Sex and the City'], 'tv-1668': ['Friends season 1', 'Friends'],
  'tv-14853': ['O Clone'], 'tv-104877': ['Sen Çal Kapımı'], 'movie-114': ['Pretty Woman'], 'movie-597': ['Titanic (1997 film)'],
  'movie-280': ['Terminator 2: Judgment Day'], 'movie-11': ['Star Wars (film)'], 'movie-105': ['Back to the Future'],
  'movie-20992': ['Brother (1997 film)'], 'local-film-harry-potter-1': ["Harry Potter and the Philosopher's Stone (film)"],
  'local-series-the-office-us': ['The Office (American season 1)', 'The Office (American TV series)'],
  'local-anime-naruto': ['Naruto'], 'local-cartoon-frozen': ['Frozen (2013 film)'],
};

const all = [...TITLES, ...EXTRA_TITLES];
const missingMap = all.filter(t => !WIKI[t.id]).map(t => t.id);
if (missingMap.length) throw new Error('Нет статьи для: ' + missingMap.join(', '));

// «ru:» в начале — статья русской Википедии (там постеры есть у того, чего нет в английской).
const titles = [...new Set(Object.values(WIKI).flat())];
const found = new Map();
for (const lang of ['en', 'ru']) {
  const list = titles.filter(t => (lang === 'ru') === t.startsWith('ru:')).map(t => t.replace(/^ru:/, ''));
  for (let i = 0; i < list.length; i += 50) {
    const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ action: 'query', prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: '600', pilicense: 'any', redirects: '1', format: 'json', titles: list.slice(i, i + 50).join('|') });
    const r = await (await fetch(url, { headers: { 'User-Agent': 'potenceval-screen-build/1.0 (github.com/iSm4iL/potenceval)' } })).json();
    const back = new Map();
    for (const n of [...(r.query.normalized || []), ...(r.query.redirects || [])]) back.set(n.to, [...(back.get(n.from) || [n.from]), ...(back.get(n.to) || [])]);
    for (const p of Object.values(r.query.pages)) {
      const src = p.thumbnail?.source?.split('?')[0];
      // Логотипы (обычно .svg) выдают название и не похожи на обложку — такие пропускаем.
      if (!src || /\.svg|logo|title_card|titlecard/i.test(p.pageimage || '')) continue;
      for (const t of [p.title, ...(back.get(p.title) || [])]) found.set((lang === 'ru' ? 'ru:' : '') + t, src);
    }
  }
}

const POSTERS = {};
for (const t of all) {
  const src = WIKI[t.id].map(w => found.get(w)).find(Boolean);
  if (src) POSTERS[t.id] = src; else console.warn('Без постера:', t.id, t.title);
}
writeFileSync(new URL('../posters.js', import.meta.url), `// Сгенерировано tools/posters.mjs: постеры из статей английской Википедии (показываются по ссылке).
export const POSTERS = ${JSON.stringify(POSTERS, null, 1)};
`);
console.log('постеров:', Object.keys(POSTERS).length, 'из', all.length);
