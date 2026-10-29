import { t } from '../shared/i18n.js?v=ui-20261029';
// Правила «Угадай страну»: покупки, очки, платные направления и ротация стран.
export const START = 1000, WRONG = 50;
// Первый факт бесплатен. Все остальные подсказки можно покупать независимо.
export const CLUES = [
  { key: 'fact1', cost: 0, label: t('Первый факт', 'First fact') },
  { key: 'fact2', cost: 50, label: t('Ещё факт', 'Another fact') },
  { key: 'phrase', cost: 75, label: t('Язык', 'Language') },
  { key: 'food', cost: 75, label: t('Кухня', 'Food') },
  { key: 'money', cost: 100, label: t('Валюта', 'Currency') },
  { key: 'person', cost: 150, label: t('Известный человек', 'Famous person') },
  { key: 'walk', cost: 150, label: t('Прогулка', 'Street walk') },
  { key: 'shape', cost: 200, label: t('Контур страны', 'Country outline') },
  { key: 'compass', cost: 100, label: t('Направление', 'Direction') },
];
// free оставлен для совместимости; отсутствующие подсказки блокируются через unavailable.
export const cluePrice = (r, key) => (r.free.includes(key) ? 0 : r.prices[key] ?? CLUES.find(c => c.key === key).cost);
export function currencyPrice(label, labels) {
  const family = value => value.replace(' США', '').replace('Риял', 'Риал');
  const count = labels.filter(value => family(value) === family(label)).length;
  return count >= 8 ? 50 : count >= 2 ? 100 : 175;
}

export const norm = s => String(s).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Словарь «как могут написать» → код страны. world: [[код, название, …]], extra: [{ id, name, aliases }].
export function nameIndex(world, extra = []) {
  const map = new Map();
  for (const [id, name] of world) map.set(norm(name), id);
  for (const c of extra) for (const n of [c.name, ...(c.aliases || [])]) map.set(norm(n), c.id);
  return map;
}
export const matchCountry = (text, index) => index.get(norm(text)) || null;

export function newRound(id, free = [], unavailable = [], prices = {}) {
  return { id, free, unavailable, prices, open: ['fact1'], wrong: [], score: START, done: false, solved: false };
}
export const canOpen = (r, key) => CLUES.some(c => c.key === key) && !r.done && !r.open.includes(key)
  && !r.unavailable.includes(key) && r.score >= cluePrice(r, key) && (key !== 'compass' || r.wrong.length > 0);
export function openClue(r, key) {
  if (!canOpen(r, key)) return false;
  r.open.push(key);
  r.score = Math.max(0, r.score - cluePrice(r, key));
  return true;
}
export function refundWalk(r) {
  if (r.done || !r.open.includes('walk') || r.unavailable.includes('walk')) return false;
  r.open = r.open.filter(key => key !== 'walk');
  r.score = Math.max(0, START - r.wrong.length * WRONG - r.open.reduce((sum, key) => sum + cluePrice(r, key), 0));
  r.unavailable.push('walk');
  return true;
}

const rad = d => d * Math.PI / 180;
export function distanceKm([lat1, lon1], [lat2, lon2]) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(a)));
}
// Куда идти от ошибочной страны к правильной: одна из 8 стрелок.
export function arrow([lat1, lon1], [lat2, lon2]) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][Math.round(deg / 45) % 8];
}

// at: код → [широта, долгота]. Возвращает null, если такой ответ уже был.
export function guess(r, id, at) {
  if (r.done || r.wrong.some(w => w.id === id)) return null;
  if (id === r.id) { r.done = r.solved = true; return { correct: true }; }
  const miss = { id };
  r.wrong.push(miss);
  r.score = Math.max(0, r.score - WRONG);
  return { correct: false, ...miss };
}
// Направления доступны только после покупки; расстояние больше не выдаёт бесплатную подсказку.
export function guidance(r, at) {
  return r.open.includes('compass') ? r.wrong.map(m => ({ id: m.id, dir: arrow(at(m.id), at(r.id)) })) : [];
}

export function shuffle(items, rnd = Math.random) {
  const deck = [...items];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
// Не повторяем страну, пока не исчерпана подборка; на границе цикла сначала идут ещё не сыгранные.
export function countryOrder(ids, rounds, recent = [], rnd = Math.random) {
  const unique = [...new Set(ids)], unseen = unique.filter(id => !recent.includes(id));
  const seen = unique.filter(id => recent.includes(id)).sort((a, b) => recent.lastIndexOf(a) - recent.lastIndexOf(b));
  return [...shuffle(unseen, rnd), ...seen].slice(0, Math.max(0, Math.min(rounds, unique.length)));
}
export function selectFacts(facts, used = [], rnd = Math.random) {
  const unique = [...new Set(facts)], fresh = shuffle(unique.filter(f => !used.includes(f)), rnd);
  return [...fresh, ...shuffle(unique.filter(f => used.includes(f)), rnd)].slice(0, 2);
}
export function surrender(r) {
  if (r.done) return;
  r.done = true;
  r.score = 0;
}

// Партия: случайные страны из подборки, у каждого игрока свой счёт.
// freeOf(id) — список бесплатных улик для страны.
export function createGame(ids, rounds, names, { rnd = Math.random, recent = [], freeOf = () => [], unavailableOf = () => [], pricesOf = () => ({}) } = {}) {
  const order = countryOrder(ids, rounds, recent, rnd);
  if (!order.length) throw new Error('Нет стран в подборке');
  return { order, index: 0, freeOf, unavailableOf, pricesOf, players: names.map(name => ({ name, score: 0 })), log: [], round: newRound(order[0], freeOf(order[0]), unavailableOf(order[0]), pricesOf(order[0])) };
}
// Очки раунда достаются тому, кто раскрыл страну (who — номер игрока, null — никто).
export function award(g, who) {
  const r = g.round;
  const pts = r.solved && who != null ? r.score : 0;
  if (pts) g.players[who].score += pts;
  g.log.push({ id: r.id, who: pts ? who : null, pts, solved: r.solved });
}
export function nextRound(g) {
  g.index += 1;
  g.round = g.index < g.order.length ? newRound(g.order[g.index], g.freeOf(g.order[g.index]), g.unavailableOf(g.order[g.index]), g.pricesOf(g.order[g.index])) : null;
  return g.round;
}
