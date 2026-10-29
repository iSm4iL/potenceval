// Лобби по коду: хост держит состояние у себя в браузере, остальные шлют ему действия.
// Сообщения идут через публичный MQTT-сервер по WebSocket — прямое соединение между
// устройствами не нужно, поэтому работает и с телефона на мобильном интернете.
// Свой брокер на российском сервере ставится из server/mqtt; пока OWN пустой — публичные
// зарубежные брокеры без гарантий.
import { t } from './i18n.js?v=ui-20261029';
import { LS, me, toast, hideToast } from './kit.js?v=kick-1';

const OWN = ''; // 'wss://mqtt.<домен>/mqtt' после server/mqtt/setup.sh
const BROKERS = OWN ? [OWN] : ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const BEAT = 4000, LOST = 15000;

// tick(state, apply) — хост вызывает каждые полсекунды (таймеры, ходы бота).
export function createNet({ game, createState, reduce, publicView = s => s, reserved = [], tick, onState, onLeave }) {
  const key = k => game + '.' + k;
  const topic = (code, part) => `potenceval/v1/${game}/${code}/${part}`;
  let links = [], timers = [], isHost = false, hostState = null, code = null, everConnected = false, hostSeen = 0, lostShown = false;
  const seen = new Map(); // pid → когда игрок последний раз выходил на связь (для хоста)
  const newCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

  function ready() {
    if (typeof mqtt !== 'undefined') return true;
    toast(t('Не загрузился модуль связи. Обнови страницу.', 'The connection module failed to load. Refresh the page.'), 4000);
    return false;
  }
  function connect(url) {
    return new Promise(resolve => {
      const client = mqtt.connect(url, { clientId: `pv_${me.pid}_${Math.random().toString(36).slice(2, 7)}`, connectTimeout: 6000, reconnectPeriod: 2000, clean: true });
      const fail = setTimeout(() => { client.end(true); resolve(null); }, 7000);
      client.once('connect', () => { clearTimeout(fail); resolve(client); });
    });
  }
  function close() {
    timers.forEach(clearInterval); timers.forEach(clearTimeout); timers = [];
    const old = links; links = []; seen.clear();
    old.forEach(l => l.end(true));
  }
  const publish = (t, msg, retain = false) => links.forEach(l => l.publish(t, JSON.stringify(msg), { qos: 0, retain }));
  const parse = raw => { try { const m = JSON.parse(String(raw)); return m && typeof m === 'object' ? m : null; } catch { return null; } };

  async function host(c = newCode(), restored = null) {
    if (!ready()) return;
    close(); isHost = true; code = c;
    toast(restored ? t('Восстанавливаю лобби…', 'Restoring the lobby…') : t('Создаю лобби…', 'Creating the lobby…'));
    // хост сидит на всех доступных серверах — друг подключится через тот, что открывается у него.
    // Стартуем с первого ответившего, остальные цепляем по мере подключения; ни одного — пробуем ещё раз.
    const attach = l => { l.subscribe(topic(c, 'up')); l.on('message', (_, raw) => onHostMsg(parse(raw))); links.push(l); };
    let first = null;
    for (let attempt = 0; attempt < 2 && !first; attempt++) {
      const pending = BROKERS.map(connect);
      first = await Promise.any(pending.map(p => p.then(l => l || Promise.reject()))).catch(() => null);
      pending.forEach(p => p.then(l => {
        if (!l || l === first) return;
        if (code === c && isHost && first) { attach(l); if (hostState) commit(); } else l.end(true);
      }));
    }
    if (code !== c || !isHost) { first?.end(true); return; }
    if (!first) { isHost = false; toast(t('Нет связи с сервером. Проверь интернет или выключи/включи VPN.', 'Can’t reach the server. Check your internet or toggle your VPN.'), 5000); return; }
    attach(first); hideToast();
    let s = restored || createState(me.pid, c);
    if (restored) s = { ...s, players: s.players.map(x => (x.genie || x.bot || x.id === me.pid ? x : { ...x, online: false })) };
    hostState = reduce(s, { type: 'join', name: me.name }, me.pid);
    LS.set(key('session'), { code: c, host: true });
    commit();
    publish(topic(c, 'host'), { ts: Date.now() }, true);
    timers.push(setInterval(() => { if (hostState) tick?.(hostState, apply); }, 500));
    timers.push(setInterval(() => {
      if (!hostState) return;
      publish(topic(c, 'host'), { ts: Date.now() }, true);
      for (const [pid, at] of seen) if (Date.now() - at > LOST) { seen.delete(pid); apply({ type: 'online', id: pid, on: false }, me.pid); }
    }, BEAT));
  }

  function onHostMsg(m) {
    if (!m || !hostState || typeof m.pid !== 'string') return;
    const pid = m.pid.slice(0, 24);
    if (pid === me.pid || reserved.includes(pid)) return;
    const known = hostState.players.find(p => p.id === pid);
    seen.set(pid, Date.now());
    if (m.t === 'hello' || (m.t === 'ping' && (!known || !known.online))) {
      const next = reduce(hostState, { type: 'join', name: m.name }, pid);
      if (next === hostState) { publish(topic(code, 'down/' + pid), { t: 'full' }); return; }
      hostState = next; commit();
    } else if (m.t === 'act' && known) apply(m.a, pid);
  }
  function apply(a, from) {
    if (!hostState) return;
    const next = reduce(hostState, a, from);
    if (next === hostState) return;
    hostState = next; commit();
  }
  let present = new Set();
  function commit() {
    LS.set(key('hostState'), hostState);
    const now = Date.now(), ids = new Set(hostState.players.map(p => p.id));
    for (const id of present) if (!ids.has(id)) publish(topic(code, 'down/' + id), { t: 'kicked' }); // выгнанным — уведомление
    present = ids;
    for (const p of hostState.players) if (p.id !== me.pid && !p.bot && !p.genie) publish(topic(code, 'down/' + p.id), { t: 'state', s: publicView(hostState, p.id), now });
    onState(publicView(hostState, me.pid), now);
  }

  async function join(c, rejoin = false) {
    if (!ready()) return;
    close(); isHost = false; code = c;
    if (!rejoin) everConnected = false;
    toast(t('Подключаюсь…', 'Connecting…'));
    let link = null;
    for (const url of [...BROKERS, ...BROKERS]) { link = await connect(url); if (link || code !== c) break; } // по кругу два раза
    if (code !== c || isHost) { link?.end(true); return; }
    if (!link) { toast(t('Нет связи с сервером. Проверь интернет или выключи/включи VPN.', 'Can’t reach the server. Check your internet or toggle your VPN.'), 5000); return; }
    links = [link];
    link.subscribe([topic(c, 'host'), topic(c, 'down/' + me.pid)]);
    link.on('message', (tp, raw) => {
      const m = parse(raw);
      if (!m || code !== c) return;
      if (tp.endsWith('/host')) {
        if (m.closed && everConnected) { toast(t('Хост закрыл лобби', 'The host closed the lobby'), 3500); leave(true); }
        else if (m.ts) hostSeen = Date.now();
        return;
      }
      if (m.t === 'state') {
        hostSeen = Date.now();
        if (!everConnected || lostShown) hideToast();
        everConnected = true; lostShown = false;
        LS.set(key('session'), { code: c, host: false });
        onState(m.s, m.now);
      } else if (m.t === 'full') { toast(t('Лобби заполнено', 'The lobby is full'), 3500); leave(true); }
      else if (m.t === 'bye') { toast(t('Хост закрыл лобби', 'The host closed the lobby'), 3500); leave(true); }
      else if (m.t === 'kicked') { toast(t('Хост выгнал тебя из лобби', 'The host kicked you from the lobby'), 4000); leave(true); }
    });
    const say = t => publish(topic(c, 'up'), { t, pid: me.pid, name: me.name });
    say('hello');
    timers.push(setInterval(() => {
      say(everConnected ? 'ping' : 'hello');
      if (everConnected && Date.now() - hostSeen > LOST && !lostShown) { lostShown = true; toast(t('Связь с хостом пропала, ждём его…', 'Lost the host, waiting for them…')); }
    }, BEAT));
    timers.push(setTimeout(() => { if (!everConnected && code === c) { toast(t('Лобби с таким кодом не найдено', 'No lobby with that code'), 3500); leave(true); } }, 12000));
  }

  function send(a) {
    if (isHost) apply(a, me.pid);
    else if (links.length) publish(topic(code, 'up'), { t: 'act', pid: me.pid, a });
    else toast(t('Нет связи с хостом…', 'No connection to the host…'), 2000);
  }
  function leave(keepToast = false) {
    if (isHost && code) {
      publish(topic(code, 'host'), { closed: true, ts: Date.now() }, true);
      for (const p of hostState?.players || []) if (p.id !== me.pid) publish(topic(code, 'down/' + p.id), { t: 'bye' });
    }
    LS.del(key('session')); LS.del(key('hostState'));
    const old = links; links = [];
    setTimeout(() => old.forEach(l => l.end(true)), 300); // даём «bye» уйти
    close(); hostState = null; isHost = false; code = null;
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
