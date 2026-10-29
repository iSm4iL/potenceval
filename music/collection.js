import { t } from '../shared/i18n.js?v=ui-20261029';
const safeUrl = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
  catch { return false; }
};
const chartIsCurrent = (source, now) => source.kind === 'apple-chart' && source.status === 'fresh' && Number.isFinite(Date.parse(source.updatedAt)) && now - Date.parse(source.updatedAt) >= -5 * 60000 && now - Date.parse(source.updatedAt) < 3 * 86400000;

export function selectCollection(data, genre, mode = 'hits', now = Date.now()) {
  if (data?.version !== 1 || !Array.isArray(data.tracks) || !Array.isArray(data.sources)) throw new Error(t('Не удалось прочитать каталог песен. Попробуй обновить страницу.', "Could not read the song catalog. Try reloading the page."));
  const sources = new Map(data.sources.filter(s => s?.id && safeUrl(s.url)).map(s => [s.id, s]));
  const counts = {}, seen = new Set(), tracks = [];
  for (const t of data.tracks) {
    if (!t || !Number.isSafeInteger(t.deezerId) || t.deezerId <= 0 || typeof t.title !== 'string' || typeof t.artist !== 'string' || !t.artistIds?.length || !Array.isArray(t.artistNames) || typeof t.answerKey !== 'string' || seen.has(t.workKey || t.answerKey)) continue;
    const evidence = (t.sources || []).filter(r => sources.has(r.id)).map(r => {
      const s = sources.get(r.id);
      return { title: s.title, url: s.url, kind: s.kind, position: r.position, period: r.period || '', date: s.updatedAt, stale: s.status !== 'fresh' };
    });
    if (!evidence.length) continue;
    const genres = mode === 'current' ? [...new Set((t.sources || []).filter(r => chartIsCurrent(sources.get(r.id) || {}, now)).flatMap(r => r.genres || []))] : t.genres || [];
    seen.add(t.workKey || t.answerKey);
    for (const g of new Set(genres)) counts[g] = (counts[g] || 0) + 1;
    if (genres.includes(genre)) tracks.push({ id: `dz-${t.deezerId}`, deezerId: t.deezerId, title: t.title, artist: t.artist, artistIds: [...t.artistIds], artistNames: [...t.artistNames], answerKey: t.answerKey, workKey: t.workKey, cover: typeof t.cover === 'string' && t.cover.startsWith('https://cdn-images.dzcdn.net/') ? t.cover : '', link: `https://www.deezer.com/track/${t.deezerId}`, evidence });
  }
  return { tracks, counts, loadedAt: Date.now(), generatedAt: data.generatedAt, stale: data.sources.some(s => s.status !== 'fresh') };
}

export function createCatalogClient({ fetcher = globalThis.fetch, now = Date.now } = {}) {
  let cached, expires = 0;
  return {
    async load(genre, { mode = 'hits', signal, refresh = false } = {}) {
      signal?.throwIfAborted();
      if (!cached || refresh || now() >= expires) {
        const response = await fetcher(new URL('./data/catalog.json', import.meta.url), { signal, cache: 'no-cache' });
        if (!response.ok) throw new Error(t('Каталог пока недоступен. Попробуй обновить подборку.', "The catalog is unavailable. Try refreshing the collection."));
        const data = await response.json();
        selectCollection(data, genre, mode); // Validate before replacing a good snapshot.
        signal?.throwIfAborted(); cached = data; expires = now() + 300000;
      }
      return selectCollection(cached, genre, mode);
    },
  };
}
