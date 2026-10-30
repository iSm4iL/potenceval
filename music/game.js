import { t } from '../shared/i18n.js?v=ui-20261029';
import { sameArtist, snapshotTrack } from './catalog.js?v=music-fixes-20261030';
export const LENGTHS = Object.freeze([0.5, 1, 2, 5, 10, 15]);
export const POINTS = Object.freeze([1000, 800, 600, 400, 200, 100]);
// Песню не угадали, но исполнителя назвали — утешительные очки.
export const ARTIST_BONUS = 100;
const roundPoints = (won, step, attempts, answerMode) => won ? POINTS[step] : answerMode !== 'artist' && attempts.some(a => a.status === 'artist') ? ARTIST_BONUS : 0;
const validTrack = t => t && typeof t.id === 'string' && t.id.length > 0 && Number.isSafeInteger(t.deezerId) && t.deezerId > 0 && typeof t.title === 'string' && t.title.length > 0 && typeof t.artist === 'string' && t.artist.length > 0 && Array.isArray(t.artistIds) && t.artistIds.every(id => typeof id === 'string') && Array.isArray(t.artistNames) && t.artistNames.every(name => typeof name === 'string') && typeof t.answerKey === 'string';
// Каверы и перепевки: то же название у другого исполнителя тоже засчитываем, иначе оригинал считался бы ошибкой.
const songTitle = t => typeof t.answerKey === 'string' ? t.answerKey.slice(t.answerKey.indexOf('|') + 1) : '';
export const sameSong = (a, b) => songTitle(a).length > 0 && songTitle(a) === songTitle(b);
const classify = (target, track) => target.id === track.id || sameSong(target, track) ? 'correct' : sameArtist(target, track) ? 'artist' : 'wrong';
const validArtist = a => a?.kind === 'artist' && typeof a.artistId === 'string' && a.artistId.length > 0 && a.id === `artist-${a.artistId}` && typeof a.name === 'string' && a.name.trim().length > 0;
const classifyArtist = (target, a) => target.artistIds.includes(a.artistId) ? 'correct' : 'wrong';

const validCap = cap => Number.isSafeInteger(cap) && cap > 0;
const artists = t => [...new Set(t.artistIds)];
const sameWork = (a, b) => a.answerKey === b.answerKey || (a.workKey && a.workKey === b.workKey);
const canAdd = (track, chosen, cap) => !chosen.some(t => sameWork(track, t)) && artists(track).every(id => chosen.filter(t => t.artistIds.includes(id)).length < cap);

function selectParty(pool, count, cap, recent) {
  const seen = new Set(recent);
  // A recent edition also marks its other editions as heard.
  for (const t of pool) {
    if (recent.includes(t.id) || recent.includes(t.answerKey) || (t.workKey && recent.includes(t.workKey))) {
      seen.add(t.answerKey);
      if (t.workKey) seen.add(t.workKey);
    }
  }
  const heard = t => seen.has(t.id) || seen.has(t.answerKey) || (t.workKey && seen.has(t.workKey));
  const ordered = [...pool.filter(t => !heard(t)), ...pool.filter(heard)];
  const answerCounts = new Map(), workCounts = new Map();
  for (const t of pool) {
    answerCounts.set(t.answerKey, (answerCounts.get(t.answerKey) || 0) + 1);
    if (t.workKey) workCounts.set(t.workKey, (workCounts.get(t.workKey) || 0) + 1);
  }
  const profiles = new Map(pool.map(t => [t.id, JSON.stringify([
    artists(t).sort(), Boolean(heard(t)),
    answerCounts.get(t.answerKey) > 1 ? t.answerKey : null,
    workCounts.get(t.workKey) > 1 ? t.workKey : null,
  ])]));
  function search(available, chosen, allowance) {
    const needed = count - chosen.length;
    if (!needed) return chosen;
    const eligible = available.filter(t => allowance > 0 || !heard(t));
    if (eligible.length < needed || eligible.filter(t => !heard(t)).length + allowance < needed) return null;
    const works = new Set(eligible.filter(t => t.workKey).map(t => t.workKey)).size + eligible.filter(t => !t.workKey).length;
    if (new Set(eligible.map(t => t.answerKey)).size < needed || works < needed) return null;
    if (Number.isFinite(cap)) {
      const frequencies = new Map();
      let withoutArtist = 0;
      for (const t of eligible) {
        if (!t.artistIds.length) withoutArtist++;
        for (const id of artists(t)) frequencies.set(id, (frequencies.get(id) || 0) + 1);
      }
      let capacity = withoutArtist;
      for (const [id, frequency] of frequencies) {
        const remaining = cap - chosen.filter(t => t.artistIds.includes(id)).length;
        if (eligible.length - Math.max(0, frequency - remaining) < needed) return null;
        capacity += Math.min(frequency, remaining);
      }
      const minimumCredits = eligible.map(t => artists(t).length).sort((a, b) => a - b).slice(0, needed).reduce((sum, n) => sum + n, 0);
      if (capacity < needed || capacity - withoutArtist < minimumCredits) return null;
    }
    const tried = new Set();
    for (let i = 0; i <= eligible.length - needed; i++) {
      const t = eligible[i], next = [...chosen, t];
      // Equivalent credits and duplicate-key conflicts cannot rescue a failed branch.
      const profile = profiles.get(t.id);
      if (tried.has(profile)) continue;
      tried.add(profile);
      const result = search(eligible.slice(i + 1).filter(candidate => canAdd(candidate, next, cap)), next, allowance - Number(Boolean(heard(t))));
      if (result) return result;
    }
    return null;
  }
  for (let allowance = 0; allowance <= Math.min(count, pool.filter(heard).length); allowance++) {
    const result = search(ordered, [], allowance);
    if (result) return result;
  }
  return null;
}

