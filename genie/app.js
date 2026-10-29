import { t } from '../shared/i18n.js?v=ui-20261029';
import { createState, reduce, publicView, humans, GENIE_ID } from './game.js';
import { A, $, h, esc, first, nameOf, me, isHostOf, still, SPRING, burstAt, confetti, shake, nudge, smoke, enter, flyIn, flip,
  toast, setControls, initPage, buildHome, buildLobby, renderPlist, seg, placeSegPills } from '../shared/kit.js?v=kick-1';
import { createNet } from '../shared/net.js?v=own-1';

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
    ${pl.id === me.pid ? `<small>${t('ты', 'you')}</small>` : ''}${pl.id === s.wisher && s.phase !== 'final' ? `<small>${t('загадывает', 'wishing')}</small>` : ''}<span class="sc">${pl.score}</span></div>`).join('');
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
  const el = $('#hintTxt');
  if (el.dataset.v === html) return;
  el.dataset.v = html; el.innerHTML = html;
  A(el, [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 450, easing: SPRING });
}
const W = s => `<b>${esc(nameOf(s, s.wisher))}</b>`;
const HINTS = {
  power: s => (s.wisher === me.pid ? t('Ты загадываешь. Тяни суперсилу или впиши свою.', 'You’re wishing. Draw a superpower or write your own.') : t(`${W(s)} тянет суперсилу. Смотрите.`, `${W(s)} is drawing a superpower. Watch.`)),
  write: s => (s.wisher === me.pid ? t('Остальные пишут подвохи к твоей силе. Не подглядывай 🙈', 'The others are writing catches for your power. No peeking 🙈') : t(`Придумай подвох к силе, которую получает ${W(s)}. Джинн тоже пишет.`, `Invent a catch for the power ${W(s)} is getting. The Genie is writing too.`)),
  reveal: s => (canDrive(s) ? t('Жми «Раскрыть следующий» и читай вслух. Гениально — жмите 🔥', 'Hit “Reveal next” and read it out loud. Genius? Hit 🔥') : t('Открываем по одной, читаем вслух. Гениально — жми 🔥', 'One at a time, read out loud. Genius? Hit 🔥')),
  hype: () => t('Докрути любой подвох, чтобы стало ещё хуже. Можно несколько раз.', 'Twist any catch to make it even worse. As many times as you like.'),
  verdict: s => (s.wisher === me.pid ? t('Выбери самый жёсткий подвох и реши: берёшь силу или нет.', 'Pick the harshest catch and decide: take the power or not.') : t(`${W(s)} выбирает самый жёсткий подвох и решает, брать ли силу.`, `${W(s)} picks the harshest catch and decides whether to take the power.`)),
  share: () => t('Раунд всё. Кидайте карточку в чат.', 'Round over. Drop the card in the chat.'),
};

function controls(s) {
  const b = [];
  const drv = s && canDrive(s);
  const next = label => ['next', label, 'primary ready', () => send({ type: 'next' })];
  if (s?.phase === 'lobby' && isHostOf(s)) b.push(['start', humans(s).length < 2 ? t('Начать (ты против Джинна)', 'Start (you vs the Genie)') : t('Начать игру', 'Start game'), 'primary ready', () => send({ type: 'start' })]);
  else if (s?.phase === 'power' && drv) {
    if (!s.power) b.push(['draw', t('Тянуть силу', 'Draw a power'), 'primary ready', () => send({ type: 'draw' })], ['custom', t('Своя сила', 'Own power'), 'ghost', toggleCustom]);
    else b.push(['draw', t('Другую', 'Another'), 'ghost', () => send({ type: 'draw' })], ['custom', t('Своя сила', 'Own power'), 'ghost', toggleCustom], next(t('Дальше: подвохи →', 'Next: catches →')));
  } else if (s?.phase === 'write' && drv) b.push(['next', t('Раскрыть сейчас', 'Reveal now'), 'ghost', () => send({ type: 'next' })]);
  else if (s?.phase === 'reveal' && drv) b.push(s.revealed < s.cards.length ? ['flip', t('Раскрыть следующий', 'Reveal next'), 'gold ready', () => send({ type: 'flip' })] : next(t('Дальше: разгон →', 'Next: twist →')));
  else if (s?.phase === 'hype' && drv) b.push(['next', t('Дальше: вердикт →', 'Next: verdict →'), 'primary', () => send({ type: 'next' })]);
  else if (s?.phase === 'verdict' && drv && s.took !== null) b.push(next(t('Дальше →', 'Next →')));
  else if (s?.phase === 'share' && drv) b.push(next(s.round + 1 >= s.order.length ? t('Итоги →', 'Results →') : t('Следующий раунд →', 'Next round →')));
  else if (s?.phase === 'final' && isHostOf(s)) b.push(['again', t('Ещё партию', 'Play again'), 'primary ready', () => send({ type: 'start' })], ['lobby', t('В лобби', 'Back to lobby'), 'ghost', () => send({ type: 'lobby' })]);
  setControls(b);
}

/* ---------- cards ---------- */
const backHTML = genie => `<div class="cb ${genie ? 'g' : ''}"><div class="q">${genie ? '✦' : '?'}</div><span>${genie ? t('ДЖИНН', 'GENIE') : t('ПОДВОХ', 'CATCH')}</span></div>`;
const addHTML = (s, a) => `<div class="add"><b>+ ${esc(nameOf(s, a.by))}:</b> ${esc(a.text)}</div>`;
function frontHTML(s, i, { more = false } = {}) {
  const c = s.cards[i], g = c.by === GENIE_ID;
  return `<div class="cf ${g ? 'g' : ''} ${(c.text || '').length > 60 ? 'long' : ''}"><span class="no">${t('НО', 'BUT')}</span>
    <div class="txt">${esc(c.text)}</div><div class="adds">${c.adds.map(a => addHTML(s, a)).join('')}</div>
    <div class="ft"><span>${g ? '✦ ' + t('Джинн', 'Genie') : esc(nameOf(s, c.by))}</span><span>${more ? `<button class="more">${t('+ докрутить', '+ twist it')}</button>` : ''}<button class="fire" data-i="${i}">🔥 <b>${c.fire}</b></button></span></div></div>`;
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
  <div class="hero" data-in><div class="genie-intro"><span class="kicker">${t('Игра для друзей · 2–8 человек', 'A game for friends · 2–8 people')}</span>
    <h1 id="heroTitle">${t('Джинн', 'Genie')}</h1>
    <p class="sub">${t('Один получает суперсилу. Остальные придумывают, в чём подвох. Джинн тоже придумывает — и он подлый.', 'One player gets a superpower. The others invent the catch. The Genie invents one too — and he’s sneaky.')}</p>
    </div><img class="genie-host" src="assets/genie-host.webp" alt="${t('Дружелюбный джинн поднимается из резной лампы и приглашает играть', 'A friendly genie rises from an ornate lamp and invites you to play')}" width="1122" height="1402" fetchpriority="high">
    <div class="fan" aria-label="${t('Пример суперсилы и двух подвохов', 'A sample superpower and two catches')}">
      <div class="mini m1"><b>${t('СИЛА', 'POWER')}</b><br>🌀 ${t('Телепортация куда угодно. Тело и одежда — в целости.', 'Teleport anywhere. Body and clothes intact.')}</div>
      <div class="mini m2"><b>${t('НО', 'BUT')}</b><br>${t('С каждым телепортом ты в два раза тупее. <i>…и умнеешь, только если идёшь пешком.</i>', 'Every teleport makes you twice as dumb. <i>…and you only get smarter by walking.</i>')}</div>
      <div class="mini m3"><b>${t('ДЖИНН', 'GENIE')}</b><br>${t('Тело и одежда в целости, как и просил. Про волосы уговора не было.', 'Body and clothes intact, as requested. Nobody said anything about hair.')}</div>
    </div>
  </div>`);

