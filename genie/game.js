// Логика игры: чистые функции. Хост держит состояние, клиенты присылают действия.
import { DECK, GENIE_ANY } from './content.js';

export const MAX_PLAYERS = 8;
const COLORS = ['#ff4d6d', '#22b5a0', '#f08a24', '#7c5cff', '#3fa7ff', '#e05ad1', '#9bd13f', '#ffb020'];
export const GENIE_ID = 'genie';

export function createState(hostId, code) {
  return {
    code, hostId, phase: 'lobby', rev: 0,
    players: [{ id: GENIE_ID, name: 'Джинн', genie: true, color: '#c99a1e', score: 0, online: true }],
    settings: { laps: 1, sec: 60 },
    order: [], round: 0, wisher: null, power: null,
    cards: [], revealed: 0, chosen: null, took: null, deadline: null, used: [],
  };
}

export const humans = s => s.players.filter(p => !p.genie);
const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const shuffle = (arr, rnd) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const validIndex = (s, i, limit = s.cards.length) => Number.isInteger(i) && i >= 0 && i < limit;
const writers = s => humans(s).filter(p => p.id !== s.wisher && p.online);

function startRound(t) {
  Object.assign(t, { wisher: t.order[t.round], phase: 'power', power: null, cards: [], revealed: 0, chosen: null, took: null, deadline: null });
}
function toWrite(t, now, rnd) {
  const deck = t.power.id && DECK.find(d => d.id === t.power.id);
  t.phase = 'write';
  t.deadline = now + t.settings.sec * 1000;
  t.cards = [{ by: GENIE_ID, text: pick(deck ? deck.genie : GENIE_ANY, rnd), fire: 0, adds: [] }];
}
function toReveal(t, rnd) {
  const genie = t.cards.filter(c => c.by === GENIE_ID);
  t.cards = [...shuffle(t.cards.filter(c => c.by !== GENIE_ID), rnd), ...genie]; // Джинн — последним
  Object.assign(t, { phase: 'reveal', revealed: 0, deadline: null });
}

// Возвращает новое состояние или тот же объект, если действие не применимо.
export function reduce(s, a, from, now = Date.now(), rnd = Math.random) {
  if (!a || typeof a.type !== 'string') return s;
  const isHost = from === s.hostId;
  const drive = isHost || from === s.wisher;
  const t = structuredClone(s);
  const me = t.players.find(p => p.id === from);

  switch (a.type) {
    case 'join': {
      const name = clean(a.name, 20) || 'Игрок';
      if (me) { me.name = name; me.online = true; break; }
      if (humans(t).length >= MAX_PLAYERS) return s;
      t.players.splice(t.players.length - 1, 0, { id: from, name, color: COLORS[humans(t).length % COLORS.length], score: 0, online: true });
      if (t.phase !== 'lobby' && t.phase !== 'final') t.order.push(from); // зашёл посреди игры — тоже загадает
      break;
    }
    case 'online': {
      const p = t.players.find(p => p.id === a.id);
      if (!isHost || !p || p.genie) return s;
      p.online = !!a.on;
      break;
    }
    case 'settings': {
      if (!isHost || t.phase !== 'lobby') return s;
      if ([1, 2, 3].includes(a.laps)) t.settings.laps = a.laps;
      if ([45, 60, 90].includes(a.sec)) t.settings.sec = a.sec;
      break;
    }
    case 'start': {
      if (!isHost || (t.phase !== 'lobby' && t.phase !== 'final')) return s;
      t.players.forEach(p => { p.score = 0; });
      const ids = humans(t).map(p => p.id);
      t.order = Array.from({ length: t.settings.laps }, () => shuffle(ids, rnd)).flat();
      t.round = 0;
      startRound(t);
      break;
    }
    case 'draw': {
      if (!drive || t.phase !== 'power') return s;
      let pool = DECK.filter(d => !t.used.includes(d.id) && d.id !== t.power?.id);
      if (!pool.length) { t.used = []; pool = DECK.filter(d => d.id !== t.power?.id); }
      const d = pick(pool, rnd);
      t.power = { id: d.id, icon: d.icon, title: d.title, text: d.text };
      t.used.push(d.id);
      break;
    }
    case 'custom': {
      const text = clean(a.text, 80);
      if (!drive || t.phase !== 'power' || !text) return s;
      t.power = { id: null, icon: '✨', title: text, text: '' };
      break;
    }
    case 'submit': {
      const text = clean(a.text, 120);
      if (t.phase !== 'write' || !me || me.genie || from === t.wisher || !text) return s;
      const own = t.cards.find(c => c.by === from);
      if (own) own.text = text; else t.cards.push({ by: from, text, fire: 0, adds: [] });
      if (writers(t).every(p => t.cards.some(c => c.by === p.id))) toReveal(t, rnd);
      break;
    }
    case 'timeout': {
      if (!isHost || t.phase !== 'write' || now < t.deadline) return s;
      toReveal(t, rnd);
      break;
    }
    case 'flip': {
      if (!drive || t.phase !== 'reveal' || t.revealed >= t.cards.length) return s;
      t.revealed++;
      break;
    }
    case 'fire': {
      const visible = t.phase === 'reveal' ? t.revealed : t.cards.length;
      if (!['reveal', 'hype', 'verdict', 'share'].includes(t.phase) || !validIndex(t, a.i, visible)) return s;
      t.cards[a.i].fire++;
      break;
    }
    case 'add': {
      const text = clean(a.text, 90);
      if (t.phase !== 'hype' || !me || !text || !validIndex(t, a.i) || t.cards[a.i].adds.length >= 5) return s;
      t.cards[a.i].adds.push({ by: from, text });
      break;
    }
    case 'choose': {
      if (!drive || t.phase !== 'verdict' || t.took !== null || !validIndex(t, a.i)) return s;
      t.chosen = a.i;
      break;
    }
    case 'decide': {
      if (!drive || t.phase !== 'verdict' || t.chosen === null || t.took !== null) return s;
      t.took = !!a.take;
      const scorer = t.took ? t.wisher : t.cards[t.chosen].by;
      const p = t.players.find(p => p.id === scorer);
      if (p) p.score++;
      break;
    }
    case 'next': {
      if (!drive) return s;
      if (t.phase === 'power') { if (!t.power) return s; toWrite(t, now, rnd); }
      else if (t.phase === 'write') toReveal(t, rnd);
      else if (t.phase === 'reveal') { t.revealed = t.cards.length; t.phase = 'hype'; }
      else if (t.phase === 'hype') t.phase = 'verdict';
      else if (t.phase === 'verdict') { if (t.took === null) return s; t.phase = 'share'; }
      else if (t.phase === 'share') { t.round++; if (t.round >= t.order.length) t.phase = 'final'; else startRound(t); }
      else return s;
      break;
    }
    case 'lobby': {
      if (!isHost || t.phase !== 'final') return s;
      t.phase = 'lobby';
      break;
    }
    default: return s;
  }
  t.rev++;
  return t;
}

// Что видит конкретный игрок: чужие подвохи скрыты, пока их не раскрыли.
export function publicView(s, viewer) {
  const { used, ...v } = s;
  v.cards = s.cards.map((c, i) => {
    const visible = s.phase === 'write' ? c.by === viewer : s.phase === 'reveal' ? i < s.revealed : true;
    return visible ? c : { ...c, text: null, adds: [] };
  });
  return v;
}
