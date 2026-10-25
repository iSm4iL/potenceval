import { $, esc, LS, A, SPRING, toast, confetti, flip, nudge, shake, wait } from '../shared/kit.js';
import { PACKS, COUNTRIES } from './countries.js?v=clues-20261025';
import { WORLD, SHAPES, PHOTOS } from './atlas.js?v=clues-20261025';
import { WALKS } from './walks.js';
import { CLUES, START, WRONG, norm, nameIndex, matchCountry, canOpen, openClue, guess, surrender, createGame, award, nextRound } from './game.js';

const stage = $('#stage'), exitBtn = $('#exitBtn');
const byId = new Map(COUNTRIES.map(c => [c.id, c]));
const world = new Map(WORLD.map(w => [w[0], w]));
const at = id => world.get(id).slice(2);
const names = nameIndex(WORLD, COUNTRIES);
const nameOf = id => byId.get(id)?.name || world.get(id)?.[1] || id;
const spotsOf = id => WALKS[id] || null; // координаты прогулки: tools/snap.mjs
const allNames = [...new Set([...COUNTRIES.flatMap(c => [c.name, ...c.aliases]), ...WORLD.map(w => w[1])])];
const AVATARS = ['🕵️', '🦊', '🐱', '🦉'];
const ICONS = { fact1: '🗂', fact2: '🗂', phrase: '💬', food: '🍲', walk: '👣', money: '💵', person: '📰', shape: '✉' };
const TILT = { fact1: -3, walk: 2, person: 3, phrase: -4, fact2: 2.5, food: -2, shape: 1, money: -3 };
const num = n => n.toLocaleString('ru-RU');
const directionNames = { '↑': 'На север', '↗': 'На северо-восток', '→': 'На восток', '↘': 'На юго-восток', '↓': 'На юг', '↙': 'На юго-запад', '←': 'На запад', '↖': 'На северо-запад' };
const cases = n => `${n} ${{ one: 'дело', few: 'дела', many: 'дел', other: 'дела' }[new Intl.PluralRules('ru').select(n)]}`;
const shapeSvg = (id, cls = '') => `<svg class="${cls}" viewBox="-20 -20 1040 1040" aria-hidden="true"><path d="${SHAPES[id]}" pathLength="1"/></svg>`;

const saved = LS.get('geo.setup') || {};
const settings = {
  pack: PACKS.some(p => p.id === saved.pack) ? saved.pack : 'europe',
  rounds: [5, 10, 15].includes(saved.rounds) ? saved.rounds : 5,
  mode: saved.mode === 'team' ? 'team' : 'solo',
  players: Array.isArray(saved.players) ? saved.players.filter(p => typeof p === 'string').slice(0, 4) : [],
};
const persist = () => LS.set('geo.setup', settings);
const poolOf = pack => COUNTRIES.filter(c => pack === 'all' || c.area === pack).map(c => c.id);
const roundChoices = pack => { const max = poolOf(pack).length; const list = [5, 10, 15].filter(n => n <= max); return list.length ? list : [max]; };
let game = null;

