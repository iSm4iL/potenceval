import { createState, reduce, publicView, ROUNDS, TIMES } from './game.js';
import { NAMES } from './spots.js';
import { A, $, h, esc, first, nameOf, me, LS, isHostOf, still, SPRING, confetti, enter,
  setControls, initPage, buildHome, buildLobby, renderPlist, seg, placeSegPills } from '../shared/kit.js?v=kick-1';
import { createNet } from '../shared/net.js?v=own-1';

const stage = $('#stage'), arena = $('#arena'), frame = $('#panoFrame');
// хост закрывает раунд чуть позже таймера: у друзей точка ставится сама в последнюю секунду, ей нужно долететь
const tick = (s, apply) => { if (s.phase === 'guess' && s.endsAt && Date.now() > s.endsAt + 1500) apply({ type: 'timeout' }, s.hostId); };
const net = createNet({ game: 'where', createState, reduce, publicView, tick, onState, onLeave: showHome });

// Игра в одиночку — то же самое, только состояние живёт здесь, без лобби и связи.
let solo = null;
const soloApply = (a, from) => { const next = reduce(solo, a, from); if (next !== solo) { solo = next; onState(solo, Date.now()); } };
setInterval(() => { if (solo) tick(solo, soloApply); }, 500);
const send = a => (solo ? soloApply(a, me.pid) : net.send(a));
function startSolo() {
  solo = reduce(createState(me.pid, ''), { type: 'join', name: me.name || 'Ты' }, me.pid);
  const saved = LS.get('where.solo');
  if (ROUNDS.includes(saved?.rounds)) solo.rounds = saved.rounds;
  if (TIMES.includes(saved?.time)) solo.time = saved.time;
  onState(solo, Date.now());
}

const fmt = n => Math.round(n).toLocaleString('ru');
const dist = km => (km < 1 ? `${Math.round(km * 1000)} м` : `${km < 100 ? km.toFixed(1).replace('.', ',') : fmt(km)} км`);
const clock = ms => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const mine = s => s.players.find(p => p.id === me.pid) || { score: 0 };
const panoUrl = s => { const [, lat, lng, id] = s.spot; return `https://www.google.com/maps/embed?pb=!4v0!6m8!1m7!1s${id}!2m2!1d${lat}!2d${lng}!3f${s.heading}!4f0!5f0.78`; };

