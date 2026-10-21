// Лобби по коду: хост держит состояние у себя в браузере, остальные шлют ему действия.
// ponytail: P2P через публичный сервер PeerJS — без своего бэкенда; если хост закрыл вкладку,
// игра ждёт его возвращения. Нужен свой сервер (Durable Objects), если это станет мешать.
import { LS, me, toast, hideToast } from './kit.js';

// tick(state, apply) — хост вызывает каждые полсекунды (таймеры, ходы бота).
export function createNet({ game, createState, reduce, publicView = s => s, reserved = [], tick, onState, onLeave }) {
  const PREFIX = `potenceval-${game}-`;
  const key = k => game + '.' + k;
  let peer = null, conn = null, isHost = false, hostState = null, hostTimer = null, retryT = null, retries = 0, everConnected = false;
  const conns = new Map();
  const newCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

  function peerReady() {
    if (typeof Peer !== 'undefined') return true;
    toast('Не загрузился модуль связи. Обнови страницу.', 4000);
    return false;
  }
  function closePeer() {
    clearTimeout(retryT); clearInterval(hostTimer);
    const p = peer; peer = null; conn = null; conns.clear();
    if (p && !p.destroyed) p.destroy();
  }

  function host(code = newCode(), restored = null, tries = 0) {
    if (!peerReady()) return;
    closePeer(); isHost = true;
    toast(restored ? 'Восстанавливаю лобби…' : 'Создаю лобби…');
    const p = peer = new Peer(PREFIX + code);
    p.on('open', () => {
      hideToast();
      let s = restored || createState(me.pid, code);
      if (restored) s = { ...s, players: s.players.map(x => (x.genie || x.bot || x.id === me.pid ? x : { ...x, online: false })) };
      hostState = reduce(s, { type: 'join', name: me.name }, me.pid);
      LS.set(key('session'), { code, host: true });
      commit();
      hostTimer = setInterval(() => { if (hostState) tick?.(hostState, apply); }, 500);
    });
    p.on('connection', c => {
      c.on('data', m => onHostMsg(c, m));
      c.on('close', () => {
        if (peer === p && c.pid && conns.get(c.pid) === c) { conns.delete(c.pid); apply({ type: 'online', id: c.pid, on: false }, me.pid); }
      });
    });
    p.on('disconnected', () => { if (peer === p && !p.destroyed) p.reconnect(); });
    p.on('error', e => {
      if (peer !== p) return;
      if (e.type === 'unavailable-id') {
        if (!restored) return host();
        // старый id ещё держится на сервере после вылета — подождём
        if (tries < 20) { retryT = setTimeout(() => host(code, restored, tries + 1), 3000); return; }
        toast('Не получилось восстановить лобби', 4000); leave(true);
      } else if (['network', 'server-error', 'socket-error'].includes(e.type)) toast('Нет связи с сервером, пробую ещё…', 3000);
    });
  }

  function onHostMsg(c, m) {
    if (!m || typeof m !== 'object' || !hostState) return;
    if (m.t === 'hello' && typeof m.pid === 'string') {
      const pid = m.pid.slice(0, 24);
      if (pid === me.pid || reserved.includes(pid)) return c.close();
      c.pid = pid;
      const old = conns.get(pid);
      if (old && old !== c) old.close();
      conns.set(pid, c);
      const next = reduce(hostState, { type: 'join', name: m.name }, pid);
      if (next === hostState) { c.send({ t: 'full' }); return; }
      hostState = next; commit();
    } else if (m.t === 'act' && c.pid) apply(m.a, c.pid);
  }
  function apply(a, from) {
    if (!hostState) return;
    const next = reduce(hostState, a, from);
    if (next === hostState) return;
    hostState = next; commit();
  }
  function commit() {
    LS.set(key('hostState'), hostState);
    const now = Date.now();
    for (const [pid, c] of conns) if (c.open) c.send({ t: 'state', s: publicView(hostState, pid), now });
    onState(publicView(hostState, me.pid), now);
  }

  function join(code, rejoin = false) {
    if (!peerReady()) return;
    closePeer(); isHost = false;
    if (!rejoin) { everConnected = false; retries = 0; }
    toast('Подключаюсь…');
    const p = peer = new Peer();
    p.on('open', () => connect(code));
    p.on('disconnected', () => { if (peer === p && !p.destroyed) p.reconnect(); });
    p.on('error', e => {
      if (peer !== p) return;
      if (e.type === 'peer-unavailable' && !everConnected) { toast('Лобби с таким кодом не найдено', 3500); leave(true); }
      else retry(code);
    });
  }
  function connect(code) {
    const p = peer, c = p.connect(PREFIX + code, { reliable: true });
    c.on('open', () => {
      conn = c; everConnected = true; retries = 0;
      LS.set(key('session'), { code, host: false });
      c.send({ t: 'hello', pid: me.pid, name: me.name });
      hideToast();
    });
    c.on('data', m => {
      if (m?.t === 'state') onState(m.s, m.now);
      else if (m?.t === 'full') { toast('Лобби заполнено', 3500); leave(true); }
      else if (m?.t === 'bye') { toast('Хост закрыл лобби', 3500); leave(true); }
    });
    c.on('close', () => { if (conn === c && peer === p) { conn = null; retry(code); } });
  }
  function retry(code) {
    if (++retries > 40) { toast('Хост не отвечает. Игра закончилась?', 4000); leave(true); return; }
    toast('Связь с хостом потеряна, переподключаюсь…');
    clearTimeout(retryT);
    retryT = setTimeout(() => (peer && !peer.destroyed && peer.open ? connect(code) : join(code, true)), 2500);
  }

  function send(a) {
    if (isHost) apply(a, me.pid);
    else if (conn?.open) conn.send({ t: 'act', a });
    else toast('Нет связи с хостом…', 2000);
  }
  function leave(keepToast = false) {
    if (isHost) for (const c of conns.values()) if (c.open) c.send({ t: 'bye' });
    LS.del(key('session')); LS.del(key('hostState'));
    // даём «bye» уйти, потом рвём соединения
    const p = peer; peer = null; conn = null; conns.clear(); clearTimeout(retryT); clearInterval(hostTimer);
    setTimeout(() => p && !p.destroyed && p.destroy(), 300);
    hostState = null; isHost = false;
    if (!keepToast) hideToast();
    onLeave();
  }
  // После перезагрузки страницы — вернуться в ту же партию. false, если возвращаться некуда.
  function resume() {
    const sess = LS.get(key('session')), saved = LS.get(key('hostState'));
    if (sess?.code && sess.host && saved?.code === sess.code) { host(sess.code, saved); return true; }
    if (sess?.code && !sess.host && me.name) { join(sess.code); return true; }
    LS.del(key('session'));
    return false;
  }

  return { host, join, send, leave, resume, get isHost() { return isHost; } };
}
