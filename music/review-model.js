export const artistKey = name => String(name).normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
export const selectionFor = (state, collection, id) => ({ status: 'unreviewed', more: false, similar: false, ...state.tracks[collection]?.[id] });

export function artistGroups(tracks) {
  const groups = new Map();
  for (const track of tracks) for (const name of new Set(track.artistNames)) {
    const key = artistKey(name);
    if (!groups.has(key)) groups.set(key, { key, name, tracks: [] });
    const group = groups.get(key);
    if (!group.tracks.some(t => t.id === track.id)) group.tracks.push(track);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function setTrackChoice(state, collection, id, field, value) {
  state.tracks[collection] ||= {};
  state.tracks[collection][id] = { ...state.tracks[collection][id], [field]: value };
  state.updatedAt = Date.now();
}

export function setArtistChoice(state, collection, key, tracks, field, value) {
  state.artists[collection] ||= {};
  state.artists[collection][key] = { ...state.artists[collection][key], [field]: value };
  if (field !== 'status') { state.updatedAt = Date.now(); return; }
  for (const track of tracks.filter(t => t.artistNames.some(n => artistKey(n) === key))) {
    setTrackChoice(state, collection, track.id, field, value);
  }
}

export function validateReview(state) {
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!record(state) || state.version !== 1 || !record(state.tracks) || !record(state.artists)) throw new Error('Неверный формат файла решений.');
  for (const root of [state.tracks, state.artists]) for (const [scope, entries] of Object.entries(root)) {
    if (['__proto__', 'constructor', 'prototype'].includes(scope) || !record(entries)) throw new Error('Неверная подборка.');
    for (const [key, value] of Object.entries(entries)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key) || !record(value)) throw new Error('Неверная запись.');
      for (const [field, choice] of Object.entries(value)) {
        if (field === 'status' && ['unreviewed', 'keep', 'remove'].includes(choice)) continue;
        if (['more', 'similar'].includes(field) && typeof choice === 'boolean') continue;
        if (field === 'note' && typeof choice === 'string' && choice.length <= 2000) continue;
        throw new Error('Неверное решение.');
      }
    }
  }
  if (state.updatedAt !== undefined && (!Number.isFinite(state.updatedAt) || state.updatedAt < 0)) throw new Error('Неверная дата решений.');
  return state;
}
