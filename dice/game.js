// Костяшки (knucklebones из Cult of the Lamb): чистая логика. Хост держит состояние.
import { t as tr } from '../shared/i18n.js?v=ui-20261029';
export const BOT_ID = 'bot';
export const MAX_PLAYERS = 8;
const COLORS = ['#ff4d6d', '#22b5a0', '#f08a24', '#7c5cff', '#3fa7ff', '#e05ad1', '#9bd13f', '#ffb020'];

// Одинаковые кости в столбце умножаются: каждая стоит value × их количество (4,4 → 16; 4,4,4 → 36).
export function colScore(col) {
  const n = {};
  for (const v of col) n[v] = (n[v] || 0) + 1;
  return Object.entries(n).reduce((sum, [v, k]) => sum + v * k * k, 0);
}
export const total = board => board.reduce((sum, col) => sum + colScore(col), 0);
export const humans = s => s.players.filter(p => !p.bot);
export const opponent = (s, id) => s.duel.find(x => x !== id);
const roll = rnd => 1 + Math.floor(rnd() * 6);
const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function finish(t, forced) {
  const [x, y] = t.duel, sx = total(t.boards[x]), sy = total(t.boards[y]);
  t.winner = forced ?? (sx === sy ? 'draw' : sx > sy ? x : y);
  if (t.winner !== 'draw') t.wins[t.winner] = (t.wins[t.winner] || 0) + 1;
  Object.assign(t, { phase: 'over', die: null, turn: null, lastCall: false });
}

export function createState(hostId, code) {
  return { code, hostId, phase: 'lobby', rev: 0, players: [], duel: [], boards: {}, turn: null, die: null, turnAt: 0, starter: 0, match: 0, last: null, winner: null, wins: {} };
}

// Жадный бот: очки себе + очки, снесённые у соперника.
export function botMove(s, rnd = Math.random) {
  const mine = s.boards[s.turn], theirs = s.boards[opponent(s, s.turn)];
  let best = -Infinity, cols = [];
  for (let c = 0; c < 3; c++) {
    if (mine[c].length >= 3) continue;
    const gain = colScore([...mine[c], s.die]) - colScore(mine[c]);
    const hit = colScore(theirs[c]) - colScore(theirs[c].filter(v => v !== s.die));
    const v = gain + hit * 1.1;
    if (v > best) { best = v; cols = [c]; } else if (v === best) cols.push(c);
  }
  return cols[Math.floor(rnd() * cols.length)];
}

export function reduce(s, a, from, now = Date.now(), rnd = Math.random) {
  if (!a || typeof a.type !== 'string') return s;
  const isHost = from === s.hostId;
  const t = structuredClone(s);
  const me = t.players.find(p => p.id === from);

  switch (a.type) {
    case 'join': {
      if (from === BOT_ID || t.banned?.includes(from)) return s;
      const name = clean(a.name, 20) || tr('Игрок', 'Player');
      if (me) { me.name = name; me.online = true; break; }
      if (humans(t).length >= MAX_PLAYERS) return s;
      t.players.splice(humans(t).length, 0, { id: from, name, color: COLORS[humans(t).length % COLORS.length], online: true });
      break;
    }
    case 'online': {
      const p = t.players.find(p => p.id === a.id);
      if (!isHost || !p || p.bot) return s;
      p.online = !!a.on;
      break;
    }
    case 'start': {
      if (!isHost || t.phase === 'play') return s;
      let hs = humans(t);
      // царь горы: проигравший уходит в конец очереди, следующий садится играть
      if (t.phase === 'over' && t.winner && t.winner !== 'draw' && hs.length > 2) {
        const loser = opponent(t, t.winner);
        hs = [...hs.filter(p => p.id !== loser), hs.find(p => p.id === loser)];
      }
      const duel = hs.length >= 2 ? [hs[0].id, hs[1].id] : [hs[0].id, BOT_ID];
      t.players = hs;
      if (duel[1] === BOT_ID) t.players.push({ id: BOT_ID, name: tr('Скелет', 'Skeleton'), bot: true, color: '#b9a98a', online: true });
      if (String(t.duel) !== String(duel)) { t.wins = {}; t.starter = 0; } // другая пара — новая серия
      Object.assign(t, {
        duel, boards: { [duel[0]]: [[], [], []], [duel[1]]: [[], [], []] },
        turn: duel[t.starter % 2], die: roll(rnd), turnAt: now, last: null, winner: null, phase: 'play', moves: {}, lastCall: false,
      });
      t.starter++; t.match++;
      break;
    }
    case 'place': {
      const col = a.col;
      if (t.phase !== 'play' || from !== t.turn || !Number.isInteger(col) || col < 0 || col > 2) return s;
      const mine = t.boards[from];
      if (mine[col].length >= 3) return s;
      const opp = opponent(t, from), v = t.die;
      mine[col].push(v);
      const before = t.boards[opp][col].length;
      t.boards[opp][col] = t.boards[opp][col].filter(x => x !== v);
      t.last = { seq: (t.last?.seq || 0) + 1, by: from, col, value: v, destroyed: before - t.boards[opp][col].length };
      t.moves = { ...t.moves, [from]: (t.moves?.[from] || 0) + 1 };
      const oppHasRoom = t.boards[opp].some(c => c.length < 3);
      // поле заполнено: если соперник сделал на ход меньше (ходил вторым), у него есть последний ход
      if (t.lastCall || (mine.every(c => c.length === 3) && !((t.moves[opp] || 0) < t.moves[from] && oppHasRoom))) finish(t);
      else Object.assign(t, { turn: opp, die: roll(rnd), turnAt: now, lastCall: mine.every(c => c.length === 3) });
      break;
    }
    case 'kick': { // хост выгоняет игрока; зайти по коду снова он уже не сможет
      const p = t.players.find(x => x.id === a.id);
      if (!isHost || !p || p.bot || p.id === t.hostId) return s;
      t.players = t.players.filter(x => x.id !== a.id);
      t.banned = [...(t.banned || []), a.id];
      if (t.phase === 'play' && t.duel.includes(a.id)) finish(t, opponent(t, a.id)); // выгнали посреди партии — победа второму
      break;
    }
    case 'lobby': {
      if (!isHost || t.phase !== 'over') return s;
      t.phase = 'lobby';
      t.players = humans(t);
      break;
    }
    default: return s;
  }
  t.rev++;
  return t;
}