export function createGame(tracks, { rounds = 10, random = Math.random, maxPerArtist = Infinity, recent = [], answerMode = 'track' } = {}) {
  if (!['track', 'artist'].includes(answerMode)) throw new Error(t('Неизвестный режим ответа.', "Unknown answer mode."));
  if (maxPerArtist !== Infinity && !validCap(maxPerArtist)) throw new Error(t('Лимит песен одного исполнителя должен быть положительным целым числом.', "The per-artist song limit must be a positive integer."));
  const unique = [...new Map(tracks.filter(validTrack).map(t => [t.id, { ...snapshotTrack(t), ...(t.workKey ? { workKey: t.workKey } : {}) }])).values()];
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > unique.length) throw new Error(t('В подборке недостаточно песен для такой партии.', "Not enough songs in this collection for that game length."));
  const ids = unique.map(t => t.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const byId = new Map(unique.map(t => [t.id, t]));
  const selected = selectParty(ids.map(id => byId.get(id)), rounds, maxPerArtist, recent);
  if (!selected) throw new Error(t('Недостаточно разных песен для партии с таким лимитом на исполнителя.', "Not enough different songs for this per-artist limit."));
  const queue = selected.map(t => t.id), selectedIds = new Set(queue);
  const recentWorks = unique.filter(t => recent.includes(t.id) || recent.includes(t.answerKey) || (t.workKey && recent.includes(t.workKey)));
  const heard = id => recentWorks.some(t => sameWork(t, byId.get(id)));
  // Replacements consume the end of the reserve, so unheard works go last.
  const reserve = ids.filter(id => !selectedIds.has(id)).sort((a, b) => Number(heard(b)) - Number(heard(a)));
  return { version: 2, answerMode, phase: 'round', tracks: unique, queue, reserve, index: 0, step: 0, attempts: [], results: [], score: 0, ...(Number.isFinite(maxPerArtist) ? { maxPerArtist } : {}) };
}

function finish(s, won) {
  const points = roundPoints(won, s.step, s.attempts, s.answerMode);
  return { ...s, phase: 'reveal', score: s.score + points, results: [...s.results, { id: s.queue[s.index], points, step: s.step, won, attempts: s.attempts }] };
}

export function skip(s) {
  if (s.phase !== 'round') return s;
  return s.step === LENGTHS.length - 1 ? finish(s, false) : { ...s, step: s.step + 1 };
}

// Сразу открыть отрывок подлиннее: очки как за этот шаг, попытки не тратятся.
export function openStep(s, k) {
  return s.phase === 'round' && Number.isInteger(k) && k > s.step && k < LENGTHS.length ? { ...s, step: k } : s;
}

export function guess(s, track) {
  if (s.answerMode === 'artist' || s.phase !== 'round' || !validTrack(track) || s.attempts.some(a => a.id === track.id)) return s;
  const target = s.tracks.find(t => t.id === s.queue[s.index]);
  const status = classify(target, track);
  const next = { ...s, attempts: [...s.attempts, { ...snapshotTrack(track), status, step: s.step }] };
  return status === 'correct' ? finish(next, true) : skip(next);
}