/* ---------- папка с настройками ---------- */
function home() {
  game = null; resetWalk();
  exitBtn.hidden = true; $('#progress').hidden = true;
  const teaser = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
  stage.innerHTML = `<section class="desk">
    <div class="folder">
      <div class="folder-tab">Дело № ${String(Math.floor(Math.random() * 900) + 100)}</div>
      <span class="coffee-ring" aria-hidden="true"></span>
      <div class="folder-page folder-left">
        <span class="stamp-secret">Совершенно секретно</span>
        <h1>Угадай страну</h1>
        <p class="lead">На доске следователя — загаданная страна. Открывай улики: факты из истории, язык, кухню, прогулку по настоящим улицам. Чем меньше улик понадобилось, тем больше очков.</p>
        <figure class="detective-scene"><img src="../shared/assets/club/geo.webp" alt="" width="768" height="512"><figcaption>Каждая страна оставляет следы</figcaption></figure>
        <figure class="teaser" hidden><span class="clip" aria-hidden="true"></span>${shapeSvg(teaser.id)}<b aria-hidden="true">?</b><figcaption>Улика № 1</figcaption></figure>
      </div>
      <div class="folder-page folder-right">
        <h2>Картотека</h2>
        <div class="packs" role="radiogroup" aria-label="Картотека">${PACKS.map(p => `<button class="pack${p.id === settings.pack ? ' on' : ''}" role="radio" aria-checked="${p.id === settings.pack}" data-pack="${p.id}"><span class="pack-ic">${p.icon}</span><b>${p.name}</b><small>${poolOf(p.id).length} стран</small></button>`).join('')}</div>
        <h2>Сколько дел</h2>
        <div class="rounds" id="rounds"></div>
        <h2>Кто расследует</h2>
        <div class="modes" role="radiogroup" aria-label="Режим">
          <button data-mode="solo" role="radio">🕵️ Я один</button>
          <button data-mode="team" role="radio">👥 С друзьями</button>
        </div>
        <div class="team" id="team"></div>
        <button class="btn primary big" id="startBtn">Открыть дело</button>
      </div>
    </div>
  </section>`;
  const drawRounds = () => {
    const list = roundChoices(settings.pack);
    if (!list.includes(settings.rounds)) settings.rounds = list[0];
    $('#rounds').innerHTML = list.map(n => `<button class="${n === settings.rounds ? 'on' : ''}" data-rounds="${n}">${n}</button>`).join('');
  };
  const drawTeam = () => {
    stage.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === settings.mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    const team = $('#team');
    team.hidden = settings.mode !== 'team';
    team.innerHTML = settings.players.map((p, i) => `<span class="agent">${AVATARS[i]} ${esc(p)}<button data-drop="${i}" aria-label="Убрать ${esc(p)}">×</button></span>`).join('')
      + (settings.players.length < 4 ? `<form class="agent-add" id="addForm"><input class="field" id="agentName" maxlength="16" placeholder="${settings.players.length < 2 ? `Имя ${settings.players.length + 1}-го следователя` : 'Ещё имя'}" autocomplete="off"><button class="btn ghost" aria-label="Добавить">+</button></form>` : '');
    $('#addForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#agentName').value.replace(/\s+/g, ' ').trim();
      if (!v) return nudge($('#agentName'));
      settings.players.push(v); persist(); drawTeam(); $('#agentName')?.focus();
    });
  };
  drawRounds(); drawTeam();
  stage.onclick = e => {
    const pack = e.target.closest('[data-pack]'), rounds = e.target.closest('[data-rounds]'), drop = e.target.closest('[data-drop]'), mode = e.target.closest('[data-mode]');
    if (pack) {
      settings.pack = pack.dataset.pack; persist();
      stage.querySelectorAll('[data-pack]').forEach(b => { b.classList.toggle('on', b === pack); b.setAttribute('aria-checked', b === pack); });
      drawRounds();
    }
    if (rounds) { settings.rounds = +rounds.dataset.rounds; persist(); drawRounds(); }
    if (drop) { settings.players.splice(+drop.dataset.drop, 1); persist(); drawTeam(); }
    if (mode) { settings.mode = mode.dataset.mode; persist(); drawTeam(); if (settings.mode === 'team') $('#agentName')?.focus(); }
  };
  $('#startBtn').onclick = start;
  A($('.teaser path'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 2600, delay: 400, easing: 'ease-in-out' });
  A($('.folder'), [{ opacity: 0, transform: 'translateY(40px) rotate(-1.5deg)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: SPRING });
}

function start() {
  if (settings.mode === 'team') {
    const typed = $('#agentName')?.value.replace(/\s+/g, ' ').trim();
    if (typed && settings.players.length < 4) { settings.players.push(typed); persist(); }
    if (settings.players.length < 2) { toast('Впиши хотя бы двух следователей — или выбери «Я один»', 2600); return $('#agentName') ? nudge($('#agentName')) : null; }
  }
  stage.onclick = null;
  game = createGame(poolOf(settings.pack), settings.rounds, settings.mode === 'team' ? settings.players : ['Ты'], { freeOf: id => (spotsOf(id) ? [] : ['walk']) });
  shown = START;
  renderRound();
}

/* ---------- доска ---------- */
function front(c, key) {
  const img = t => (PHOTOS[t] ? `<img src="${esc(PHOTOS[t])}" alt="" referrerpolicy="no-referrer" data-zoom>` : '');
  switch (key) {
    case 'fact1': case 'fact2': return `<div class="archive"><span class="archive-head">Архив · лист ${key === 'fact1' ? 1 : 2}</span><p>${esc(c.facts[key === 'fact1' ? 0 : 1])}</p></div>`;
    case 'phrase': return `<div class="sticky"><b dir="auto">${esc(c.phrase[0])}</b><small>${esc(c.phrase[1])}</small></div>`;
    case 'food': return `<figure class="polaroid${PHOTOS[c.food[1]] ? '' : ' bare'}"><span class="tape" aria-hidden="true"></span>${img(c.food[1])}<figcaption>${esc(c.food[0])}</figcaption></figure>`;
    case 'walk': return spotsOf(c.id)
      ? `<div class="streetcard"><span class="street-pin" aria-hidden="true">📍</span><b>Прогулка</b><button class="walk-go" data-walk>👣 Гулять по улицам</button></div>`
      : `<div class="streetcard none"><b>Прогулки пока нет</b><small>Для этой страны ещё не подготовлены точки прогулки. Очки не списаны.</small></div>`;
    case 'money': return `<div class="banknote${PHOTOS[c.money[1]] ? '' : ' bare'}">${img(c.money[1])}<b>${esc(c.money[0])}</b></div>`;
    case 'person': {
      const credit = c.personCredit;
      return `<div class="clipping"><span class="clip-head">Знаменитость</span><div class="clip-body">${img(c.person[2])}<p><b class="${c.person[0].length > 16 ? 'long' : ''}">${esc(c.person[0])}</b><small>${esc(c.person[1])}</small></p></div>${credit ? `<small class="photo-credit"><a href="${esc(credit.source)}" target="_blank" rel="noopener noreferrer">${esc(credit.author)}</a> · <a href="${esc(credit.url)}" target="_blank" rel="noopener noreferrer">${esc(credit.license)}</a></small>` : ''}</div>`;
    }
    case 'shape': return `<div class="outline">${shapeSvg(c.id)}</div>`;
  }
}
const card = (c, { key, cost, label }) => `<div class="clue clue-${key}${game.round.open.includes(key) ? ' open' : ''}" data-key="${key}" style="--tilt:${TILT[key]}deg">
  <span class="pin" aria-hidden="true"></span>
  <div class="clue-inner">
    <button class="side back" data-open="${key}" aria-label="Открыть улику: ${label}, −${cost} очков"><span class="back-ic">${ICONS[key]}</span><b>${label}</b><span class="price">${key === 'shape' ? 'вскрыть последней' : '−' + cost}</span></button>
    <div class="side front">${front(c, key)}</div>
  </div>
</div>`;

const LAMP = `<svg class="lamp" viewBox="0 0 220 260" aria-hidden="true"><defs><linearGradient id="lm" x1="0" x2="1"><stop offset="0" stop-color="#2a1c2e"/><stop offset=".5" stop-color="#5a4152"/><stop offset="1" stop-color="#1c1220"/></linearGradient></defs>
  <path d="M18 0v70l70 60" fill="none" stroke="#3b2a35" stroke-width="10" stroke-linecap="round"/><circle cx="88" cy="130" r="9" fill="#5a4152"/>
  <path d="M60 120l95 -10 50 90-150 30z" fill="url(#lm)"/><ellipse cx="130" cy="216" rx="78" ry="16" transform="rotate(-12 130 216)" fill="#ffd98a"/><ellipse cx="130" cy="216" rx="60" ry="10" transform="rotate(-12 130 216)" fill="#fff4d6"/></svg>`;
const PROPS = `<div class="props" aria-hidden="true">
  <svg class="glass" viewBox="0 0 200 90"><rect x="96" y="40" width="100" height="16" rx="8" transform="rotate(14 96 48)" fill="#4a2c1d"/><circle cx="62" cy="40" r="34" fill="rgba(200,230,255,.18)" stroke="#c9a15a" stroke-width="7"/><path d="M42 24a26 26 0 0 1 22-10" stroke="rgba(255,255,255,.6)" stroke-width="4" fill="none" stroke-linecap="round"/></svg>
  <svg class="mug" viewBox="0 0 120 120"><ellipse cx="54" cy="104" rx="46" ry="10" fill="rgba(0,0,0,.35)"/><path d="M14 30h80v58a18 18 0 0 1-18 18H32a18 18 0 0 1-18-18z" fill="#8f2d3a"/><path d="M94 44h8a14 14 0 0 1 0 28h-8" fill="none" stroke="#8f2d3a" stroke-width="9"/><ellipse cx="54" cy="30" rx="40" ry="9" fill="#3a1d12"/><ellipse cx="54" cy="30" rx="40" ry="9" fill="none" stroke="#b5485a" stroke-width="3"/><path class="steam" d="M40 18c-8-10 8-14 0-24M62 16c-8-10 8-14 0-24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="4" stroke-linecap="round"/></svg>
</div>`;

function renderRound() {
  const r = game.round, c = byId.get(r.id), n = game.index + 1;
  resetWalk();
  exitBtn.hidden = false; exitBtn.textContent = 'Закрыть дело';
  $('#progress').hidden = false;
  $('#progressText').textContent = `Дело ${n} из ${game.order.length}`;
  $('#progressBar').style.width = `${n / game.order.length * 100}%`;
  stage.innerHTML = `<section class="case">
    <div class="scene">
      ${LAMP}
      <div class="frame">
        <div class="plaque">Дело № ${String(n).padStart(3, '0')} · ${esc(PACKS.find(p => p.id === settings.pack).name)}</div>
        <div class="board" id="board">
          <span class="light" aria-hidden="true"></span>
          <span class="ring" aria-hidden="true"></span>
          <svg class="threads" id="threads" aria-hidden="true"></svg>
          ${CLUES.map(cl => card(c, cl)).join('')}
          <div class="suspect" id="suspect"><span class="scrap" aria-hidden="true"></span><span class="note" aria-hidden="true">где это?!</span><span class="pin" aria-hidden="true"></span>
            <div class="suspect-inner">
              <div class="side suspect-front"><b>?</b><span>Страна № ${n}</span></div>
              <div class="side suspect-back">${shapeSvg(c.id)}<img src="https://flagcdn.com/w80/${c.id.toLowerCase()}.png" alt=""><b>${esc(c.name)}</b></div>
            </div>
            <span class="stamp" id="stamp" hidden></span>
          </div>
        </div>
      </div>
      ${PROPS}
    </div>
    <aside class="notebook" id="notebook"></aside>
  </section>`;
  renderNotebook();
  $('#board').addEventListener('click', onBoardClick);
  $('#board').querySelectorAll('img').forEach(im => im.addEventListener('error', () => im.remove(), { once: true }));
  requestAnimationFrame(() => drawThreads());
  [...stage.querySelectorAll('.clue, .suspect')].forEach((el, k) => A(el, [{ opacity: 0, transform: `translateY(-60px) rotate(${k % 2 ? 9 : -9}deg) scale(1.08)` }, { opacity: 1, transform: 'none' }], { duration: 620, delay: 60 + k * 70, easing: SPRING }));
  A($('#notebook'), [{ opacity: 0, transform: 'translateX(40px) rotate(3deg)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 250, easing: SPRING });
}

async function onBoardClick(e) {
  const back = e.target.closest('[data-open]'), zoom = e.target.closest('[data-zoom]'), walk = e.target.closest('[data-walk]');
  if (walk) return openWalk();
  if (zoom) return openViewer(zoom.src, zoom.closest('.clue')?.querySelector('figcaption, b')?.textContent || '');
  if (!back) return;
  const key = back.dataset.open, r = game.round;
  if (key === 'shape' && !canOpen(r, key) && !r.done) { toast('Конверт с формой вскрывают последним — сначала открой остальные улики', 2600); return nudge(back.closest('.clue')); }
  if (!openClue(r, key)) return;
  await revealCard(key);
  setScore();
  if (key === 'walk' && spotsOf(r.id)) openWalk();
}

async function revealCard(key) {
  const el = stage.querySelector(`.clue[data-key="${key}"]`);
  el.classList.add('open');
  const flipping = flip(el.querySelector('.clue-inner'));
  if (key === 'shape') A(el.querySelector('path'), [{ strokeDashoffset: 1, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: 0, offset: .75 }, { strokeDashoffset: 0, fillOpacity: 1 }], { duration: 1800, delay: 500, easing: 'ease-in-out' });
  await wait(450);
  drawThreads(key);
  return flipping;
}

// Красные нитки от каждой открытой улики к карточке «?».
function drawThreads(fresh) {
  const board = $('#board'), svg = $('#threads');
  if (!board || !svg) return;
  const b = board.getBoundingClientRect(), pinAt = el => { const p = el.querySelector('.pin').getBoundingClientRect(); return [p.left + p.width / 2 - b.left, p.top + p.height / 2 - b.top]; };
  const [sx, sy] = pinAt($('#suspect'));
  svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
  svg.innerHTML = [...board.querySelectorAll('.clue.open')].map(el => {
    const [x, y] = pinAt(el), sag = Math.hypot(sx - x, sy - y) * .12;
    return `<path data-for="${el.dataset.key}" pathLength="1" d="M${x} ${y} Q${(x + sx) / 2} ${(y + sy) / 2 + sag} ${sx} ${sy}"/>`;
  }).join('');
  const line = fresh && svg.querySelector(`[data-for="${fresh}"]`);
  if (line) A(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 650, easing: 'ease-out' });
}
addEventListener('resize', () => drawThreads());

/* ---------- блокнот ---------- */
function ranks() {
  if (game.players.length < 2) return `<div class="solo-total"><span>Всего за игру</span><b>${num(game.players[0].score)}</b></div>`;
  const top = Math.max(...game.players.map(p => p.score));
  return `<ol class="ranks">${game.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score).map(p => `<li class="${p.score === top && top > 0 ? 'lead' : ''}"><span>${p.score === top && top > 0 ? '👑' : AVATARS[p.i]}</span><b>${esc(p.name)}</b><em>${num(p.score)}</em></li>`).join('')}</ol>`;
}
const missRow = m => `<li><s>${esc(nameOf(m.id))}</s><span class="miss-guidance"><strong><b aria-hidden="true">${m.dir}</b> ${directionNames[m.dir]}</strong><small>около ${num(m.km)} км</small></span></li>`;

function renderNotebook() {
  const r = game.round;
  $('#notebook').innerHTML = `<span class="paperclip" aria-hidden="true"></span>
    <h2>Что это за страна?</h2>
    <form class="guess" id="guessForm" autocomplete="off">
      <input class="field" id="guessIn" placeholder="Название страны…" aria-label="Название страны" aria-autocomplete="list" aria-controls="sugg">
      <div class="sugg" id="sugg" role="listbox" hidden></div>
      <button class="btn primary big">Ответить</button>
    </form>
    <p class="direction-note" id="directionNote" ${r.wrong.length ? '' : 'hidden'}>Стрелка показывает направление от названной страны к загаданной. Километры — по условным центрам стран.</p>
    <ul class="misses" id="misses" aria-live="polite">${r.wrong.map(missRow).join('')}</ul>
    <div class="round-score"><span>Очки за дело</span><strong id="score">${num(r.score)}</strong><small>ошибка −${WRONG} · подскажу, куда ближе</small></div>
    ${ranks()}
    <button class="give-up" id="giveUp">Сдаться и раскрыть</button>`;
  const input = $('#guessIn'), box = $('#sugg');
  let hi = 0, list = [];
  const show = () => {
    const q = norm(input.value);
    const starts = [], has = [];
    if (q) for (const n of allNames) { const m = norm(n); if (m.startsWith(q)) starts.push(n); else if (m.includes(q)) has.push(n); }
    list = [...new Set([...starts, ...has])].slice(0, 6); hi = 0;
    box.innerHTML = list.map((n, i) => `<button type="button" role="option" class="${i === hi ? 'hi' : ''}" data-name="${esc(n)}">${esc(n)}</button>`).join('');
    box.hidden = !list.length;
  };
  input.addEventListener('input', show);
  input.addEventListener('keydown', e => {
    if (box.hidden || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    hi = (hi + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length;
    [...box.children].forEach((b, i) => b.classList.toggle('hi', i === hi));
  });
  box.addEventListener('click', e => { const b = e.target.closest('[data-name]'); if (b) { input.value = b.dataset.name; submit(); } });
  $('#guessForm').addEventListener('submit', e => { e.preventDefault(); if (!matchCountry(input.value, names) && list[hi]) input.value = list[hi]; submit(); });
  $('#giveUp').onclick = () => { surrender(game.round); setScore(); finishRound(); };
  if (matchMedia('(pointer:fine)').matches) input.focus({ preventScroll: true });
}

function submit() {
  const input = $('#guessIn'), id = matchCountry(input.value, names);
  if (!input.value.trim()) return nudge(input);
  if (!id) { toast('Не знаю такой страны — выбери из подсказок', 2200); return nudge(input); }
  const res = guess(game.round, id, at);
  input.value = ''; $('#sugg').hidden = true;
  if (!res) return toast(`${nameOf(id)} уже проверяли`, 1800);
  if (res.correct) return finishRound();
  setScore();
  $('#directionNote').hidden = false;
  $('#misses').insertAdjacentHTML('afterbegin', missRow(res));
  A($('#misses').firstElementChild, [{ opacity: 0, transform: 'translateX(-20px) rotate(-3deg)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: SPRING });
  shake($('#suspect'));
}

let shown = START;
function setScore() {
  const el = $('#score'), to = game.round.score, from = shown;
  shown = to;
  if (!el) return;
  if (from === to) { el.textContent = num(to); return; }
  const t0 = performance.now();
  const tick = t => { const k = Math.min(1, (t - t0) / 500); el.textContent = num(Math.round(from + (to - from) * k)); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  A(el, [{ transform: 'scale(1.25)', color: '#ff4d6d' }, { transform: 'none' }], { duration: 500 });
}

/* ---------- раскрытие ---------- */
async function finishRound() {
  const r = game.round, c = byId.get(r.id), sus = $('#suspect'), stamp = $('#stamp');
  $('#guessForm')?.remove(); $('#giveUp')?.remove();
  foldWalk();
  stamp.textContent = r.solved ? 'Раскрыто' : 'Не раскрыто';
  stamp.classList.toggle('fail', !r.solved);
  stamp.hidden = false;
  await A(stamp, [{ opacity: 0, transform: 'rotate(-14deg) scale(3)' }, { opacity: 1, transform: 'rotate(-14deg) scale(.92)', offset: .7 }, { opacity: 1, transform: 'rotate(-14deg) scale(1)' }], { duration: 420, easing: 'cubic-bezier(.5,0,.75,0)' });
  shake($('#board'));
  sus.classList.add('open');
  flip(sus.querySelector('.suspect-inner'));
  A(sus.querySelector('.suspect-back path'), [{ strokeDashoffset: 1, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: 0, offset: .7 }, { strokeDashoffset: 0, fillOpacity: 1 }], { duration: 1600, delay: 300 });
  if (r.solved) confetti(sus, 90);
  const rest = CLUES.filter(cl => !r.open.includes(cl.key));
  for (const cl of rest) { r.open.push(cl.key); revealCard(cl.key); await wait(140); }
  const nb = $('#notebook');
  const head = r.solved ? `<div class="verdict ok"><span>Это ${esc(c.name)}!</span><strong>+${num(r.score)}</strong></div>` : `<div class="verdict"><span>Это была ${esc(c.name)}</span><strong>0</strong></div>`;
  const who = r.solved && r.score > 0 && game.players.length > 1;
  nb.querySelector('h2').outerHTML = head;
  nb.querySelector('.round-score').remove();
  const actions = document.createElement('div');
  actions.className = 'after';
  actions.innerHTML = who ? `<p>Кто раскрыл дело?</p><div class="who">${game.players.map((p, i) => `<button class="btn ghost" data-who="${i}">${AVATARS[i]} ${esc(p.name)}</button>`).join('')}<button class="btn ghost" data-who="">Никто</button></div>` : nextButton();
  nb.querySelector('.misses').after(actions);
  A(actions, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: SPRING });
  if (!who) settle(r.solved ? 0 : null);
  actions.addEventListener('click', e => {
    const w = e.target.closest('[data-who]');
    if (w) { settle(w.dataset.who === '' ? null : +w.dataset.who); actions.innerHTML = nextButton(); }
    if (e.target.closest('#nextBtn')) { if (nextRound(game)) { shown = START; renderRound(); } else finish(); }
  });
}
const nextButton = () => `<button class="btn primary big" id="nextBtn">${game.index + 1 < game.order.length ? 'Следующее дело' : 'Итоги расследования'}</button>`;
function settle(who) {
  award(game, who);
  const old = $('#notebook .ranks, #notebook .solo-total');
  if (old) old.outerHTML = ranks();
}

/* ---------- итоги ---------- */
function finish() {
  exitBtn.hidden = true; $('#progress').hidden = true; resetWalk();
  const ps = game.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
  const solo = ps.length === 1;
  stage.innerHTML = `<section class="final">
    <div class="final-head"><h1>${solo ? 'Расследование закрыто' : `${esc(ps[0].name)} — лучший следователь`}</h1>
      <p class="lead">${solo ? `Раскрыто ${game.log.filter(l => l.pts).length} из ${cases(game.log.length)}. Итог — ${num(ps[0].score)} очков.` : ps.map(p => `${AVATARS[p.i]} ${esc(p.name)}: ${num(p.score)}`).join(' · ')}</p></div>
    <div class="files">${game.log.map(l => `<div class="file${l.pts ? '' : ' cold'}">${shapeSvg(l.id)}<b>${esc(nameOf(l.id))}</b><span>${l.pts ? `+${num(l.pts)}${solo ? '' : ' · ' + esc(game.players[l.who].name)}` : 'не раскрыто'}</span></div>`).join('')}</div>
    <div class="final-buttons"><button class="btn primary" id="againBtn">Новая партия</button><button class="btn ghost" id="homeBtn">Сменить картотеку</button></div>
  </section>`;
  [...stage.querySelectorAll('.file')].forEach((el, k) => A(el, [{ opacity: 0, transform: 'translateY(30px) rotate(-6deg)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: 150 + k * 90, easing: SPRING }));
  if (game.log.some(l => l.pts)) setTimeout(() => confetti($('.final-head h1'), 80), 400);
  $('#againBtn').onclick = start;
  $('#homeBtn').onclick = home;
}

/* ---------- прогулка: панель, которую можно свернуть вниз ---------- */
// Без ключа — встраиваемая панорама Google, но она иногда заводит в кафе и отели (снимки людей).
// С ключом Maps Embed API берём только уличные съёмки (source=outdoor); не нашлось — «Другое место»
// перебирает знаменитые места, а потом разрешает любые панорамы. Табличку с адресом закрывает .walk-cover.
const MAPS_KEY = '';
const walkEl = $('#walk'), dockEl = $('#walkDock'), frameEl = $('#walkFrame');
let spot = 0;
const walkSteps = spots => (MAPS_KEY ? [...spots.map(s => [s, 'outdoor']), ...spots.map(s => [s, 'default'])] : spots.map(s => [s]));
const panoUrl = ([[lat, lng], source]) => {
  const heading = Math.floor(Math.random() * 360);
  return MAPS_KEY
    ? `https://www.google.com/maps/embed/v1/streetview?key=${MAPS_KEY}&location=${lat},${lng}&heading=${heading}&fov=90&radius=2000&source=${source}&language=ru`
    : `https://www.google.com/maps/embed?pb=!6m7!1m6!2m2!1d${lat}!2d${lng}!3f${heading}!4f0!5f0.8`;
};
function openWalk() {
  const steps = walkSteps(spotsOf(game.round.id));
  if (!frameEl.src.startsWith('https://')) frameEl.src = panoUrl(steps[spot]);
  $('#walkOther').hidden = steps.length < 2;
  dockEl.hidden = true; walkEl.hidden = false;
  A(walkEl, [{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 520, easing: SPRING });
}
async function foldWalk() {
  if (walkEl.hidden) return;
  await A(walkEl, [{ transform: 'none' }, { transform: 'translateY(105%)' }], { duration: 320, easing: 'ease-in', fill: 'forwards' });
  walkEl.getAnimations().forEach(a => a.cancel());
  walkEl.hidden = true;
  dockEl.hidden = false;
  A(dockEl, [{ transform: 'translate(-50%,120%)' }, { transform: 'translate(-50%,0)' }], { duration: 450, easing: SPRING });
}
function resetWalk() {
  walkEl.hidden = true; dockEl.hidden = true; spot = 0;
  frameEl.removeAttribute('src');
}
$('#walkFold').onclick = foldWalk;
dockEl.onclick = openWalk;
$('#walkOther').onclick = () => {
  const steps = walkSteps(spotsOf(game.round.id));
  spot = (spot + 1) % steps.length;
  frameEl.src = panoUrl(steps[spot]);
};
addEventListener('keydown', e => { if (e.key === 'Escape' && !walkEl.hidden) foldWalk(); });

/* ---------- фото крупно, правила, выход ---------- */
function openViewer(src, note) {
  $('#viewerBody').innerHTML = `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer">`;
  $('#viewerNote').textContent = note;
  $('#viewer').showModal();
}
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) e.target.closest('dialog').close(); });
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
$('#viewer').addEventListener('close', () => { $('#viewerBody').innerHTML = ''; });
$('#rulesBtn').onclick = () => $('#rulesDialog').showModal();
let armed = null;
exitBtn.onclick = () => {
  if (armed) { clearTimeout(armed); armed = null; home(); return; }
  exitBtn.textContent = 'Точно выйти?';
  armed = setTimeout(() => { armed = null; exitBtn.textContent = 'Закрыть дело'; }, 3000);
};
if (!LS.get('geo.seenRules')) { LS.set('geo.seenRules', 1); setTimeout(() => $('#rulesDialog').showModal(), 600); }
home();
