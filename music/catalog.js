import { t } from '../shared/i18n.js?v=ui-20261029';

export const PACKS = [
  { id: 'new-wave', title: t('Новая школа', "New school"), icon: '🔥', description: t('madk1d, VILLIAN, 9mice, OG Buda и новое поколение', "madk1d, VILLIAN, 9mice, OG Buda and the new generation") },
  { id: 'ru-rap', title: t('Русский рэп', "Russian rap"), icon: '🎤', description: t('Знаковые треки разных поколений', "Iconic tracks across generations") },
  { id: 'nostalgia', title: t('Ностальгия 2010-х', "2010s nostalgia"), icon: '📼', description: t('Культовые хиты, под которые взрослели', "The hits we grew up with") },
  { id: 'kpop', title: 'K-pop', icon: '💜', description: t('BTS, BLACKPINK, TWICE, Stray Kids и другие', "BTS, BLACKPINK, TWICE, Stray Kids and more") },
  { id: 'modern-pop', title: t('Мировой поп', "Global pop"), icon: '🌍', description: 'The Weeknd, Imagine Dragons, Barns Courtney…' },
  { id: 'mom-pop', title: t('Для мамы', "For mom"), icon: '💐', description: t('LOBODA, Ани Лорак, Emin, Пресняков, Орбакайте, Zivert', "LOBODA, Ani Lorak, Emin, Presnyakov, Orbakaite, Zivert") },
  { id: 'dad-rock', title: t('Батин рок', "Dad’s rock"), icon: '🎸', description: 'Led Zeppelin, Pink Floyd, Deep Purple, The Beatles' },
  { id: 'metal', title: t('Рок и метал', "Rock & metal"), icon: '🤘', description: 'Metallica, Slipknot, Rammstein, System Of A Down' },
  { id: 'us-hiphop', title: 'US Hip-Hop', icon: '🎙️', description: t('Metro Boomin, Travis Scott, Kanye West, Lil Nas X, NLE Choppa и другие', "Metro Boomin, Travis Scott, Kanye West, Lil Nas X, NLE Choppa and more") },
  { id: 'soundcloud', title: 'SoundCloud Hits', icon: '☁️', description: t('XXXTentacion, Lil Uzi Vert, Juice WRLD, Lil Peep и другие', "XXXTentacion, Lil Uzi Vert, Juice WRLD, Lil Peep and more") },
  { id: 'dead-inside', title: t('Дед инсайд', "Dead inside"), icon: '🖤', description: t('Baby Cute, CUPSIZE, Boulevard Depo, Lil Peep, ONDA ANDAR, Кишлак, дора и другие', "Baby Cute, CUPSIZE, Boulevard Depo, Lil Peep, ONDA ANDAR, Kishlak, Dora and more") },
  { id: 'drill', title: t('Дрилл', "Drill"), icon: '🥷', description: t('Central Cee, Digga D, Headie One, Pop Smoke, Chief Keef, Fivio Foreign и другие', "Central Cee, Digga D, Headie One, Pop Smoke, Chief Keef, Fivio Foreign and more") },
  { id: 'hookah', title: t('Кальянный рэп', "Hookah rap"), icon: '💨', description: 'HammAli & Navai, JONY, Jah Khalib, Xcho, Rauf & Faik' },
  { id: 'street-36', title: t('Улица 36', 'Street 36'), icon: '🌃', description: t('Скриптонит, Асха Принц, Truwer, 104, Gruppa Skryptonite и ATL', 'Scriptonite, A$XV Prince, Truwer, 104, Gruppa Skryptonite and ATL') },
  { id: 'repeat-hits', title: t('На репите', 'On Repeat'), icon: '🎧', description: 'Barns Courtney, Imagine Dragons, The Weeknd…', art: 'modern-pop' },
].map(pack => ({ ...pack, curated: true }));

// Saved games and lobby hosts may have used the other language.
export function localizedPackTitle(id, fallback = '', mode) {
  const pack = PACKS.find(pack => pack.id === id);
  if (!pack) return fallback || t('Музыка', 'Music');
  return pack.title + (mode === 'current' || / · (Сейчас в чартах|In the charts)$/.test(fallback) ? t(' · Сейчас в чартах', ' · In the charts') : '');
}

export const normalize = value => String(value || '').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const artistIdentities = new Map([['265301792', '8874422'], ['268236102', '150616292']]);
export const artistIdentity = id => artistIdentities.get(id) || id;
const displayArtist = (id, name) => artistIdentity(id) === '8874422' ? 'ЛСП' : name;

export function isPreviewUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname.endsWith('.dzcdn.net'); }
  catch { return false; }
}

export function normalizeDeezer(raw) {
  if (!raw || !Number.isSafeInteger(raw.id) || raw.id <= 0 || !raw.title || !raw.artist?.name || !raw.artist.id || !isPreviewUrl(raw.preview)) return null;
  const artists = [], seenArtists = new Set();
  for (const artist of [raw.artist, ...(Array.isArray(raw.contributors) ? raw.contributors : [])]) {
    if (!artist?.id || typeof artist.name !== 'string' || !artist.name.trim()) continue;
    // Deezer assigned the 104 feature on «Мультибрендовый» to the wrong profile.
    const id = raw.id === 569641582 && artist.id === 87877422 ? 11296432 : artist.id;
    if (seenArtists.has(String(id))) continue;
    seenArtists.add(String(id)); artists.push({ id, name: artist.name });
  }
  const artistNames = artists.map(a => displayArtist(String(a.id), a.name));
  return {
    id: `dz-${raw.id}`, deezerId: raw.id, title: String(raw.title), artist: [...new Set(artistNames)].join(', '),
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

export function sameArtist(a, b, identify = artistIdentity) {
  const left = Array.isArray(a.artistIds) ? a.artistIds : [], right = Array.isArray(b.artistIds) ? b.artistIds : [];
  if (left.length && right.length) return left.some(id => right.some(other => identify(id) === identify(other)));
  const names = new Set((a.artistNames || [a.artist]).map(normalize).filter(Boolean));
  return (b.artistNames || [b.artist]).some(name => names.has(normalize(name)));
}

const translit = { а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ж:'zh', з:'z', и:'i', й:'y', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f', х:'h', ц:'ts', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya' };
const soundKey = text => normalize(text).replace(/[а-я]/g, c => translit[c]).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ph/g, 'f').replace(/qu/g, 'kv').replace(/ee|ea/g, 'i').replace(/oo|ou/g, 'u')
  .replace(/th/g, 't').replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/w/g, 'v').replace(/y/g, 'i').replace(/([a-z])\1+/g, '$1');