const lobbyTag = (pl, s) => (pl.genie ? t('бот-подлец, играет всегда', 'sneaky bot, always plays') : pl.id === s.hostId ? t('хост', 'host') : pl.online ? t('в лобби', 'in lobby') : t('отключился', 'offline'));
BUILD.lobby = s => {
  const host = isHostOf(s);
  buildLobby(stage, s, t('Продиктуй код или кинь ссылку. Можно играть даже вдвоём: Джинн всегда в деле.', 'Read out the code or send the link. Even two can play: the Genie is always in.'), lobbyTag, id => send({ type: 'kick', id }));
  stage.append(h(`<div class="settings" data-in>${seg('laps', t('Кругов', 'Laps'), [1, 2, 3], s.settings.laps, '', host)}${seg('sec', t('Время на подвох', 'Time per catch'), [45, 60, 90], s.settings.sec, t(' с', ' s'), host)}</div>`));
  stage.querySelectorAll('.seg button').forEach(b => { b.onclick = () => send({ type: 'settings', [b.dataset.k]: +b.dataset.v }); });
  if (!host) stage.append(h(`<p class="wait" data-in>${t('Ждём, пока', 'Waiting for')} <b>${esc(nameOf(s, s.hostId))}</b> ${t('начнёт', 'to start')} <span class="dots"><i></i><i></i><i></i></span></p>`));
  requestAnimationFrame(placeSegPills);
};
PATCH.lobby = (p, s) => {
  renderPlist(s, lobbyTag);
  stage.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === s.settings[sg.dataset.seg])));
  placeSegPills();
};

