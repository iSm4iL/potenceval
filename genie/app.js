import { createState, reduce, publicView, humans, GENIE_ID } from './game.js';
import { A, $, h, esc, first, nameOf, me, isHostOf, still, SPRING, burstAt, confetti, shake, nudge, smoke, enter, flyIn, flip,
  toast, setControls, initPage, buildHome, buildLobby, renderPlist, seg, placeSegPills } from '../shared/kit.js?v=kick-1';
import { createNet } from '../shared/net.js?v=kick-1';

const STEP = ['power', 'write', 'reveal', 'hype', 'verdict', 'share'];
const canDrive = s => isHostOf(s) || s.wisher === me.pid;
const stage = $('#stage');
const steps = [...document.querySelectorAll('#steps li')];

const net = createNet({
  game: 'genie', createState, reduce, publicView, reserved: [GENIE_ID],
  tick: (s, apply) => { if (s.phase === 'write' && Date.now() >= s.deadline) apply({ type: 'timeout' }, s.hostId); },
  onState, onLeave: showHome,
});
const send = net.send;

/* ---------- render ---------- */
let view = null, rendered = null, shownKey = null, gen = 0, skew = 0, chain = Promise.resolve();
function onState(s, hostNow) {
  skew = Date.now() - hostNow; view = s;
  chain = chain.then(() => renderState(s)).catch(e => console.error(e));
}
function showHome() {
  view = null;
  chain = chain.then(() => renderState(null)).catch(e => console.error(e));
}
async function renderState(s) {
  const p = rendered; rendered = s;
  const key = !s ? 'home' : ['lobby', 'final'].includes(s.phase) ? s.phase : s.phase + ':' + s.round;
  chrome(p, s);
  if (key !== shownKey) {
    shownKey = key;
    const old = [...stage.children];
    await Promise.all(old.map((el, k) => A(el, [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-14px) scale(.98)', filter: 'blur(6px)' }], { duration: 240, delay: k * 25, easing: 'ease-in', fill: 'forwards' })));
    stage.replaceChildren(); gen++;
    BUILD[s ? s.phase : 'home'](s);
    enter(stage);
    if (s) window.scrollTo({ top: 0, behavior: still() ? 'auto' : 'smooth' });
  } else if (s) PATCH[s.phase]?.(p, s);
  controls(s);
}

function chrome(p, s) {
  $('#room').hidden = !s; $('#exitBtn').hidden = !s;
  if (s) $('#roomCode').textContent = s.code;
  const chips = $('#players');
  chips.hidden = !s || s.phase === 'lobby';
  if (!chips.hidden) renderChips(p, s);
  const inGame = !!s && STEP.includes(s.phase);
  $('#gamebar').hidden = !inGame;
  if (!inGame) return;
  const i = STEP.indexOf(s.phase);
  steps.forEach((li, k) => { li.classList.toggle('on', k === i); li.classList.toggle('done', k < i); });
  placePill();
  setHint(HINTS[s.phase](s));
}
function renderChips(p, s) {
  const box = $('#players');
  box.innerHTML = s.players.map(pl => `<div class="chip ${pl.id === s.wisher ? 'wisher' : ''} ${pl.genie ? 'genie' : ''} ${pl.online ? '' : 'off'}" data-id="${esc(pl.id)}">
    <span class="av" style="background:${esc(pl.color)}">${pl.genie ? '✦' : esc(first(pl.name))}</span>${pl.id === s.hostId ? '👑 ' : ''}${esc(pl.name)}
    ${pl.id === me.pid ? '<small>ты</small>' : ''}${pl.id === s.wisher && s.phase !== 'final' ? '<small>загадывает</small>' : ''}<span class="sc">${pl.score}</span></div>`).join('');
  if (!p) return;
  for (const pl of s.players) {
    const old = p.players.find(x => x.id === pl.id);
    if (!old || pl.score <= old.score) continue;
    const el = box.querySelector(`[data-id="${CSS.escape(pl.id)}"]`);
    A(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 500, easing: SPRING });
    A($('.sc', el), [{ transform: 'translateY(-120%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, easing: SPRING });
  }
}
function placePill() {
  const a = steps.find(li => li.classList.contains('on')), pill = $('#pill');
  if (a) { pill.style.left = a.offsetLeft + 'px'; pill.style.width = a.offsetWidth + 'px'; }
}
function setHint(html) {
  const t = $('#hintTxt');
  if (t.dataset.v === html) return;
  t.dataset.v = html; t.innerHTML = html;
  A(t, [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 450, easing: SPRING });
}
const W = s => `<b>${esc(nameOf(s, s.wisher))}</b>`;
const HINTS = {
  power: s => (s.wisher === me.pid ? 'Ты загадываешь. Тяни суперсилу или впиши свою.' : `${W(s)} тянет суперсилу. Смотрите.`),
  write: s => (s.wisher === me.pid ? 'Остальные пишут подвохи к твоей силе. Не подглядывай 🙈' : `Придумай подвох к силе, которую получает ${W(s)}. Джинн тоже пишет.`),
  reveal: s => (canDrive(s) ? 'Жми «Раскрыть следующий» и читай вслух. Гениально — жмите 🔥' : 'Открываем по одной, читаем вслух. Гениально — жми 🔥'),
  hype: () => 'Докрути любой подвох, чтобы стало ещё хуже. Можно несколько раз.',
  verdict: s => (s.wisher === me.pid ? 'Выбери самый жёсткий подвох и реши: берёшь силу или нет.' : `${W(s)} выбирает самый жёсткий подвох и решает, брать ли силу.`),
  share: () => 'Раунд всё. Кидайте карточку в чат.',
};

function controls(s) {
  const b = [];
  const drv = s && canDrive(s);
  const next = label => ['next', label, 'primary ready', () => send({ type: 'next' })];
  if (s?.phase === 'lobby' && isHostOf(s)) b.push(['start', humans(s).length < 2 ? 'Начать (ты против Джинна)' : 'Начать игру', 'primary ready', () => send({ type: 'start' })]);
  else if (s?.phase === 'power' && drv) {
    if (!s.power) b.push(['draw', 'Тянуть силу', 'primary ready', () => send({ type: 'draw' })], ['custom', 'Своя сила', 'ghost', toggleCustom]);
    else b.push(['draw', 'Другую', 'ghost', () => send({ type: 'draw' })], ['custom', 'Своя сила', 'ghost', toggleCustom], next('Дальше: подвохи →'));
  } else if (s?.phase === 'write' && drv) b.push(['next', 'Раскрыть сейчас', 'ghost', () => send({ type: 'next' })]);
  else if (s?.phase === 'reveal' && drv) b.push(s.revealed < s.cards.length ? ['flip', 'Раскрыть следующий', 'gold ready', () => send({ type: 'flip' })] : next('Дальше: разгон →'));
  else if (s?.phase === 'hype' && drv) b.push(['next', 'Дальше: вердикт →', 'primary', () => send({ type: 'next' })]);
  else if (s?.phase === 'verdict' && drv && s.took !== null) b.push(next('Дальше →'));
  else if (s?.phase === 'share' && drv) b.push(next(s.round + 1 >= s.order.length ? 'Итоги →' : 'Следующий раунд →'));
  else if (s?.phase === 'final' && isHostOf(s)) b.push(['again', 'Ещё партию', 'primary ready', () => send({ type: 'start' })], ['lobby', 'В лобби', 'ghost', () => send({ type: 'lobby' })]);
  setControls(b);
}

/* ---------- cards ---------- */
const backHTML = genie => `<div class="cb ${genie ? 'g' : ''}"><div class="q">${genie ? '✦' : '?'}</div><span>${genie ? 'ДЖИНН' : 'ПОДВОХ'}</span></div>`;
const addHTML = (s, a) => `<div class="add"><b>+ ${esc(nameOf(s, a.by))}:</b> ${esc(a.text)}</div>`;
function frontHTML(s, i, { more = false } = {}) {
  const c = s.cards[i], g = c.by === GENIE_ID;
  return `<div class="cf ${g ? 'g' : ''} ${(c.text || '').length > 60 ? 'long' : ''}"><span class="no">НО</span>
    <div class="txt">${esc(c.text)}</div><div class="adds">${c.adds.map(a => addHTML(s, a)).join('')}</div>
    <div class="ft"><span>${g ? '✦ Джинн' : esc(nameOf(s, c.by))}</span><span>${more ? '<button class="more">+ докрутить</button>' : ''}<button class="fire" data-i="${i}">🔥 <b>${c.fire}</b></button></span></div></div>`;
}
function staticGrid(s, { more = false, pick = false } = {}) {
  const grid = h(`<div class="cgrid ${pick ? 'pick' : ''}" id="grid" data-in></div>`);
  s.cards.forEach((c, i) => grid.append(h(`<div class="ccard" data-i="${i}">${frontHTML(s, i, { more })}</div>`)));
  wireFire(grid);
  return grid;
}
function wireFire(grid) {
  grid.addEventListener('click', e => {
    const f = e.target.closest('.fire');
    if (!f) return;
    e.stopPropagation();
    send({ type: 'fire', i: +f.dataset.i });
  });
}
function patchFire(p, s) {
  s.cards.forEach((c, i) => {
    const old = p.cards[i]?.fire ?? 0;
    if (c.fire === old) return;
    const b = stage.querySelector(`.fire[data-i="${i}"]`);
    if (!b) return;
    b.querySelector('b').textContent = c.fire;
    A(b, [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 350, easing: SPRING });
    burstAt(b, { n: Math.min(12, 4 + (c.fire - old) * 3) });
  });
}
const title = (kicker, h1, sub = '') => stage.append(h(`<div class="phase-title" data-in><span class="kicker">${kicker}</span><h1>${h1}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`));

/* ---------- screens ---------- */
const BUILD = {}, PATCH = {};

BUILD.home = () => buildHome(stage, net, `
  <div class="hero" data-in><span class="kicker">Игра для друзей · 2–8 человек</span>
    <h1 id="heroTitle">Джинн</h1>
    <p class="sub">Один получает суперсилу. Остальные придумывают, в чём подвох. Джинн тоже придумывает — и он подлый.</p>
    <figure class="genie-scene"><img src="../shared/assets/club/genie.webp" alt="Латунная лампа с бирюзовым дымом на прилавке антикварной лавки" width="1200" height="800" fetchpriority="high"></figure>
    <div class="fan">
      <div class="mini m1"><b>СИЛА</b><br>🌀 Телепортация куда угодно. Тело и одежда — в целости.</div>
      <div class="mini m2"><b>НО</b><br>С каждым телепортом ты в два раза тупее. <i>…и умнеешь, только если идёшь пешком.</i></div>
      <div class="mini m3"><b>ДЖИНН</b><br>Тело и одежда в целости, как и просил. Про волосы уговора не было.</div>
    </div>
  </div>`);

const lobbyTag = (pl, s) => (pl.genie ? 'бот-подлец, играет всегда' : pl.id === s.hostId ? 'хост' : pl.online ? 'в лобби' : 'отключился');
BUILD.lobby = s => {
  const host = isHostOf(s);
  buildLobby(stage, s, 'Продиктуй код или кинь ссылку. Можно играть даже вдвоём: Джинн всегда в деле.', lobbyTag, id => send({ type: 'kick', id }));
  stage.append(h(`<div class="settings" data-in>${seg('laps', 'Кругов', [1, 2, 3], s.settings.laps, '', host)}${seg('sec', 'Время на подвох', [45, 60, 90], s.settings.sec, ' с', host)}</div>`));
  stage.querySelectorAll('.seg button').forEach(b => { b.onclick = () => send({ type: 'settings', [b.dataset.k]: +b.dataset.v }); });
  if (!host) stage.append(h(`<p class="wait" data-in>Ждём, пока <b>${esc(nameOf(s, s.hostId))}</b> начнёт <span class="dots"><i></i><i></i><i></i></span></p>`));
  requestAnimationFrame(placeSegPills);
};
PATCH.lobby = (p, s) => {
  renderPlist(s, lobbyTag);
  stage.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === s.settings[sg.dataset.seg])));
  placeSegPills();
};

function fillPower(s) {
  const pw = s.power;
  $('#pcFront').innerHTML = `<div class="pc-front ${pw.title.length > 20 ? 'long' : ''}"><div class="pc-top"><span class="tag">СИЛА</span><span>${pw.id ? '#' + String(pw.id).padStart(3, '0') : 'своя'}</span></div>
    <div class="pc-icon">${pw.icon}</div><h2>${esc(pw.title)}</h2><p>${esc(pw.text)}</p><div class="pc-foot">загадывает ${esc(nameOf(s, s.wisher))}</div></div>`;
}
function toggleCustom() {
  const row = $('#customRow');
  if (!row) return;
  row.hidden = !row.hidden;
  if (!row.hidden) { A(row, [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 300 }); $('#customIn').focus(); }
}
function submitCustom() {
  const v = $('#customIn').value.trim();
  if (!v) { nudge($('#customIn')); return; }
  send({ type: 'custom', text: v });
}
BUILD.power = s => {
  const mine = s.wisher === me.pid;
  title(`Раунд ${s.round + 1} из ${s.order.length}`, mine ? 'Тяни суперсилу' : `${esc(nameOf(s, s.wisher))} тянет силу`,
    mine ? 'Не нравится — тяни другую или впиши свою.' : 'Сейчас узнаем, какая сила выпадет.');
  stage.append(h(`<div class="deck" data-in><div class="pcard b3"></div><div class="pcard b2"></div>
    <div class="pcard flip" id="pc"><div class="inner"><div class="face"><div class="pc-back"><div class="logo2">✦</div><span>СУПЕРСИЛА</span></div></div><div class="face front-face" id="pcFront"></div></div></div></div>`));
  stage.append(h(`<div class="custom-row" id="customRow" hidden><input class="field" id="customIn" maxlength="80" placeholder="Например: читать мысли кошек"><button class="btn primary" id="customOk">Готово</button></div>`));
  $('#customOk').onclick = submitCustom;
  $('#customIn').onkeydown = e => { if (e.key === 'Enter') submitCustom(); };
  if (s.power) { fillPower(s); $('#pc').classList.add('is-flipped'); }
};
PATCH.power = async (p, s) => {
  if (!s.power || (p.power && p.power.id === s.power.id && p.power.title === s.power.title)) return;
  const pc = $('#pc'), inner = $('.inner', pc), myGen = gen;
  $('#customRow').hidden = true;
  if (p.power) { pc.classList.remove('is-flipped'); await A(inner, [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], { duration: 350 }); }
  if (myGen !== gen) return;
  fillPower(s);
  pc.classList.add('is-flipped');
  A(pc, [{ transform: 'none' }, { transform: 'translateY(-34px) rotate(-4deg)', offset: .3 }, { transform: 'none' }], { duration: 1100, easing: SPRING });
  await flip(inner);
  burstAt(pc, { chars: ['✦', '✨', '⭐'], n: 14, spread: 160, up: 160 });
};

async function land(by, animate, from) {
  let slot = stage.querySelector(`.slot[data-by="${CSS.escape(by)}"]`);
  if (!slot) {
    const grid = $('#wgrid');
    if (!grid) return;
    slot = h(`<div class="slot" data-by="${esc(by)}"><span></span><div class="who">${esc(nameOf(rendered, by))}</div></div>`);
    grid.insertBefore(slot, grid.lastElementChild);
  }
  if (slot.classList.contains('filled')) return;
  slot.classList.add('filled');
  const genie = by === GENIE_ID;
  slot.firstElementChild.replaceWith(h(`<div class="ccard"><div class="inner">${backHTML(genie)}</div></div>`));
  slot.querySelector('.who').append(' ✓');
  if (!animate) return;
  const card = slot.querySelector('.ccard');
  if (from) {
    const a = from.getBoundingClientRect(), b = card.getBoundingClientRect();
    await A(card, [{ transform: `translate(${a.left - b.left}px,${a.top - b.top}px) scale(.35)`, opacity: .3 }, { transform: 'translateY(-8px) scale(1.04)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 700 });
  } else await flyIn(card);
  if (genie) { smoke(slot); shake(); }
}
function startTimer(s, myGen) {
  const el = $('#timer'), tv = $('.tv', el), num = $('span', el);
  const total = s.settings.sec * 1000, end = s.deadline + skew;
  const tick = () => {
    if (myGen !== gen) return clearInterval(iv);
    const left = Math.max(0, end - Date.now());
    num.textContent = Math.ceil(left / 1000);
    tv.style.strokeDashoffset = 138.2 * (1 - left / total);
    el.classList.toggle('low', left < 10000);
  };
  const iv = setInterval(tick, 250);
  tick();
}
function sendCatch() {
  const inp = $('#mineIn'), v = inp.value.trim();
  if (!v) { nudge(inp); return; }
  send({ type: 'submit', text: v });
  inp.disabled = true; $('#sendBtn').disabled = true;
}
BUILD.write = s => {
  const mine = s.wisher === me.pid, myGen = gen;
  title(mine ? 'Отвернись 🙈' : 'Все, кроме ' + esc(nameOf(s, s.wisher)), mine ? 'Пишут подвохи' : 'Придумай подвох',
    mine ? 'Сейчас тебе испортят суперсилу.' : 'Чем гениальнее подвох, тем вероятнее от силы откажутся.');
  stage.append(h(`<div class="strip" data-in><span class="ic">${s.power.icon}</span><div><b>${esc(s.power.title)}</b>${s.power.text ? '<br>' + esc(s.power.text) : ''}</div>
    <div class="timer" id="timer"><svg width="52" height="52"><circle class="tr" cx="26" cy="26" r="22"/><circle class="tv" cx="26" cy="26" r="22"/></svg><span></span></div></div>`));
  const grid = h(`<div class="cgrid write-grid" id="wgrid" data-in></div>`);
  [...humans(s).filter(p => p.id !== s.wisher), s.players.find(p => p.genie)].forEach(p => grid.append(h(`<div class="slot" data-by="${esc(p.id)}">
    <span>${p.genie ? '<span class="dots"><i></i><i></i><i></i></span>&nbsp;колдует' : 'пишет…'}</span><div class="who">${esc(p.name)}</div></div>`)));
  stage.append(grid);
  if (!mine) {
    stage.append(h(`<div class="compose" data-in><input class="field" id="mineIn" maxlength="120" placeholder="Твой подвох… (Enter — кинуть)"><button class="btn primary" id="sendBtn">Кинуть</button></div>`));
    $('#sendBtn').onclick = sendCatch;
    $('#mineIn').onkeydown = e => { if (e.key === 'Enter') sendCatch(); };
    if (s.cards.some(c => c.by === me.pid)) { $('#mineIn').disabled = true; $('#sendBtn').disabled = true; }
    else setTimeout(() => { if (myGen === gen) $('#mineIn')?.focus(); }, 700);
  }
  for (const c of s.cards) {
    if (c.by === GENIE_ID) setTimeout(() => { if (myGen === gen) land(c.by, true); }, 2600);
    else land(c.by, false);
  }
  startTimer(s, myGen);
};
PATCH.write = (p, s) => {
  for (const c of s.cards) if (!p.cards.some(x => x.by === c.by)) land(c.by, true, c.by === me.pid ? $('#mineIn') : null);
};

function fillFront(el, s, i) { $('.front-face', el).innerHTML = frontHTML(s, i); }
BUILD.reveal = s => {
  title(s.wisher === me.pid ? 'Твоя сила под угрозой' : esc(nameOf(s, s.wisher)) + ' смотрит', 'Раскрываем', 'По одному. Джинн — последним. Гениально? Жми 🔥');
  const grid = h(`<div class="cgrid" id="grid" data-in></div>`);
  s.cards.forEach((c, i) => {
    const el = h(`<div class="ccard flip" data-i="${i}"><div class="inner"><div class="face">${backHTML(c.by === GENIE_ID)}</div><div class="face front-face"></div></div></div>`);
    if (i < s.revealed) { fillFront(el, s, i); el.classList.add('is-flipped'); }
    grid.append(el);
  });
  wireFire(grid);
  stage.append(grid);
};
PATCH.reveal = (p, s) => {
  const grid = $('#grid');
  for (let i = p.revealed; i < s.revealed; i++) {
    const el = grid.children[i];
    fillFront(el, s, i);
    el.classList.add('is-flipped');
    flip($('.inner', el)).then(() => {
      if (s.cards[i].by !== GENIE_ID) return;
      smoke(el); shake(); burstAt(el, { chars: ['✦', '✨'], n: 16, spread: 170, up: 170 });
    });
  }
  patchFire(p, s);
};

function addLine(card, html) {
  const adds = $('.adds', card), line = h(html);
  const before = card.offsetHeight;
  adds.append(line);
  const after = card.offsetHeight;
  A(card, [{ height: before + 'px' }, { height: after + 'px' }], { duration: 450, easing: SPRING, fill: 'none' });
  A(line, [{ opacity: 0, transform: 'translateX(-24px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: SPRING });
  A(card, [{ transform: 'rotate(0)' }, { transform: 'rotate(-1.5deg) scale(1.03)' }, { transform: 'rotate(1deg)' }, { transform: 'none' }], { duration: 600 });
  burstAt(line, { chars: ['🔥', '😂'], n: 8 });
}
function openAdd(card, btn) {
  btn.hidden = true;
  const box = h(`<div class="mini-in"><input maxlength="90" placeholder="…и ещё"><button>OK</button></div>`);
  $('.adds', card).after(box);
  A(box, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 300 });
  const inp = $('input', box);
  inp.focus();
  const ok = () => {
    const v = inp.value.trim();
    box.remove(); btn.hidden = false;
    if (v) send({ type: 'add', i: +card.dataset.i, text: v });
  };
  $('button', box).onclick = ok;
  inp.onkeydown = e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') { box.remove(); btn.hidden = false; } };
}
BUILD.hype = s => {
  title('Разгон', 'Докрутите', 'Сделайте любой подвох ещё хуже. Тут и начинается ор.');
  const grid = staticGrid(s, { more: true });
  grid.addEventListener('click', e => {
    const m = e.target.closest('.more');
    if (m) openAdd(m.closest('.ccard'), m);
  });
  stage.append(grid);
};
PATCH.hype = (p, s) => {
  s.cards.forEach((c, i) => {
    const card = stage.querySelector(`.ccard[data-i="${i}"]`);
    for (let k = p.cards[i]?.adds.length || 0; k < c.adds.length; k++) addLine(card, addHTML(s, c.adds[k]));
  });
  patchFire(p, s);
};

function focusChosen(s, anim) {
  [...$('#grid').children].forEach((el, i) => {
    const on = i === s.chosen;
    el.classList.toggle('chosen', on);
    el.style.transition = anim && !still() ? 'transform .55s var(--spring), opacity .4s, filter .4s, box-shadow .4s' : 'none';
    el.style.opacity = on ? '' : '.25';
    el.style.filter = on ? '' : 'blur(1.5px)';
    el.style.transform = on ? 'scale(1.04) translateY(-6px)' : 'scale(.94)';
  });
}
function showDecision(s, anim) {
  const vb = $('#vbox'), w = esc(nameOf(s, s.wisher));
  vb.replaceChildren(h(canDrive(s)
    ? `<div class="banner"><h2>${s.wisher === me.pid ? 'Берёшь' : 'Берёт ли ' + w} силу с этим подвохом?</h2>
       <div class="row"><button class="btn ghost" id="takeBtn">Беру всё равно</button><button class="btn primary" id="nopeBtn">Не, нафиг</button></div>
       <p class="sub">Можно передумать и тыкнуть другую карточку.</p></div>`
    : `<div class="banner"><h2>${w} решает <span class="dots"><i></i><i></i><i></i></span></h2></div>`));
  if (anim) A(vb.firstElementChild, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: SPRING });
  const take = $('#takeBtn'), nope = $('#nopeBtn');
  if (take) { take.onclick = () => send({ type: 'decide', take: true }); nope.onclick = () => send({ type: 'decide', take: false }); }
}
function showResult(s, anim) {
  const c = s.cards[s.chosen], refused = !s.took, w = esc(nameOf(s, s.wisher));
  const who = refused ? (c.by === GENIE_ID ? 'Джинн' : nameOf(s, c.by)) : nameOf(s, s.wisher);
  const vb = $('#vbox');
  vb.replaceChildren(h(`<div class="banner"><h2>${refused ? `${w}: «Не, нафиг». Подвох сработал!` : `${w} берёт силу. Подвох не дожал.`}</h2>
    <p>${refused ? 'Очко автору подвоха' : 'Очко за смелость'}</p><span class="plus">+1 ${esc(who)}</span></div>`));
  if (!anim) return;
  A(vb.firstElementChild, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: SPRING });
  if (refused) { confetti($('#grid').children[s.chosen]); shake(); }
}
BUILD.verdict = s => {
  const drv = canDrive(s), mine = s.wisher === me.pid;
  title('Вердикт', mine ? 'Какой подвох самый жёсткий?' : `${esc(nameOf(s, s.wisher))} выбирает самый жёсткий`, drv && s.took === null ? 'Тыкни карточку.' : '');
  const grid = staticGrid(s, { pick: drv });
  grid.addEventListener('click', e => {
    const card = e.target.closest('.ccard');
    if (!card || e.target.closest('.fire') || !view || !canDrive(view) || view.took !== null) return;
    send({ type: 'choose', i: +card.dataset.i });
  });
  stage.append(grid);
  stage.append(h(`<div id="vbox"></div>`));
  if (s.chosen !== null) focusChosen(s, false);
  if (s.took !== null) showResult(s, false);
  else if (s.chosen !== null) showDecision(s, false);
};
PATCH.verdict = (p, s) => {
  if (s.chosen !== p.chosen && s.chosen !== null) { focusChosen(s, true); if (s.took === null) showDecision(s, p.chosen === null); }
  if (s.took !== null && p.took === null) showResult(s, true);
  patchFire(p, s);
};

/* ---------- share card ---------- */
async function posterBlob(s, c) {
  await document.fonts.ready;
  const Wd = 1080, P = 80, maxW = Wd - P * 2;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const wrap = (text, font) => {
    ctx.font = font;
    const lines = [];
    let line = '';
    for (const w of String(text).split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  };
  const F = { title: '800 58px Unbounded', ptext: '400 34px Onest', catch: '500 48px Onest', add: '400 34px Onest' };
  const blocks = [
    ['pill', 'СИЛА', '#344a3b'],
    ['text', wrap(`${s.power.icon} ${s.power.title}`, F.title), F.title, 70, '#443324'],
    ...(s.power.text ? [['text', wrap(s.power.text, F.ptext), F.ptext, 46, '#786044']] : []),
    ['gap', 30], ['pill', 'НО', '#873e34'],
    ['text', wrap(c.text, F.catch), F.catch, 62, '#443324'],
    ...c.adds.map(a => ['text', wrap('+ ' + a.text, F.add), F.add, 46, '#854b35']),
  ];
  const height = blocks.reduce((y, b) => y + (b[0] === 'pill' ? 84 : b[0] === 'gap' ? b[1] : b[1].length * b[3] + 14), P + 90) + 150;
  cv.width = Wd; cv.height = height;
  const g = ctx.createLinearGradient(0, 0, Wd * .4, height);
  g.addColorStop(0, '#f2e2c2'); g.addColorStop(.7, '#dfc59e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, Wd, height);
  const glow = ctx.createRadialGradient(Wd * .85, 120, 0, Wd * .85, 120, 500);
  glow.addColorStop(0, 'rgba(237,185,101,.18)'); glow.addColorStop(1, 'rgba(237,185,101,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, Wd, height);
  ctx.textBaseline = 'top';
  ctx.font = '800 32px Unbounded'; ctx.fillStyle = '#735326'; ctx.fillText('potenceval', P, P);
  ctx.font = '400 28px Onest'; ctx.fillStyle = '#786044'; ctx.textAlign = 'right'; ctx.fillText(`✦ Джинн · раунд ${s.round + 1}`, Wd - P, P + 4); ctx.textAlign = 'left';
  let y = P + 90;
  for (const b of blocks) {
    if (b[0] === 'gap') { y += b[1]; continue; }
    if (b[0] === 'pill') {
      ctx.font = '600 24px Unbounded';
      const w = ctx.measureText(b[1]).width + 44;
      ctx.fillStyle = b[2]; ctx.beginPath(); ctx.roundRect(P, y, w, 48, 24); ctx.fill();
      ctx.fillStyle = '#f7e8cc'; ctx.fillText(b[1], P + 22, y + 11);
      y += 84; continue;
    }
    ctx.font = b[2]; ctx.fillStyle = b[4];
    for (const line of b[1]) { ctx.fillText(line, P, y); y += b[3]; }
    y += 14;
  }
  y += 40;
  ctx.fillStyle = 'rgba(142,109,60,.3)'; ctx.fillRect(P, y, maxW, 2);
  y += 34;
  ctx.font = '400 30px Onest'; ctx.fillStyle = '#786044';
  ctx.fillText('придумал' + (c.by === GENIE_ID ? ' ✦ Джинн' : ': ' + nameOf(s, c.by)), P, y);
  ctx.textAlign = 'right'; ctx.fillText('🔥 ' + c.fire, Wd - P, y); ctx.textAlign = 'left';
  return new Promise(r => cv.toBlob(r, 'image/png'));
}
BUILD.share = s => {
  const c = s.cards[s.chosen ?? 0];
  if (!c) return;
  title('Итог раунда', 'Карточка в чат', 'Скопируй и вставь в дискорд или скачай картинкой.');
  const by = c.by === GENIE_ID ? '✦ Джинн' : esc(nameOf(s, c.by));
  const wrapEl = h(`<div class="poster-wrap" data-in><div class="poster" id="poster">
    <div class="brand"><b>potenceval</b><span>✦ Джинн · раунд ${s.round + 1}</span></div>
    <span class="lab l1">СИЛА</span><h2>${s.power.icon} ${esc(s.power.title)}</h2>
    <span class="lab l2">НО</span><div class="ptxt">${esc(c.text)}</div>
    ${c.adds.map(a => `<div class="padd">+ ${esc(a.text)}</div>`).join('')}
    <div class="pft"><span>придумал${c.by === GENIE_ID ? '' : ':'} ${by}</span><span>🔥 ${c.fire}</span></div></div></div>`);
  stage.append(wrapEl);
  stage.append(h(`<div class="row" data-in><button class="btn gold" id="copyImg">Скопировать картинку</button><button class="btn ghost" id="dlImg">Скачать</button></div>`));
  const p = $('#poster');
  wrapEl.onpointermove = e => {
    if (still()) return;
    const r = p.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    p.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg)`;
  };
  wrapEl.onpointerleave = () => { p.style.transform = ''; };
  $('#dlImg').onclick = async () => {
    const blob = await posterBlob(s, c);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `dzhinn-raund-${s.round + 1}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  $('#copyImg').onclick = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': posterBlob(s, c) })]);
      toast('Картинка скопирована — вставь в чат (Ctrl+V)', 2200);
      burstAt(p, { chars: ['✨'], n: 10, spread: 120 });
    } catch { toast('Браузер не дал скопировать — жми «Скачать»', 2500); }
  };
  setTimeout(() => burstAt(p, { chars: ['✦', '✨', '🔥'], n: 16, spread: 200, up: 180 }), 700);
};

BUILD.final = s => {
  const ranked = [...s.players].sort((a, b) => b.score - a.score);
  const top = ranked[0], tie = ranked[1] && ranked[1].score === top.score;
  title('Конец игры', tie ? 'Ничья!' : `Победитель — ${esc(top.name)}`, tie ? 'Делите корону.' : top.genie ? 'Джинн оказался подлее всех. Позор.' : 'Корона уходит сюда. Ещё партию?');
  const max = Math.max(1, top.score);
  const podium = ranked.slice(0, 3);
  const order = [podium[1], podium[0], podium[2]].filter(Boolean);
  const el = h(`<div class="podium" data-in>${order.map(pl => {
    const place = podium.indexOf(pl) + 1;
    return `<div class="pod p${place}"><div class="crown">${place === 1 ? '👑' : ''}</div>
      <div class="av" style="background:${esc(pl.color)}">${pl.genie ? '✦' : esc(first(pl.name))}</div><div class="nm">${esc(pl.name)}</div>
      <div class="bar" style="height:${70 + 130 * pl.score / max}px">${pl.score}</div></div>`;
  }).join('')}</div>`);
  stage.append(el);
  if (ranked.length > 3) stage.append(h(`<div class="rest" data-in>${ranked.slice(3).map((pl, k) => `<div><span>${k + 4}. ${esc(pl.name)}</span><b>${pl.score}</b></div>`).join('')}</div>`));
  const bars = [...el.querySelectorAll('.pod')];
  bars.sort((a, b) => b.className.localeCompare(a.className)).forEach((pod, k) =>
    A($('.bar', pod), [{ transform: 'scaleY(0)', transformOrigin: 'bottom' }, { transform: 'scaleY(1)', transformOrigin: 'bottom' }], { duration: 800, delay: 300 + k * 350, easing: SPRING }));
  const crown = $('.p1 .crown', el);
  A(crown, [{ opacity: 0, transform: 'translateY(-80px) rotate(-30deg)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 1300, easing: SPRING })
    .then(() => confetti(crown, 90));
};

/* ---------- boot ---------- */
initPage('genie', net);
addEventListener('resize', () => { placePill(); placeSegPills(); });
if (!net.resume()) showHome();
