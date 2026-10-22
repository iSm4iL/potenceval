export const PACKS = [
  { id: 'new-wave', title: 'Новая школа', icon: '🔥', description: 'Свежий звук и новое поколение рэпа' },
  { id: 'ru-rap', title: 'Русский рэп', icon: '🎤', description: 'Знаковые треки разных поколений' },
  { id: 'western-rap', title: 'Западный хип-хоп', icon: '🌎', description: 'Рэп-хиты и большие припевы' },
  { id: 'ru-pop', title: 'Русская поп-музыка', icon: '💗', description: 'Песни, которые хочется подпевать' },
  { id: 'pop-rnb', title: 'Поп и R&B', icon: '🪩', description: 'Мировые хиты и запоминающиеся мелодии' },
  { id: 'alt-rock', title: 'Поп-рок и альтернатива', icon: '🎧', description: 'От стадионных гимнов до альтернативных хитов' },
  { id: 'classics', title: 'Классический рок', icon: '🎸', description: 'Большие гитарные песни до 1990 года' },
  { id: 'ru-rock', title: 'Русский рок', icon: '🤘', description: 'Гитары, знакомые не одному поколению' },
  { id: 'electronic', title: 'Электроника', icon: '⚡', description: 'Танцевальные хиты и узнаваемые дропы' },
  { id: 'indie', title: 'Инди', icon: '✨', description: 'Независимый звук и песни на повторе' },
].map(pack => ({ ...pack, curated: true }));

export const normalize = value => String(value || '').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function isPreviewUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname.endsWith('.dzcdn.net'); }
  catch { return false; }
}

export function normalizeDeezer(raw) {
  if (!raw || !Number.isSafeInteger(raw.id) || raw.id <= 0 || !raw.title || !raw.artist?.name || !raw.artist.id || !isPreviewUrl(raw.preview)) return null;
  const artists = [raw.artist, ...(Array.isArray(raw.contributors) ? raw.contributors : [])].filter(a => a?.id && typeof a.name === 'string');
  const artistNames = [...new Set(artists.map(a => a.name))];
  return {
    id: `dz-${raw.id}`, deezerId: raw.id, title: String(raw.title), artist: artistNames.join(', '),
    artistIds: [...new Set(artists.map(a => String(a.id)))], artistNames,
    answerKey: `${raw.artist.id}|${normalize(raw.title_short || raw.title)}`,
    kind: 'online', start: 0, preview: raw.preview,
    link: `https://www.deezer.com/track/${raw.id}`,
    cover: typeof raw.album?.cover_medium === 'string' && raw.album.cover_medium.startsWith('https://cdn-images.dzcdn.net/') ? raw.album.cover_medium : '',
  };
}

export function snapshotTrack(track) {
  const { id, deezerId, title, artist, answerKey, link = '', cover = '' } = track;
  return { id, deezerId, title, artist, answerKey, link, cover, ...(typeof track.workKey === 'string' ? { workKey: track.workKey } : {}), ...(Array.isArray(track.evidence) ? { evidence: track.evidence.map(e => ({ ...e })) } : {}), artistIds: [...(track.artistIds || [])], artistNames: [...(track.artistNames || [artist])] };
}

export function sameArtist(a, b) {
  const left = Array.isArray(a.artistIds) ? a.artistIds : [], right = Array.isArray(b.artistIds) ? b.artistIds : [];
  if (left.length && right.length) return left.some(id => right.includes(id));
  const names = new Set((a.artistNames || [a.artist]).map(normalize).filter(Boolean));
  return (b.artistNames || [b.artist]).some(name => names.has(normalize(name)));
}

export function searchTracks(tracks, query) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  return tracks.map(track => {
    const title = normalize(track.title), text = normalize([track.title, track.artist, ...(track.artistNames || []), ...(track.aliases || [])].join(' '));
    const query = words.join(' '), artist = normalize(track.artist);
    const exact = title === query || `${artist} ${title}` === query || `${title} ${artist}` === query;
    return { track, rank: exact ? 0 : title.startsWith(query) ? 1 : artist.startsWith(query) ? 2 : 3, match: words.every(word => text.includes(word)) };
  }).filter(x => x.match).sort((a, b) => a.rank - b.rank || a.track.title.localeCompare(b.track.title, 'ru')).slice(0, 8).map(x => x.track);
}

// Keep visible pack answers in place when a slower online search arrives.
export function combineSuggestions(local, remote, query, excludedIds = []) {
  const excluded = new Set(excludedIds), seen = new Set();
  const eligible = tracks => {
    const ids = new Set();
    return tracks.filter(t => {
      if (excluded.has(t.id) || ids.has(t.id)) return false;
      ids.add(t.id); return true;
    });
  };
  return [...searchTracks(eligible(local), query), ...searchTracks(eligible(remote), query)].filter(t => {
    const key = t.answerKey || t.id;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 8);
}