export function guessArtist(s, artist) {
  if (s.answerMode !== 'artist' || s.phase !== 'round' || !validArtist(artist) || s.attempts.some(a => a.id === artist.id)) return s;
  const target = s.tracks.find(t => t.id === s.queue[s.index]);
  const status = classifyArtist(target, artist);
  const next = { ...s, attempts: [...s.attempts, { kind: 'artist', id: artist.id, artistId: artist.artistId, name: artist.name, status, step: s.step }] };
  return status === 'correct' ? finish(next, true) : skip(next);
}

export const surrender = s => s.phase === 'round' ? finish(s, false) : s;

export function nextRound(s) {
  if (s.phase !== 'reveal') return s;
  return s.results.length >= s.queue.length ? { ...s, phase: 'summary' } : { ...s, phase: 'round', index: s.index + 1, step: 0, attempts: [] };
}

export function replaceBroken(s) {
  if (s.phase !== 'round') return s;
  const queue = [...s.queue], reserve = [...s.reserve];
  const tracks = new Map(s.tracks.map(t => [t.id, t]));
  const remaining = queue.filter((_, i) => i !== s.index).map(id => tracks.get(id));
  const replacement = reserve.findLastIndex(id => canAdd(tracks.get(id), remaining, s.maxPerArtist ?? Infinity));
  if (replacement >= 0) queue[s.index] = reserve.splice(replacement, 1)[0];
  else queue.splice(s.index, 1);
  return { ...s, queue, reserve, step: 0, attempts: [], phase: queue.length > s.results.length ? 'round' : 'summary', index: queue.length > s.results.length ? s.index : Math.max(0, queue.length - 1) };
}

function validAttempts(attempts, target, step, won, answerMode) {
  if (!Array.isArray(attempts) || attempts.length > 6 || new Set(attempts.map(a => a?.id)).size !== attempts.length) return false;
  let previous = -1;
  return attempts.every((a, i) => {
    const valid = answerMode === 'artist' ? validArtist(a) : validTrack(a);
    if (!valid || !Number.isInteger(a.step) || a.step <= previous || a.step > step || a.status !== (answerMode === 'artist' ? classifyArtist(target, a) : classify(target, a))) return false;
    previous = a.step;
    return a.status !== 'correct' || (won && i === attempts.length - 1 && a.step === step);
  }) && (!won || attempts.at(-1)?.status === 'correct');
}

export function restoreGame(s) {
  if (!s || s.version !== 2 || !['round', 'reveal', 'summary'].includes(s.phase)) return null;
  if (s.answerMode !== undefined && !['track', 'artist'].includes(s.answerMode)) return null;
  if (!['tracks', 'queue', 'reserve', 'attempts', 'results'].every(k => Array.isArray(s[k])) || !s.tracks.every(validTrack)) return null;
  const tracks = new Map(s.tracks.map(t => [t.id, t]));
  if (tracks.size !== s.tracks.length || ![...s.queue, ...s.reserve].every(id => tracks.has(id))) return null;
  if (new Set([...s.queue, ...s.reserve]).size !== s.queue.length + s.reserve.length) return null;
  if (Object.hasOwn(s, 'maxPerArtist')) {
    if (!validCap(s.maxPerArtist)) return null;
    const chosen = [];
    for (const id of s.queue) {
      const track = tracks.get(id);
      if (!canAdd(track, chosen, s.maxPerArtist)) return null;
      chosen.push(track);
    }
  }
  if (!Number.isInteger(s.step) || s.step < 0 || s.step > 5 || !Number.isInteger(s.index) || s.index < 0) return null;
  if (s.results.length > s.queue.length || (s.queue.length && s.index >= s.queue.length)) return null;
  if (s.phase === 'round' && (s.index !== s.results.length || !s.queue.length)) return null;
  if (s.phase === 'reveal' && s.results.length !== s.index + 1) return null;
  if (s.phase === 'summary' && s.results.length !== s.queue.length) return null;
  if (!s.results.every((r, i) => r && r.id === s.queue[i] && typeof r.won === 'boolean' && Number.isInteger(r.step) && r.step >= 0 && r.step <= 5 && (r.points === roundPoints(r.won, r.step, r.attempts, s.answerMode) || (!r.won && r.points === 0)) && validAttempts(r.attempts, tracks.get(r.id), r.step, r.won, s.answerMode))) return null;
  const target = tracks.get(s.queue[s.index]);
  if (target && !validAttempts(s.attempts, target, s.step, s.phase !== 'round' && s.results.at(-1)?.won, s.answerMode)) return null;
  if (s.score !== s.results.reduce((sum, r) => sum + r.points, 0)) return null;
  return s;
}
