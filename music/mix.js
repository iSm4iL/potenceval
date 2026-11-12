import { artistIdentity, artistOptions, normalize } from './catalog.js?v=music-mix-20261112-2';

const credits = track => track.artistIds.map(artistIdentity);
const trackKey = track => `${credits(track)[0]}|${normalize(track.answerKey.slice(track.answerKey.indexOf('|') + 1))}`;

export function relatedInLibrary(library, id) {
  const key = artistIdentity(String(id));
  const counts = new Map();
  const tracks = library.filter(track => credits(track).includes(key));
  for (const track of tracks) for (const artist of new Set(credits(track))) {
    counts.set(artist, (counts.get(artist) || 0) + 1);
  }
  return artistOptions(tracks).filter(artist => artist.artistId !== key)
    .sort((a, b) => counts.get(b.artistId) - counts.get(a.artistId))
    .map(artist => ({ id: Number(artist.artistId), name: artist.name }));
}

export async function buildMix(artists, library, service, signal) {
  const selected = new Set(artists.map(artist => artistIdentity(String(artist.id))));
  const groups = artists.map(artist => ({
    artist, tracks: library.filter(track => credits(track).includes(artistIdentity(String(artist.id)))).slice(0, 12),
  }));
  const missing = groups.filter(group => group.tracks.length < 8).map(group => group.artist);
  let online = [], failures = [];
  if (missing.length) {
    try {
      ({ tracks: online, failures } = await service.loadPack({ artists: missing, topLimit: 12, onlyCredited: true }, { signal }));
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      failures = [error.message];
    }
  }
  const ids = new Set(), answers = new Set(), tracks = [];
  for (const track of [...groups.flatMap(group => group.tracks), ...online]) {
    if (!credits(track).some(id => selected.has(id))) continue;
    const answer = trackKey(track);
    if (ids.has(track.id) || answers.has(answer)) continue;
    ids.add(track.id);
    answers.add(answer);
    tracks.push(track);
  }
  return { tracks, failures, loadedAt: Date.now() };
}