/* ---------- render loop ---------- */
let view = null, rendered = null, shownKey = null, chain = Promise.resolve(), skew = 0;
function onState(s, now) {
  if (now) skew = now - Date.now();
  view = s;
  chain = chain.then(() => renderState(s)).catch(e => console.error(e));
}
function showHome() {
  solo = null; view = null;
  chain = chain.then(() => renderState(null)).catch(e => console.error(e));
}
async function renderState(s) {
  const p = rendered; rendered = s;
  const key = !s ? 'home' : s.phase === 'lobby' || s.phase === 'over' ? s.phase : s.phase + ':' + s.round;
  $('#room').hidden = !s?.code; $('#exitBtn').hidden = !s;
  if (s?.code) $('#roomCode').textContent = s.code;
  if (key !== shownKey) {
    shownKey = key;
    const old = [...stage.children];
    await Promise.all(old.map((el, k) => A(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-14px) scale(.98)' }], { duration: 220, delay: k * 25, easing: 'ease-in', fill: 'forwards' })));
    stage.replaceChildren();
    if (s?.phase === 'guess') buildGuess(s);
    else if (s?.phase === 'reveal') buildReveal(s);
    else {
      closeArena();
      (!s ? buildHomeScreen : s.phase === 'lobby' ? buildLobbyScreen : buildOver)(s);
      enter(stage);
      window.scrollTo({ top: 0, behavior: still() ? 'auto' : 'smooth' });
    }
  } else if (s.phase === 'lobby') patchLobby(s);
  else if (s.phase === 'guess') patchGuess(s, p);
  else if (s.phase === 'reveal') patchReveal(s);
  controls(s);
}

function controls(s) {
  const b = [];
  if (s?.phase === 'lobby' && (solo || isHostOf(s))) {
    b.push(['start', solo ? 'Поехали' : 'Начать', 'primary ready', () => send({ type: 'start' })]);
    if (solo) b.push(['home', 'Назад', 'ghost', showHome]);
  } else if (s?.phase === 'over' && (solo || isHostOf(s))) {
    b.push(['again', 'Ещё партия', 'primary ready', () => send({ type: 'start' })]);
    b.push(solo ? ['home', 'На главную', 'ghost', showHome] : ['lobby', 'В лобби', 'ghost', () => send({ type: 'lobby' })]);
  }
  setControls(b);
}

/* ---------- home & lobby ---------- */
const GLOBE = `<svg class="globe" viewBox="0 0 240 240" aria-hidden="true">
  <defs><radialGradient id="sea" cx="38%" cy="32%"><stop offset="0" stop-color="#5f8f95"/><stop offset=".7" stop-color="#25525a"/><stop offset="1" stop-color="#173339"/></radialGradient></defs>
  <circle cx="120" cy="128" r="92" fill="url(#sea)" stroke="#d7b174" stroke-width="3"/>
  <g class="mer" fill="none" stroke="#e8d3a8" stroke-opacity=".45" stroke-width="1.6">
    ${[0, 1, 2, 3, 4, 5].map(k => `<ellipse cx="120" cy="128" rx="92" ry="92" style="animation-delay:${-k}s"/>`).join('')}
  </g>
  <g fill="none" stroke="#e8d3a8" stroke-opacity=".35" stroke-width="1.4"><path d="M32 100h176M28 128h184M32 156h176M52 76h136M52 180h136"/></g>
  <path d="M206 70 A110 110 0 0 1 206 186" fill="none" stroke="#b88742" stroke-width="7" stroke-linecap="round"/>
  <g class="drop"><path d="M150 52c-15 0-26 11-26 26 0 19 26 44 26 44s26-25 26-44c0-15-11-26-26-26z" fill="#e2574c" stroke="#7a2b22" stroke-width="3"/><circle cx="150" cy="78" r="9" fill="#f6e7c8"/></g>
</svg>`;
function buildHomeScreen() {
  buildHome(stage, net, `<div class="hero" data-in><span class="kicker">Как GeoGuessr · один или до 8 друзей</span>
    <h1>Где я?</h1>
    <p class="sub">Тебя высаживают на случайной улице где-то в мире. Осмотрись, найди подсказки — вывески, номера машин, разметку, горы на горизонте — и поставь точку на карте. Чем ближе, тем больше очков.</p>
    ${GLOBE}</div>`);
  $('#createBtn').after(h(`<button class="btn ghost" id="soloBtn">Играть одному</button>`));
  $('#soloBtn').onclick = startSolo;
}
const lobbyTag = (p, s) => (p.id === s.hostId ? 'хост' : p.online ? 'в игре' : 'нет связи');
function settingsHTML(s, on) {
  return `<div class="settings" id="settings" data-in>
    ${seg('rounds', 'Раундов', ROUNDS, s.rounds, '', on)}
    ${seg('time', 'Время на раунд', TIMES.map(t => (t ? t / 60 + ' мин' : 'без')), s.time ? s.time / 60 + ' мин' : 'без', '', on)}</div>`;
}
function buildLobbyScreen(s) {
  if (solo) stage.append(h(`<div class="phase-title" data-in><span class="kicker">Один в дороге</span><h1>Собираем чемодан</h1><p class="sub">Сколько мест посетить и сколько времени дать себе на каждое.</p></div>`));
  else buildLobby(stage, s, 'Зови друзей по коду или ссылке. Все увидят одно и то же место и поставят свои точки.', lobbyTag, id => send({ type: 'kick', id }));
  stage.append(h(settingsHTML(s, solo || isHostOf(s))));
  if (!solo && !isHostOf(s)) stage.append(h(`<p class="wait" data-in>Ждём, пока <b>${esc(nameOf(s, s.hostId))}</b> начнёт <span class="dots"><i></i><i></i><i></i></span></p>`));
  $('#settings').onclick = onSetting;
  requestAnimationFrame(placeSegPills);
}
function onSetting(e) {
  const b = e.target.closest('button[data-k]');
  if (!b || b.disabled) return;
  send({ type: 'set', k: b.dataset.k, v: b.dataset.k === 'rounds' ? +b.dataset.v : b.dataset.v === 'без' ? 0 : parseInt(b.dataset.v) * 60 });
}
function patchLobby(s) {
  renderPlist(s, lobbyTag);
  for (const [k, v] of [['rounds', String(s.rounds)], ['time', s.time ? s.time / 60 + ' мин' : 'без']]) stage.querySelectorAll(`[data-k="${k}"]`).forEach(b => b.classList.toggle('on', b.dataset.v === v));
  placeSegPills();
  if (solo) LS.set('where.solo', { rounds: s.rounds, time: s.time });
}

/* ---------- arena: panorama + map ---------- */
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
let map = null, marks = null, pin = null, pinAt = null, sentRound = 0;
const pinIcon = (color, label) => L.divIcon({ className: 'pv-pin', html: `<span style="--c:${esc(color)}"><b>${esc(label)}</b></span>`, iconSize: [34, 42], iconAnchor: [17, 41] });
const goalIcon = () => L.divIcon({ className: 'pv-goal', html: '<span>★</span>', iconSize: [40, 40], iconAnchor: [20, 20] });

function ensureMap() {
  if (map) return;
  map = L.map('map', { worldCopyJump: true, minZoom: 1, zoomSnap: 0.5 }).setView([25, 10], 1);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  L.tileLayer(TILES, { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  marks = L.layerGroup().addTo(map);
  map.on('click', e => {
    if (view?.phase !== 'guess' || view.guesses[me.pid]) return;
    pinAt = e.latlng.wrap();
    if (pin) pin.setLatLng(e.latlng); else pin = L.marker(e.latlng, { icon: pinIcon(mine(view).color || '#e2574c', first(me.name || 'Ты')) }).addTo(marks);
    $('#guessBtn').disabled = false;
  });
  // мини-карта растёт при наведении — Leaflet должен узнать новый размер
  $('#mapbox').addEventListener('transitionend', e => { if (e.target.id === 'mapbox') map.invalidateSize(); });
}
const placeArena = () => { arena.style.top = Math.max(0, $('.top').getBoundingClientRect().bottom) + 'px'; };
addEventListener('resize', () => { if (!arena.hidden) { placeArena(); map?.invalidateSize(); } });
function openArena(mode) {
  window.scrollTo(0, 0);
  arena.hidden = false; arena.className = 'arena ' + mode;
  document.body.classList.add('in-arena');
  placeArena(); ensureMap(); map.invalidateSize();
  $('#result')?.remove();
}
function closeArena() {
  if (arena.hidden) return;
  arena.hidden = true; frame.src = 'about:blank';
  document.body.classList.remove('in-arena');
}

function buildGuess(s) {
  openArena('guess');
  frame.src = panoUrl(s);
  marks.clearLayers(); pin = null; pinAt = null;
  map.setView([25, 10], 1, { animate: false });
  $('#mapbox').classList.remove('open');
  patchGuess(s);
  A($('.hud'), [{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: SPRING });
  A($('#mapbox'), [{ opacity: 0, transform: 'translateY(30px) scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 150, easing: SPRING });
}
function patchGuess(s, p) {
  $('#round').textContent = `${s.round} / ${s.deck.length}`;
  $('#score').textContent = fmt(mine(s).score);
  $('#who').innerHTML = s.players.length > 1 ? s.players.map(pl => `<span class="dot ${s.guesses[pl.id] ? 'done' : ''} ${pl.online ? '' : 'off'}" style="--c:${esc(pl.color)}" title="${esc(pl.name)}${s.guesses[pl.id] ? ' — ответил' : ''}">${esc(first(pl.name))}</span>`).join('') : '';
  const done = !!s.guesses[me.pid];
  arena.classList.toggle('done', done);
  $('#guessBtn').disabled = done || !pinAt;
  $('#guessBtn').textContent = done ? 'Ждём остальных…' : 'Угадать';
  if (p && s.endsAt && s.endsAt !== p.endsAt && p.phase === 'guess' && !done) A($('#timer'), [{ transform: 'scale(1.35)' }, { transform: 'none' }], { duration: 600, easing: SPRING });
}
function submit() {
  const s = view;
  if (!pinAt || s?.phase !== 'guess' || s.guesses[me.pid] || sentRound === s.round) return;
  sentRound = s.round;
  send({ type: 'guess', lat: pinAt.lat, lng: pinAt.lng });
}
$('#guessBtn').onclick = submit;
$('#restart').onclick = () => { if (view?.spot) frame.src = panoUrl(view); };
$('#mapToggle').onclick = () => { $('#mapbox').classList.add('open'); setTimeout(() => map.invalidateSize(), 50); };
$('#mapClose').onclick = () => $('#mapbox').classList.remove('open');

// Таймер тикает сам; в последнюю секунду поставленная точка отправляется без кнопки.
setInterval(() => {
  const s = view, el = $('#timer');
  if (s?.phase !== 'guess' || !s.endsAt) { el.hidden = true; return; }
  const left = Math.max(0, s.endsAt - (Date.now() + skew));
  el.hidden = false; el.textContent = '⏱ ' + clock(left);
  el.classList.toggle('hot', left < 10000);
  if (left < 400) submit();
}, 250);

function buildReveal(s) {
  openArena('reveal');
  frame.src = 'about:blank';
  marks.clearLayers(); pin = null;
  const [cc, lat, lng, id, year] = s.spot, goal = [lat, lng], all = [goal];
  const rows = s.players.map(p => ({ p, g: s.guesses[p.id] })).sort((a, b) => (b.g?.pts ?? -1) - (a.g?.pts ?? -1));
  for (const { p, g } of rows) {
    if (!g || !Number.isFinite(g.lat)) continue;
    const gl = g.lng + (g.lng - lng > 180 ? -360 : lng - g.lng > 180 ? 360 : 0); // линия — коротким путём через линию перемены дат
    L.polyline([[g.lat, gl], goal], { color: p.color, weight: 3, dashArray: '6 8', opacity: 0.9 }).addTo(marks);
    L.marker([g.lat, gl], { icon: pinIcon(p.color, first(p.name)) }).addTo(marks);
    all.push([g.lat, gl]);
  }
  L.marker(goal, { icon: goalIcon(), zIndexOffset: 1000 }).addTo(marks);
  const card = h(`<div class="result-card" id="result">
    <span class="kicker">Раунд ${s.round} из ${s.deck.length}</span>
    <h2>${esc(NAMES[cc] || 'Где-то на Земле')}</h2>
    <p class="meta">${year ? `Снято в ${year} · ` : ''}<a href="https://www.google.com/maps/@?api=1&map_action=pano&pano=${esc(id)}" target="_blank" rel="noopener">открыть в Google Картах ↗</a></p>
    <ol class="rows">${rows.map(({ p, g }) => `<li style="--c:${esc(p.color)}" class="${p.id === me.pid ? 'me' : ''}">
      <span class="av">${esc(first(p.name))}</span><b>${esc(p.name)}${p.id === me.pid && s.players.length > 1 ? ' (ты)' : ''}</b>
      <span class="km">${g ? dist(g.km) : 'не успел'}</span><span class="pts" data-pts="${g?.pts || 0}">+0</span>
      <i class="bar"><b style="width:${(g?.pts || 0) / 50}%"></b></i>${s.players.length > 1 ? `<small>всего ${fmt(p.score)}</small>` : ''}</li>`).join('')}</ol>
    <div class="actions" id="revealActions"></div></div>`);
  arena.append(card);
  patchReveal(s);
  const pad = Math.min(card.offsetHeight + 30, innerHeight * 0.6);
  map.fitBounds(all, { paddingTopLeft: [50, 50], paddingBottomRight: [50, pad], maxZoom: 8, animate: false });
  A(card, [{ opacity: 0, transform: 'translate(-50%,40px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 650, easing: SPRING });
  card.querySelectorAll('.pts').forEach((el, k) => countUp(el, +el.dataset.pts, 900, 300 + k * 120));
  const myPts = s.guesses[me.pid]?.pts || 0;
  if (myPts >= 4500) setTimeout(() => confetti(card.querySelector('li.me') || card, 80), 700);
}
function patchReveal(s) {
  const box = $('#revealActions');
  if (!box) return;
  const last = s.round >= s.deck.length;
  box.innerHTML = solo || isHostOf(s)
    ? `<button class="btn primary ready" id="nextBtn">${last ? 'Итоги партии' : 'Следующее место →'}</button>`
    : `<p class="wait">Ждём, пока <b>${esc(nameOf(s, s.hostId))}</b> поедет дальше <span class="dots"><i></i><i></i><i></i></span></p>`;
  const b = $('#nextBtn');
  if (b) b.onclick = () => { b.disabled = true; send({ type: 'next' }); };
}
function countUp(el, to, ms, delay, pre = '+') {
  if (still() || !to) { el.textContent = pre + fmt(to); return; }
  const t0 = performance.now() + delay;
  const step = t => {
    const k = Math.min(1, Math.max(0, (t - t0) / ms));
    el.textContent = pre + fmt(to * (1 - (1 - k) ** 3));
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- итоги ---------- */
function buildOver(s) {
  const ranked = [...s.players].sort((a, b) => b.score - a.score), max = 5000 * s.deck.length;
  const share = mine(s).score / max;
  const title = ranked.length === 1
    ? (share >= 0.8 ? 'Бывалый путешественник' : share >= 0.5 ? 'Неплохо ориентируешься' : share >= 0.25 ? 'Турист со стажем' : 'Где я вообще был?')
    : ranked[0].score === ranked[1].score ? 'Ничья!' : `${esc(ranked[0].name)} знает мир лучше всех`;
  stage.append(h(`<div class="phase-title" data-in><span class="kicker">Партия окончена · ${s.deck.length} ${s.deck.length === 3 ? 'места' : 'мест'}</span><h1>${title}</h1></div>`));
  if (ranked.length === 1) stage.append(h(`<div class="solo-total" data-in><b data-to="${mine(s).score}">0</b><small>из ${fmt(max)}</small></div>`));
  else {
    const order = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
    stage.append(h(`<div class="podium" data-in>${order.map(p => { const k = ranked.indexOf(p) + 1; return `<div class="pod p${k}">
      <div class="crown">${k === 1 ? '👑' : ''}</div><span class="av" style="background:${esc(p.color)}">${esc(first(p.name))}</span>
      <div class="nm">${esc(p.name)}${p.id === me.pid ? ' (ты)' : ''}</div><div class="bar" style="height:${[0, 170, 120, 90][k]}px">${fmt(p.score)}</div></div>`; }).join('')}</div>`));
    if (ranked.length > 3) stage.append(h(`<div class="rest" data-in>${ranked.slice(3).map((p, i) => `<div><span>${i + 4}. ${esc(p.name)}</span><b>${fmt(p.score)}</b></div>`).join('')}</div>`));
  }
  stage.append(h(`<ol class="trip" data-in>${s.log.map(({ spot, guesses }, i) => {
    const best = s.players.filter(p => guesses[p.id]).sort((a, b) => guesses[a.id].km - guesses[b.id].km)[0];
    const g = ranked.length === 1 ? guesses[me.pid] : best && guesses[best.id];
    return `<li><span class="n">${i + 1}</span><b>${esc(NAMES[spot[0]] || '?')}</b><span>${g ? `${ranked.length > 1 ? esc(best.name) + ' · ' : ''}${dist(g.km)} · +${fmt(g.pts)}` : 'никто не ответил'}</span></li>`;
  }).join('')}</ol>`));
  const big = stage.querySelector('.solo-total b');
  if (big) countUp(big, +big.dataset.to, 1400, 500, '');
  if (ranked[0].id === me.pid && (ranked.length > 1 || share >= 0.5)) setTimeout(() => confetti(stage.querySelector('.p1 .av') || big, 90), 700);
}

/* ---------- boot ---------- */
initPage('where', { leave: () => (solo ? showHome() : net.leave()), get isHost() { return !solo && net.isHost; } });
if (!net.resume()) showHome();
