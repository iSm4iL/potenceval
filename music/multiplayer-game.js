import { guess, guessArtist, skip, openStep, surrender, nextRound, replaceBroken, restoreGame } from './game.js';

export const MULTIPLIERS = [1.5, 1.25, 1, .75, .5];
export const rankMultiplier = rank => MULTIPLIERS[Math.min(rank - 1, MULTIPLIERS.length - 1)];
const clean = (v, max = 20) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const personal = ({ tracks, queue, reserve, ...g }) => g;
export const gameFor = (s, pid) => s.games[pid] ? { ...s.base, ...s.games[pid] } : null;
const active = s => s.players.filter(p => p.online && s.games[p.id]);

export function createRoom(hostId, code, settings = {}) {
  return { version: 1, hostId, code, settings, phase: 'lobby', players: [], games: {}, base: null, ready: {}, audioErrors: {}, rank: [], round: '', serial: 0, banned: [] };
}

function begin(s) {
  s.phase = 'loading'; s.ready = {}; s.audioErrors = {}; s.rank = [];
  s.round = String(++s.serial);
}

function settle(s) {
  const playing = active(s);
  if (s.phase === 'loading' && playing.length && playing.every(p => s.ready[p.id])) s.phase = 'round';
  if (s.phase === 'round' && playing.length && playing.every(p => s.games[p.id].phase === 'reveal')) {
    for (const p of s.players) {
      const g = gameFor(s, p.id);
      if (g?.phase === 'round') { s.games[p.id] = personal(surrender(g)); p.score = s.games[p.id].score; }
    }
    s.phase = 'reveal';
  }
  return s;
}

export function reduceRoom(s, a, from) {
  if (!a || typeof a.type !== 'string' || typeof from !== 'string' || !from || from.length > 24) return s;
  const host = from === s.hostId;
  if (a.type === 'verifiedGuess') {
    if (!host || typeof a.by !== 'string') return s;
    from = a.by;
  }
  const p = s.players.find(p => p.id === from);
  const t = { ...s, players: s.players.map(p => ({ ...p })), games: { ...s.games }, ready: { ...s.ready }, audioErrors: { ...s.audioErrors }, rank: [...s.rank] };
  switch (a.type) {
    case 'join': {
      if (s.banned.includes(from)) return s;
      if (p) { Object.assign(t.players.find(p => p.id === from), { name: clean(a.name) || 'Игрок', online: true }); break; }
      if (s.players.length >= 8) return s;
      t.players.push({ id: from, name: clean(a.name) || 'Игрок', online: true, score: 0 });
      break;
    }
    case 'online': {
      if (!host || !s.players.some(p => p.id === a.id) || a.id === s.hostId) return s;
      t.players.find(p => p.id === a.id).online = !!a.on;
      break;
    }
    case 'kick': {
      if (!host || a.id === s.hostId || !s.players.some(p => p.id === a.id)) return s;
      t.players = t.players.filter(p => p.id !== a.id); delete t.games[a.id]; delete t.ready[a.id];
      t.banned = [...s.banned, a.id];
      break;
    }
    case 'start': {
      if (!host || !['lobby', 'summary'].includes(s.phase) || s.players.filter(p => p.online).length < 2 || !restoreGame(a.game) || a.game.phase !== 'round' || a.game.index !== 0) return s;
      t.base = a.game; t.games = {};
      for (const p of t.players) { p.score = 0; if (p.online) t.games[p.id] = personal(a.game); }
      begin(t); break;
    }
    case 'back': {
      if (!host || s.phase !== 'summary') return s;
      t.phase = 'lobby'; t.games = {}; t.base = null; break;
    }
    case 'next': {
      if (!host || s.phase !== 'reveal' || a.round !== s.round) return s;
      for (const id of Object.keys(t.games)) t.games[id] = personal(nextRound(gameFor(t, id)));
      if (Object.values(t.games).every(g => g.phase === 'summary')) t.phase = 'summary';
      else begin(t);
      break;
    }
    case 'replace': {
      if (!host || !['loading', 'round'].includes(s.phase) || a.round !== s.round || Object.values(s.games).some(g => g.phase !== 'round')) return s;
      const original = gameFor(s, s.hostId), replacement = replaceBroken(original);
      t.base = { ...s.base, queue: replacement.queue, reserve: replacement.reserve };
      for (const id of Object.keys(t.games)) t.games[id] = { ...t.games[id], step: 0, attempts: [], index: replacement.index, phase: replacement.phase };
      if (replacement.phase === 'summary') t.phase = 'summary'; else begin(t);
      break;
    }
    default: {
      if (!p?.online || !s.games[from] || a.round !== s.round) return s;
      if (a.type === 'ready') {
        if (!['loading', 'round'].includes(s.phase) || s.ready[from]) return s;
        t.ready[from] = true; delete t.audioErrors[from]; break;
      }
      if (a.type === 'audio-error') {
        if (!['loading', 'round'].includes(s.phase) || t.audioErrors[from]) return s;
        t.audioErrors[from] = true; delete t.ready[from]; break;
      }
      const g = gameFor(s, from);
      if (s.phase !== 'round' || g.phase !== 'round' || a.step !== g.step) return s;
      let next = g;
      if (a.type === 'skip') next = skip(g);
      else if (a.type === 'open') next = openStep(g, a.index);
      else if (a.type === 'surrender') next = surrender(g);
      else if (a.type === 'guess' || a.type === 'verifiedGuess') {
        const answer = a.answer;
        if (g.answerMode === 'artist') {
          if (answer?.kind !== 'artist' || typeof answer.artistId !== 'string' || !/^\d{1,20}$/.test(answer.artistId) || !clean(answer.name, 180)) return s;
          next = guessArtist(g, { kind: 'artist', id: `artist-${answer.artistId}`, artistId: answer.artistId, name: clean(answer.name, 180) });
        } else {
          // Known tracks always use the host's metadata; external editions are resolved by the host first.
          const track = g.tracks.find(track => track.id === answer?.id) || (a.type === 'verifiedGuess' ? answer : null);
          if (!track) return s;
          next = guess(g, track);
        }
      }
      if (next === g) return s;
      t.games[from] = personal(next);
      if (next.phase === 'reveal') {
        const result = next.results.at(-1);
        const rank = result.won ? t.rank.push(from) : null;
        const multiplier = rank ? rankMultiplier(rank) : 1;
        const points = Math.round(result.points * multiplier);
        t.games[from] = { ...t.games[from], results: [...next.results.slice(0, -1), { ...result, points, basePoints: result.points, rank, multiplier }], score: next.score - result.points + points };
        t.players.find(p => p.id === from).score = t.games[from].score;
      }
    }
  }
  return settle(t);
}

