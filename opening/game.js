import { t } from '../shared/i18n.js?v=ui-20261029';

export const ROUND_MS = 30000;

function shuffle(items, rng = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildChoices(entry, catalog, rng = Math.random) {
  const ids = new Set(entry.distractorIds);
  const pool = catalog.filter(x => ids.has(x.animeId) && (x.category || 'anime') === (entry.category || 'anime') && x.animeId !== entry.animeId && x.franchiseId !== entry.franchiseId && x.trackId !== entry.trackId);
  const unique = [...new Map(pool.map(x => [x.animeId, x])).values()];
  if (unique.length < 3) throw new Error(t('Недостаточно похожих вариантов ответа.', 'Not enough similar answer choices.'));
  return shuffle([entry, ...shuffle(unique, rng).slice(0, 3)], rng);
}

export function buildSession(catalog, count = 10, rng = Math.random, { category, seenIds = [] } = {}) {
  const seen = new Set();
  const played = new Set(seenIds);
  const ordered = [...shuffle(catalog.filter(x => !played.has(x.animeId)), rng), ...shuffle(catalog.filter(x => played.has(x.animeId)), rng)];
  const eligible = ordered.filter(entry => {
    if (category && (entry.category || 'anime') !== category) return false;
    if (seen.has(entry.franchiseId)) return false;
    try { buildChoices(entry, catalog, rng); } catch { return false; }
    seen.add(entry.franchiseId);
    return true;
  });
  if (eligible.length < count) throw new Error(t('Недостаточно доступных произведений для партии (аниме, кино или сериалы).', 'Not enough available titles for a game (anime, movies or series).'));
  return eligible.slice(0, count);
}

export function createRound(entry) {
  return { entry, phase: 'ready', deadline: null, selectedId: null, correct: false, points: 0 };
}

export function startRound(round, now) {
  if (round.phase !== 'ready') return false;
  round.phase = 'playing';
  round.deadline = now + ROUND_MS;
  return true;
}

export function remainingTime(round, now) {
  return round.deadline === null ? ROUND_MS : Math.min(ROUND_MS, Math.max(0, round.deadline - now));
}

export function scoreAnswer(correct, remainingMs) {
  if (!correct || remainingMs <= 0) return 0;
  return 100 + Math.floor(300 * Math.min(ROUND_MS, remainingMs) / ROUND_MS);
}

export function answerRound(round, selectedId, now) {
  if (round.phase !== 'playing') return false;
  round.selectedId = selectedId;
  round.correct = remainingTime(round, now) > 0 && selectedId === round.entry.animeId;
  round.points = scoreAnswer(round.correct, remainingTime(round, now));
  round.phase = 'revealed';
  return true;
}

export function interruptRound(round) {
  if (!round || round.phase === 'revealed' || round.phase === 'error') return false;
  round.phase = 'error';
  return true;
}
