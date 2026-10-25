// Правила «Угадай страну» без интерфейса: улики, очки, ошибки с «тепло/холодно».
export const START = 1000, WRONG = 50;
// Порядок на доске. Первый факт открыт сразу; форма страны — последняя улика.
export const CLUES = [
  { key: 'fact1', cost: 0, label: 'Архив' },
  { key: 'fact2', cost: 50, label: 'Ещё факт' },
  { key: 'phrase', cost: 75, label: 'Язык' },
  { key: 'food', cost: 75, label: 'Кухня' },
  { key: 'walk', cost: 125, label: 'Прогулка' },
  { key: 'money', cost: 150, label: 'Валюта' },
  { key: 'person', cost: 200, label: 'Знаменитость' },
  { key: 'shape', cost: 250, label: 'Форма страны' },
];
// free — улики, которые в этом раунде ничего не стоят (прогулка там, где Google не снимал улицы).
const cost = (r, key) => (r.free.includes(key) ? 0 : CLUES.find(c => c.key === key).cost);

export const norm = s => String(s).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Словарь «как могут написать» → код страны. world: [[код, название, …]], extra: [{ id, name, aliases }].
export function nameIndex(world, extra = []) {
  const map = new Map();
  for (const [id, name] of world) map.set(norm(name), id);
  for (const c of extra) for (const n of [c.name, ...(c.aliases || [])]) map.set(norm(n), c.id);
  return map;
}
export const matchCountry = (text, index) => index.get(norm(text)) || null;

export function newRound(id, free = []) {
  return { id, free, open: ['fact1'], wrong: [], score: START, done: false, solved: false };
}
// Форма открывается, только когда все остальные улики уже на доске.
export const canOpen = (r, key) => !r.done && !r.open.includes(key) && (key !== 'shape' || CLUES.every(c => c.key === 'shape' || r.open.includes(c.key)));
export function openClue(r, key) {
  if (!canOpen(r, key)) return false;
  r.open.push(key);
  r.score = Math.max(0, r.score - cost(r, key));
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
  const miss = { id, km: distanceKm(at(id), at(r.id)), dir: arrow(at(id), at(r.id)) };
  r.wrong.push(miss);
  r.score = Math.max(0, r.score - WRONG);
  return { correct: false, ...miss };
}
export function surrender(r) {
  if (r.done) return;
  r.done = true;
  r.score = 0;
}

// Партия: случайные страны из подборки, у каждого игрока свой счёт.
// freeOf(id) — список бесплатных улик для страны.
export function createGame(ids, rounds, names, { rnd = Math.random, freeOf = () => [] } = {}) {
  const deck = [...ids];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const order = deck.slice(0, Math.min(rounds, deck.length));
  return { order, index: 0, freeOf, players: names.map(name => ({ name, score: 0 })), log: [], round: newRound(order[0], freeOf(order[0])) };
}
// Очки раунда достаются тому, кто раскрыл страну (who — номер игрока, null — никто).
export function award(g, who) {
  const r = g.round;
  const pts = r.solved && who != null ? r.score : 0;
  if (pts) g.players[who].score += pts;
  g.log.push({ id: r.id, who: pts ? who : null, pts });
}
export function nextRound(g) {
  g.index += 1;
  g.round = g.index < g.order.length ? newRound(g.order[g.index], g.freeOf(g.order[g.index])) : null;
  return g.round;
}