function fillPower(s) {
  const pw = s.power;
  $('#pcFront').innerHTML = `<div class="pc-front ${pw.title.length > 20 ? 'long' : ''}"><div class="pc-top"><span class="tag">${t('СИЛА', 'POWER')}</span><span>${pw.id ? '#' + String(pw.id).padStart(3, '0') : t('своя', 'custom')}</span></div>
    <div class="pc-icon">${pw.icon}</div><h2>${esc(pw.title)}</h2><p>${esc(pw.text)}</p><div class="pc-foot">${t('загадывает', 'wished by')} ${esc(nameOf(s, s.wisher))}</div></div>`;
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
  title(t(`Раунд ${s.round + 1} из ${s.order.length}`, `Round ${s.round + 1} of ${s.order.length}`), mine ? t('Тяни суперсилу', 'Draw a superpower') : t(`${esc(nameOf(s, s.wisher))} тянет силу`, `${esc(nameOf(s, s.wisher))} is drawing a power`),
    mine ? t('Не нравится — тяни другую или впиши свою.', 'Don’t like it? Draw another or write your own.') : t('Сейчас узнаем, какая сила выпадет.', 'Let’s see which power comes up.'));
  stage.append(h(`<div class="deck" data-in><div class="pcard b3"></div><div class="pcard b2"></div>
    <div class="pcard flip" id="pc"><div class="inner"><div class="face"><div class="pc-back"><div class="logo2">✦</div><span>${t('СУПЕРСИЛА', 'SUPERPOWER')}</span></div></div><div class="face front-face" id="pcFront"></div></div></div></div>`));
  stage.append(h(`<div class="custom-row" id="customRow" hidden><input class="field" id="customIn" maxlength="80" placeholder="${t('Например: читать мысли кошек', 'E.g. read cats’ minds')}"><button class="btn primary" id="customOk">${t('Готово', 'Done')}</button></div>`));
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
  title(mine ? t('Отвернись 🙈', 'Look away 🙈') : t('Все, кроме ', 'Everyone except ') + esc(nameOf(s, s.wisher)), mine ? t('Пишут подвохи', 'Catches incoming') : t('Придумай подвох', 'Invent a catch'),
    mine ? t('Сейчас тебе испортят суперсилу.', 'They’re about to ruin your superpower.') : t('Чем гениальнее подвох, тем вероятнее от силы откажутся.', 'The smarter the catch, the likelier they refuse the power.'));
  stage.append(h(`<div class="strip" data-in><span class="ic">${s.power.icon}</span><div><b>${esc(s.power.title)}</b>${s.power.text ? '<br>' + esc(s.power.text) : ''}</div>
    <div class="timer" id="timer"><svg width="52" height="52"><circle class="tr" cx="26" cy="26" r="22"/><circle class="tv" cx="26" cy="26" r="22"/></svg><span></span></div></div>`));
  const grid = h(`<div class="cgrid write-grid" id="wgrid" data-in></div>`);
  [...humans(s).filter(p => p.id !== s.wisher), s.players.find(p => p.genie)].forEach(p => grid.append(h(`<div class="slot" data-by="${esc(p.id)}">
    <span>${p.genie ? '<span class="dots"><i></i><i></i><i></i></span>&nbsp;' + t('колдует', 'conjuring') : t('пишет…', 'writing…')}</span><div class="who">${esc(p.name)}</div></div>`)));
  stage.append(grid);
  if (!mine) {
    stage.append(h(`<div class="compose" data-in><input class="field" id="mineIn" maxlength="120" placeholder="${t('Твой подвох… (Enter — кинуть)', 'Your catch… (Enter to send)')}"><button class="btn primary" id="sendBtn">${t('Кинуть', 'Send')}</button></div>`));
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
  title(s.wisher === me.pid ? t('Твоя сила под угрозой', 'Your power is in danger') : esc(nameOf(s, s.wisher)) + t(' смотрит', ' is watching'), t('Раскрываем', 'Reveal'), t('По одному. Джинн — последним. Гениально? Жми 🔥', 'One by one. The Genie goes last. Genius? Hit 🔥'));
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
  const box = h(`<div class="mini-in"><input maxlength="90" placeholder="${t('…и ещё', '…and also')}"><button>OK</button></div>`);
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
  title(t('Разгон', 'Twist'), t('Докрутите', 'Make it worse'), t('Сделайте любой подвох ещё хуже. Тут и начинается ор.', 'Make any catch even worse. This is where the screaming starts.'));
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
    ? `<div class="banner"><h2>${s.wisher === me.pid ? t('Берёшь силу с этим подвохом?', 'Will you take the power with this catch?') : t(`Берёт ли ${w} силу с этим подвохом?`, `Will ${w} take the power with this catch?`)}</h2>
       <div class="row"><button class="btn ghost" id="takeBtn">${t('Беру всё равно', 'Taking it anyway')}</button><button class="btn primary" id="nopeBtn">${t('Не, нафиг', 'Nope, no way')}</button></div>
       <p class="sub">${t('Можно передумать и тыкнуть другую карточку.', 'You can change your mind and tap another card.')}</p></div>`
    : `<div class="banner"><h2>${w} ${t('решает', 'is deciding')} <span class="dots"><i></i><i></i><i></i></span></h2></div>`));
  if (anim) A(vb.firstElementChild, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: SPRING });
  const take = $('#takeBtn'), nope = $('#nopeBtn');
  if (take) { take.onclick = () => send({ type: 'decide', take: true }); nope.onclick = () => send({ type: 'decide', take: false }); }
}
function showResult(s, anim) {
  const c = s.cards[s.chosen], refused = !s.took, w = esc(nameOf(s, s.wisher));
  const who = refused ? (c.by === GENIE_ID ? t('Джинн', 'Genie') : nameOf(s, c.by)) : nameOf(s, s.wisher);
  const vb = $('#vbox');
  vb.replaceChildren(h(`<div class="banner"><h2>${refused ? t(`${w}: «Не, нафиг». Подвох сработал!`, `${w}: “Nope, no way.” The catch worked!`) : t(`${w} берёт силу. Подвох не дожал.`, `${w} takes the power. The catch wasn’t enough.`)}</h2>
    <p>${refused ? t('Очко автору подвоха', 'A point to the catch’s author') : t('Очко за смелость', 'A point for bravery')}</p><span class="plus">+1 ${esc(who)}</span></div>`));
  if (!anim) return;
  A(vb.firstElementChild, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: SPRING });
  if (refused) { confetti($('#grid').children[s.chosen]); shake(); }
}
BUILD.verdict = s => {
  const drv = canDrive(s), mine = s.wisher === me.pid;
  title(t('Вердикт', 'Verdict'), mine ? t('Какой подвох самый жёсткий?', 'Which catch is the harshest?') : t(`${esc(nameOf(s, s.wisher))} выбирает самый жёсткий`, `${esc(nameOf(s, s.wisher))} is picking the harshest`), drv && s.took === null ? t('Тыкни карточку.', 'Tap a card.') : '');
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
    ['pill', t('СИЛА', 'POWER'), '#344a3b'],
    ['text', wrap(`${s.power.icon} ${s.power.title}`, F.title), F.title, 70, '#443324'],
    ...(s.power.text ? [['text', wrap(s.power.text, F.ptext), F.ptext, 46, '#786044']] : []),
    ['gap', 30], ['pill', t('НО', 'BUT'), '#873e34'],
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
  ctx.font = '400 28px Onest'; ctx.fillStyle = '#786044'; ctx.textAlign = 'right'; ctx.fillText(t(`✦ Джинн · раунд ${s.round + 1}`, `✦ Genie · round ${s.round + 1}`), Wd - P, P + 4); ctx.textAlign = 'left';
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
  ctx.fillText(t('придумал', 'by') + (c.by === GENIE_ID ? ' ✦ ' + t('Джинн', 'Genie') : ': ' + nameOf(s, c.by)), P, y);
  ctx.textAlign = 'right'; ctx.fillText('🔥 ' + c.fire, Wd - P, y); ctx.textAlign = 'left';
  return new Promise(r => cv.toBlob(r, 'image/png'));
}
BUILD.share = s => {
  const c = s.cards[s.chosen ?? 0];
  if (!c) return;
  title(t('Итог раунда', 'Round result'), t('Карточка в чат', 'Card for the chat'), t('Скопируй и вставь в дискорд или скачай картинкой.', 'Copy and paste it into Discord or download it as an image.'));
  const by = c.by === GENIE_ID ? '✦ ' + t('Джинн', 'Genie') : esc(nameOf(s, c.by));
  const wrapEl = h(`<div class="poster-wrap" data-in><div class="poster" id="poster">
    <div class="brand"><b>potenceval</b><span>${t(`✦ Джинн · раунд ${s.round + 1}`, `✦ Genie · round ${s.round + 1}`)}</span></div>
    <span class="lab l1">${t('СИЛА', 'POWER')}</span><h2>${s.power.icon} ${esc(s.power.title)}</h2>
    <span class="lab l2">${t('НО', 'BUT')}</span><div class="ptxt">${esc(c.text)}</div>
    ${c.adds.map(a => `<div class="padd">+ ${esc(a.text)}</div>`).join('')}
    <div class="pft"><span>${t('придумал', 'by')}${c.by === GENIE_ID ? '' : ':'} ${by}</span><span>🔥 ${c.fire}</span></div></div></div>`);
  stage.append(wrapEl);
  stage.append(h(`<div class="row" data-in><button class="btn gold" id="copyImg">${t('Скопировать картинку', 'Copy image')}</button><button class="btn ghost" id="dlImg">${t('Скачать', 'Download')}</button></div>`));
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
    a.href = URL.createObjectURL(blob); a.download = t(`dzhinn-raund-${s.round + 1}.png`, `genie-round-${s.round + 1}.png`); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  $('#copyImg').onclick = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': posterBlob(s, c) })]);
      toast(t('Картинка скопирована — вставь в чат (Ctrl+V)', 'Image copied — paste it in the chat (Ctrl+V)'), 2200);
      burstAt(p, { chars: ['✨'], n: 10, spread: 120 });
    } catch { toast(t('Браузер не дал скопировать — жми «Скачать»', 'The browser blocked copying — hit “Download”'), 2500); }
  };
  setTimeout(() => burstAt(p, { chars: ['✦', '✨', '🔥'], n: 16, spread: 200, up: 180 }), 700);
};

BUILD.final = s => {
  const ranked = [...s.players].sort((a, b) => b.score - a.score);
  const top = ranked[0], tie = ranked[1] && ranked[1].score === top.score;
  title(t('Конец игры', 'Game over'), tie ? t('Ничья!', 'Draw!') : t(`Победитель — ${esc(top.name)}`, `Winner — ${esc(top.name)}`), tie ? t('Делите корону.', 'Share the crown.') : top.genie ? t('Джинн оказался подлее всех. Позор.', 'The Genie was the sneakiest of all. Shame.') : t('Корона уходит сюда. Ещё партию?', 'The crown goes here. Another game?'));
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
