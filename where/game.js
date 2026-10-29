// «Где я?» (как GeoGuessr): чистая логика. Хост держит состояние, остальные шлют действия.
import { t as tr } from '../shared/i18n.js?v=ui-20261029';
import { SPOTS } from './spots.js';

export const MAX_PLAYERS = 8;
export const ROUNDS = [3, 5, 10], TIMES = [0, 60, 120]; // 0 — без таймера
export const RUSH = 30; // первый поставил точку — остальным не больше 30 секунд
const COLORS = ['#ff4d6d', '#22b5a0', '#f08a24', '#7c5cff', '#3fa7ff', '#e05ad1', '#9bd13f', '#ffb020'];
const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

const rad = d => d * Math.PI / 180;
export function distanceKm([lat1, lon1], [lat2, lon2]) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
// Как в GeoGuessr на карте мира: 5000 в точку, ~3000 за 750 км, ~400 за 3700 км.
export const points = km => Math.round(5000 * Math.exp(-km / 1492.7));

// Колода партии: случайные места, каждое из своей страны.
export function deal(n, rnd = Math.random, spots = SPOTS) {
  const order = [...spots.keys()];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const seen = new Set(), fresh = order.filter(i => !seen.has(spots[i][0]) && seen.add(spots[i][0]));
  const taken = new Set(fresh);
  return [...fresh, ...order.filter(i => !taken.has(i))].slice(0, n); // страны кончились — повторы
}

export function createState(hostId, code) {
  return { code, hostId, phase: 'lobby', rev: 0, players: [], rounds: 5, time: 60, deck: [], round: 0, spot: null, heading: 0, endsAt: 0, guesses: {}, log: [] };
}
const playing = s => s.players.filter(p => p.online);
// Все, кто на связи, ответили — открываем ответ, не дожидаясь таймера.
const settle = t => { if (t.phase === 'guess' && playing(t).every(p => t.guesses[p.id])) reveal(t); };

function reveal(t) {
  t.phase = 'reveal'; t.endsAt = 0;
  t.log.push({ spot: t.spot, guesses: t.guesses });
}
function deal1(t, now, rnd) {
  t.round++;
  t.spot = SPOTS[t.deck[t.round - 1]];
  t.heading = Math.floor(rnd() * 360);
  t.guesses = {};
  t.endsAt = t.time ? now + t.time * 1000 : 0;
  t.phase = 'guess';
}

export function reduce(s, a, from, now = Date.now(), rnd = Math.random) {
  if (!a || typeof a.type !== 'string') return s;
  const isHost = from === s.hostId;
  const t = structuredClone(s);
  const me = t.players.find(p => p.id === from);

  switch (a.type) {
    case 'join': {
      if (t.banned?.includes(from)) return s;
      const name = clean(a.name, 20) || tr('Игрок', 'Player');
      if (me) { me.name = name; me.online = true; break; }
      if (t.players.length >= MAX_PLAYERS) return s;
      t.players.push({ id: from, name, color: COLORS[t.players.length % COLORS.length], online: true, score: 0 });
      break;
    }
    case 'online': {
      const p = t.players.find(p => p.id === a.id);
      if (!isHost || !p) return s;
      p.online = !!a.on;
      settle(t);
      break;
    }
    case 'kick': {
      if (!isHost || a.id === t.hostId || !t.players.some(p => p.id === a.id)) return s;
      t.players = t.players.filter(p => p.id !== a.id);
      t.banned = [...(t.banned || []), a.id];
      settle(t);
      break;
    }
    case 'set': {
      if (!isHost || t.phase !== 'lobby') return s;
      if (a.k === 'rounds' && ROUNDS.includes(a.v)) t.rounds = a.v;
      else if (a.k === 'time' && TIMES.includes(a.v)) t.time = a.v;
      else return s;
      break;
    }
    case 'start': {
      if (!isHost || t.phase === 'guess' || t.phase === 'reveal') return s;
      t.players.forEach(p => { p.score = 0; });
      Object.assign(t, { deck: deal(t.rounds, rnd), round: 0, log: [] });
      deal1(t, now, rnd);
      break;
    }
    case 'guess': {
      const { lat, lng } = a;
      if (t.phase !== 'guess' || !me || t.guesses[from] || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return s;
      const km = distanceKm([lat, lng], [t.spot[1], t.spot[2]]);
      t.guesses[from] = { lat, lng, km: Math.round(km * 10) / 10, pts: points(km) };
      me.score += t.guesses[from].pts;
      settle(t);
      if (t.phase === 'guess' && Object.keys(t.guesses).length === 1 && t.players.length > 1 && (!t.endsAt || t.endsAt - now > RUSH * 1000)) t.endsAt = now + RUSH * 1000;
      break;
    }
    case 'timeout': { // хост: время вышло
      if (!isHost || t.phase !== 'guess' || !t.endsAt || now < t.endsAt) return s;
      reveal(t);
      break;
    }
    case 'next': {
      if (!isHost || t.phase !== 'reveal') return s;
      if (t.round >= t.deck.length) t.phase = 'over';
      else deal1(t, now, rnd);
      break;
    }
    case 'lobby': {
      if (!isHost || t.phase !== 'over') return s;
      t.phase = 'lobby';
      break;
    }
    default: return s;
  }
  t.rev++;
  return t;
}
// Пока раунд идёт, чужие точки не показываем — только что игрок уже ответил.
export function publicView(s, id) {
  if (s.phase !== 'guess') return s;
  return { ...s, guesses: Object.fromEntries(Object.entries(s.guesses).map(([k, g]) => [k, k === id ? g : { done: true }])) };
}