const artistAliases = {
  '9mice': ['nine mice', '9 mice', 'найн майс', 'найнмайс'],
  '104': ['104-й', 'сто четыре'],
  лсп: ['lsp'],
  lovv66: ['ловв66', 'лов66', 'ловв 66', 'лов 66'],
  'the beatles': ['битлз', 'битлс'], queen: ['квин', 'куин'],
  'deep purple': ['дип пёрпл', 'дип перпл'], 'guns n roses': ['ганз энд роузес'],
  'the rolling stones': ['роллинг стоунз'], 'red hot chili peppers': ['ред хот чили пепперс'],
  'ac dc': ['эй си ди си', 'эйсидиси'], eagles: ['иглз'], 'the doors': ['дорз'],
  'creedence clearwater revival': ['криденс'], 'bon jovi': ['бон джови'],
};
const aliasesFor = name => artistAliases[normalize(name)] || [];

// Bounded Damerau distance also accepts adjacent swapped letters, e.g. «птциа».
function closeWord(a, b) {
  if (a === b) return true;
  if (a.length < 4) return false;
  const limit = a.length >= 7 ? 2 : 1;
  if (Math.abs(a.length - b.length) > limit) return false;
  let older, previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], older[j - 2] + 1);
    }
    if (Math.min(...row) > limit) return false;
    older = previous; previous = row;
  }
  return previous[b.length] <= limit;
}

function matchRank(title, artist, aliases, query) {
  const words = query.split(' '), text = normalize([title, artist, ...aliases].join(' '));
  const name = normalize(title), performer = normalize(artist);
  if (words.every(word => text.includes(word))) {
    return name === query || `${performer} ${name}` === query || `${name} ${performer}` === query ? 0 : name.startsWith(query) ? 1 : performer.startsWith(query) ? 2 : 3;
  }
  const phonetic = soundKey(text), queryKey = soundKey(query);
  if (!queryKey.trim()) return Infinity;
  const parts = phonetic.split(' ').filter(Boolean), wanted = queryKey.split(' ').filter(Boolean);
  if (wanted.every(word => parts.some(part => part.includes(word))) || phonetic.replaceAll(' ', '').includes(queryKey.replaceAll(' ', ''))) return 4;
  if (words.every(word => text.split(' ').some(part => part.includes(word) || closeWord(word, part))) || wanted.every(word => parts.some(part => part.includes(word) || closeWord(word, part))) || [title, artist, ...aliases].some(label => closeWord(queryKey.replaceAll(' ', ''), soundKey(label).replaceAll(' ', '')))) return 5;
  return Infinity;
}

export function searchTracks(tracks, query) {
  query = normalize(query);
  if (!query) return [];
  return tracks.map(track => ({ track, rank: matchRank(track.title, track.artist, [...(track.artistNames || []), ...(track.artistNames || [track.artist]).flatMap(aliasesFor), ...(track.aliases || [])], query) }))
    .filter(x => Number.isFinite(x.rank)).sort((a, b) => a.rank - b.rank || a.track.title.localeCompare(b.track.title, 'ru')).slice(0, 8).map(x => x.track);
}

const artistOption = (id, name) => {
  const artistId = artistIdentity(id);
  return { kind: 'artist', id: `artist-${artistId}`, artistId, name: displayArtist(artistId, name) };
};

export function artistOptions(tracks) {
  const options = new Map();
  for (const track of tracks) for (const [i, artistId] of track.artistIds.entries()) {
    const name = track.artistNames[i];
    const option = artistOption(artistId, name);
    if (name && !options.has(option.id)) options.set(option.id, option);
  }
  return [...options.values()];
}

export function searchArtistOptions(options, query) {
  query = normalize(query);
  if (!query) return [];
  return options.map(artist => ({ artist, rank: matchRank(artist.name, '', aliasesFor(artist.name), query) }))
    .filter(x => Number.isFinite(x.rank)).sort((a, b) => a.rank - b.rank || a.artist.name.localeCompare(b.artist.name, 'ru')).slice(0, 8).map(x => x.artist);
}

export function combineArtistSuggestions(local, remote, query, excludedIds = []) {
  const seen = new Set(excludedIds.map(id => `artist-${artistIdentity(id.slice(7))}`));
  if (local.some(artist => artist.artistId === '11296432')) seen.add('artist-87877422');
  const eligible = options => options.map(a => artistOption(a.artistId, a.name)).filter(a => !seen.has(a.id));
  return [...searchArtistOptions(eligible(local), query), ...searchArtistOptions(eligible(remote), query)].filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id); return true;
  }).slice(0, 8);
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
  // Deezer may match a guest omitted from its abbreviated search response.
  const online = eligible(remote);
  return [...searchTracks(eligible(local), query), ...searchTracks(online, query), ...online].filter(t => {
    const key = t.answerKey || t.id;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 8);
}