export function roomView(s, pid) {
  const g = gameFor(s, pid), revealed = ['reveal', 'summary'].includes(s.phase);
  let game = null;
  if (g && (revealed || g.phase === 'round')) {
    const visible = new Set(s.base.queue.slice(0, g.index + (revealed ? 1 : 0)));
    const current = s.base.tracks.find(t => t.id === s.base.queue[g.index]);
    const tracks = s.base.tracks.filter(t => visible.has(t.id));
    if (!revealed && current) tracks.push({ id: current.id, deezerId: current.deezerId, title: '', artist: '', artistIds: [], artistNames: [], answerKey: '' });
    game = { ...g, tracks, queue: g.queue.map((id, i) => i <= g.index || revealed && s.phase === 'summary' ? id : `hidden-${i}`), reserve: [] };
  }
  return {
    version: s.version, code: s.code, hostId: s.hostId, phase: s.phase, settings: s.settings, round: s.round,
    index: g?.index ?? s.games[s.hostId]?.index ?? 0, total: s.base?.queue.length ?? 0,
    spectator: !g && !['lobby', 'summary'].includes(s.phase), game,
    nextMultiplier: rankMultiplier(s.rank.length + 1),
    canReplace: ['loading', 'round'].includes(s.phase) && Object.values(s.games).every(g => g.phase === 'round'),
    players: s.players.map(p => {
      const own = s.games[p.id], result = own?.phase === 'reveal' || s.phase === 'summary' ? own?.results.at(-1) : null;
      return { ...p, ready: !!s.ready[p.id], audioError: !!s.audioErrors?.[p.id], participating: !!own, done: own?.phase === 'reveal', won: !!result?.won, points: result?.points ?? 0, rank: result?.rank ?? null, multiplier: result?.multiplier ?? null };
    }),
  };
}
