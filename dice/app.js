import { createState, reduce, colScore, total, humans, botMove, BOT_ID } from './game.js';
import { A, $, h, esc, first, nameOf, me, isHostOf, still, SPRING, burstAt, confetti, shake, enter,
  setControls, initPage, buildHome, buildLobby, renderPlist } from '../shared/kit.js?v=kick-1';
import { createNet } from '../shared/net.js?v=kick-1';

const stage = $('#stage');
const net = createNet({
  game: 'dice', createState, reduce, reserved: [BOT_ID],
  // Скелет думает полторы секунды, чтобы было видно бросок
  tick: (s, apply) => { if (s.phase === 'play' && s.turn === BOT_ID && Date.now() - s.turnAt > 1500) apply({ type: 'place', col: botMove(s) }, BOT_ID); },
  onState, onLeave: showHome,
});
const send = net.send;

/* ---------- render loop ---------- */
let view = null, rendered = null, shownKey = null, chain = Promise.resolve();
function onState(s) {
  view = s;
  chain = chain.then(() => renderState(s)).catch(e => console.error(e));
}
function showHome() {
  view = null;
  chain = chain.then(() => renderState(null)).catch(e => console.error(e));
}
async function renderState(s) {
  const p = rendered; rendered = s;
  const key = !s ? 'home' : s.phase === 'lobby' ? 'lobby' : 'match:' + s.match;
  $('#room').hidden = !s; $('#exitBtn').hidden = !s;
  if (s) $('#roomCode').textContent = s.code;
  if (key !== shownKey) {
    shownKey = key;
    const old = [...stage.children];
    await Promise.all(old.map((el, k) => A(el, [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-14px) scale(.98)', filter: 'blur(6px)' }], { duration: 240, delay: k * 25, easing: 'ease-in', fill: 'forwards' })));
    stage.replaceChildren();
    (!s ? buildHomeScreen : s.phase === 'lobby' ? buildLobbyScreen : buildMatch)(s);
    enter(stage);
    if (s) window.scrollTo({ top: 0, behavior: still() ? 'auto' : 'smooth' });
  } else if (s?.phase === 'lobby') renderPlist(s, lobbyTag);
  else if (s) await patchMatch(p, s);
  controls(s);
}

function controls(s) {
  const b = [];
  if (s?.phase === 'lobby' && isHostOf(s)) b.push(['start', humans(s).length < 2 ? 'Играть против Скелета' : 'Начать', 'primary ready', () => send({ type: 'start' })]);
  else if (s?.phase === 'over' && isHostOf(s)) b.push(['again', humans(s).length > 2 ? 'Следующая пара' : 'Реванш', 'primary ready', () => send({ type: 'start' })], ['lobby', 'В лобби', 'ghost', () => send({ type: 'lobby' })]);
  setControls(b);
}

/* ---------- home & lobby ---------- */
// у первого игрока кости белые, у второго — чёрные: сразу видно, чьи они
const colorOf = (s, id) => (id === s.duel[1] ? 'black' : '');
const dieHTML = (v, cls = '') => `<div class="die ${cls}" data-v="${v}">${'<i></i>'.repeat(9)}</div>`;
function buildHomeScreen() {
  buildHome(stage, net, `<div class="hero" data-in><span class="kicker">Как в Cult of the Lamb · 1–2 игрока</span>
    <h1 id="heroTitle">Костяшки</h1>
    <p class="sub">Кидай кость в один из трёх столбцов. Одинаковые кости в столбце умножаются, а твоя кость сносит такие же у соперника.</p>
    <div class="dice-field" aria-hidden="true"></div>
    <div class="ritual" aria-label="Пример партии: белые против чёрных">
      <div class="mini-board" data-side="black">${('<div class="mini-col">' + '<span></span>'.repeat(3) + '</div>').repeat(3)}</div>
      <div class="mini-mid"><span class="mini-tray"></span><span class="mini-turn"></span></div>
      <div class="mini-board" data-side="white">${('<div class="mini-col">' + '<span></span>'.repeat(3) + '</div>').repeat(3)}</div>
    </div></div>`);
  demoTable($('.ritual'));
  diceField($('.dice-field'));
}

// Россыпь костей на фоне: разлетаются от курсора, от клика — катятся
function diceField(root) {
  if (!root) return;
  const n = innerWidth < 700 ? 14 : 26, dice = [];
  for (let i = 0; i < n; i++) {
    const el = h(dieHTML(1 + Math.floor(Math.random() * 6), Math.random() < .5 ? 'black' : ''));
    const d = { el, x: Math.random() * 100, y: Math.random() * 100, r: Math.random() * 360, dx: 0, dy: 0, spin: 0 };
    el.style.left = d.x + '%'; el.style.top = d.y + '%';
    root.append(el); dice.push(d);
  }
  const place = d => { d.el.style.transform = `translate(${d.dx}px,${d.dy}px) rotate(${d.r + d.spin}deg)`; };
  dice.forEach(place);
  const onMove = e => {
    if (!root.isConnected) return removeEventListener('pointermove', onMove);
    for (const d of dice) {
      const b = d.el.getBoundingClientRect(), cx = b.left + b.width / 2 - d.dx, cy = b.top + b.height / 2 - d.dy;
      const vx = cx - e.clientX, vy = cy - e.clientY, dist = Math.hypot(vx, vy) || 1;
      const push = dist < 140 ? (140 - dist) * .55 : 0; // ближе к курсору — сильнее отталкиваем
      d.dx = vx / dist * push; d.dy = vy / dist * push; d.spin = push * 1.4; place(d);
    }
  };
  const onClick = e => {
    if (!root.isConnected) return removeEventListener('click', onClick);
    if (e.target.closest('button, input, a, .panel')) return;
    for (const d of dice) {
      const b = d.el.getBoundingClientRect();
      if (Math.hypot(b.left + b.width / 2 - e.clientX, b.top + b.height / 2 - e.clientY) > 220) continue;
      d.r += 180 + Math.random() * 360; d.el.dataset.v = 1 + Math.floor(Math.random() * 6); place(d);
    }
  };
  if (!still()) { addEventListener('pointermove', onMove); addEventListener('click', onClick); }
}

// Живая мини-партия на главной: кости сами бросаются, умножаются и сносят чужие.
async function demoTable(root) {
  const boards = { white: [[], [], []], black: [[], [], []] };
  const mult = (col, v) => ({ 2: 'x2', 3: 'x3' })[col.filter(x => x === v).length] || '';
  const draw = () => {
    for (const side of ['white', 'black']) root.querySelectorAll(`[data-side="${side}"] .mini-col`).forEach((el, c) => {
      const col = boards[side][c];
      // у чёрных кости растут от центра вверх, у белых — от центра вниз
      [...el.children].forEach((cell, i) => {
        const v = col[side === 'black' ? 2 - i : i];
        const want = v ? v + mult(col, v) : '';
        if (cell.dataset.k !== want) { cell.dataset.k = want; cell.innerHTML = v ? dieHTML(v, `${mult(col, v)} ${side === 'black' ? 'black' : ''}`) : ''; }
      });
    });
  };
  const tray = $('.mini-tray', root), turnEl = $('.mini-turn', root), wait = ms => new Promise(r => setTimeout(r, still() ? 0 : ms));
  for (let turn = 0; root.isConnected; turn++) {
    const side = turn % 2 ? 'black' : 'white', other = side === 'white' ? 'black' : 'white';
    const v = 1 + Math.floor(Math.random() * 6), mine = boards[side], theirs = boards[other];
    turnEl.textContent = side === 'white' ? 'ход белых' : 'ход чёрных';
    tray.innerHTML = dieHTML(v, side === 'black' ? 'black' : '');
    const d = $('.die', tray);
    if (!still()) {
      A(d, [{ transform: 'translateY(-26px) rotate(-200deg) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, easing: SPRING });
      for (let k = 0; k < 6; k++) { d.dataset.v = 1 + Math.floor(Math.random() * 6); await wait(70); }
      d.dataset.v = v;
    }
    await wait(500);
    // ход «с умом»: сначала снести чужие такие же, потом собрать пару, иначе куда есть место
    const free = [0, 1, 2].filter(c => mine[c].length < 3);
    const c = free.find(i => theirs[i].includes(v)) ?? free.find(i => mine[i].includes(v)) ?? free[Math.floor(Math.random() * free.length)];
    mine[c].push(v);
    tray.innerHTML = '';
    const hit = theirs[c].includes(v);
    if (hit) root.querySelectorAll(`[data-side="${other}"] .mini-col`)[c].querySelectorAll(`.die[data-v="${v}"]`).forEach(x => x.classList.add('doomed'));
    draw();
    const n = mine[c].length - 1, placed = root.querySelectorAll(`[data-side="${side}"] .mini-col`)[c].children[side === 'black' ? 2 - n : n]?.firstElementChild;
    A(placed, [{ transform: `translateX(${side === 'black' ? -30 : 30}px) scale(1.3)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: SPRING });
    if (hit) {
      await wait(450);
      root.querySelectorAll(`[data-side="${other}"] .mini-col`)[c].querySelectorAll(`.die[data-v="${v}"]`).forEach(x => burstAt(x, { chars: ['💥', '🦴'], n: 5, spread: 40, up: 50 }));
      boards[other][c] = theirs[c].filter(x => x !== v);
      draw();
    }
    await wait(900);
    if (mine.every(col => col.length === 3)) { // поле заполнено — новая партия
      await wait(800);
      boards.white = [[], [], []]; boards.black = [[], [], []]; draw();
    }
  }
}
const lobbyTag = (pl, s) => {
  if (!pl.online) return 'отключился';
  const i = humans(s).findIndex(x => x.id === pl.id);
  return (pl.id === s.hostId ? 'хост · ' : '') + (i < 2 ? 'играет' : `в очереди #${i - 1}`);
};
function buildLobbyScreen(s) {
  buildLobby(stage, s, 'Играют двое: хост и первый, кто зайдёт. Если вас больше — проигравший уступает место следующему. Один — сыграешь со Скелетом.', lobbyTag, id => send({ type: 'kick', id }));
  if (!isHostOf(s)) stage.append(h(`<p class="wait" data-in>Ждём, пока <b>${esc(nameOf(s, s.hostId))}</b> начнёт <span class="dots"><i></i><i></i><i></i></span></p>`));
}

/* ---------- match ---------- */
const seats = s => { const [a, b] = s.duel; const bottom = s.duel.includes(me.pid) ? me.pid : a; return [bottom, bottom === a ? b : a]; };
const mult = (col, v) => ({ 2: 'x2', 3: 'x3' })[col.filter(x => x === v).length] || '';
const sideEl = id => stage.querySelector(`[data-side="${CSS.escape(id)}"]`);
const colEl = (id, c) => sideEl(id)?.querySelector(`.col[data-col="${c}"]`);

function sideHTML(s, id, pos) {
  const pl = s.players.find(p => p.id === id) || { name: '???', color: '#555' };
  const head = `<div class="head"><span class="av" style="background:${esc(pl.color)}">${pl.bot ? '💀' : esc(first(pl.name))}</span>
    <span class="nm">${id === s.hostId ? '👑 ' : ''}${esc(pl.name)}${id === me.pid ? ' (ты)' : ''}<small>${pl.bot ? 'бот · ' : pos === 'up' ? 'соперник · ' : ''}${colorOf(s, id) ? 'чёрные кости' : 'белые кости'}</small></span><span class="tot" data-tot>0</span></div>`;
  const board = `<div class="board">${[0, 1, 2].map(c => `<div class="col" data-col="${c}" role="button" aria-label="Столбец ${c + 1}">${'<div class="cell"></div>'.repeat(3)}</div>`).join('')}</div>`;
  const scores = `<div class="scores" data-scores><span>0</span><span>0</span><span>0</span></div>`;
  return `<div class="side ${pos}" data-side="${esc(id)}">${pos === 'up' ? head + board + scores : scores + board + head}</div>`;
}
function buildMatch(s) {
  const [bottom, top] = seats(s);
  stage.append(h(`<div class="duel" data-in><div class="series" id="series"></div>${sideHTML(s, top, 'up')}
    <div class="mid"><div class="tray" id="tray"></div><div class="turn" id="turn"></div></div>${sideHTML(s, bottom, 'down')}</div>`));
  if (!s.duel.includes(me.pid)) stage.append(h(`<p class="wait" data-in>Ты смотришь. Проигравший уступит место следующему в очереди.</p>`));
  const mine = sideEl(bottom);
  mine.querySelectorAll('.col').forEach(col => {
    const c = +col.dataset.col;
    col.onclick = () => place(c);
    col.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); place(c); } };
    col.onmouseenter = () => preview(c);
    col.onmouseleave = clearPreview;
  });
  renderBoards(s, false);
  renderMid(s, true);
  renderSeries(s);
  if (s.phase === 'over') showResult(s, false);
}
const canPlace = (s, c) => s?.phase === 'play' && s.turn === me.pid && s.boards[me.pid][c].length < 3;
function place(c) {
  if (!canPlace(view, c)) return;
  clearPreview();
  send({ type: 'place', col: c });
}
// Наведение: призрак кости в столбце и красная тряска костей соперника, которые она снесёт.
function preview(c) {
  clearPreview();
  const s = view;
  if (!canPlace(s, c)) return;
  const [, top] = seats(s);
  const cell = colEl(me.pid, c).children[s.boards[me.pid][c].length];
  cell.innerHTML = dieHTML(s.die, 'ghost ' + colorOf(s, me.pid));
  colEl(top, c).querySelectorAll('.die').forEach(d => { if (+d.dataset.v === s.die) d.classList.add('doomed'); });
}
function clearPreview() {
  stage.querySelectorAll('.die.ghost').forEach(d => { d.parentElement.dataset.k = ''; d.remove(); });
  stage.querySelectorAll('.die.doomed').forEach(d => d.classList.remove('doomed'));
}

function setNum(el, n, bump) {
  if (!el || el.textContent === String(n)) return;
  el.textContent = n;
  if (bump) A(el, [{ transform: 'scale(1.45)', color: '#ffc94a' }, { transform: 'none' }], { duration: 550, easing: SPRING });
}
// nums=false — только кости (очки обновим после приземления, с подпрыгиванием)
function renderBoards(s, bump, nums = true) {
  const myTurn = s.phase === 'play' && s.turn === me.pid;
  for (const id of s.duel) {
    const side = sideEl(id);
    if (!side) continue;
    s.boards[id].forEach((col, c) => {
      const el = colEl(id, c);
      [...el.children].forEach((cell, i) => {
        const v = col[i], k = v ? v + mult(col, v) : '';
        if (cell.dataset.k !== k) { cell.dataset.k = k; cell.innerHTML = v ? dieHTML(v, mult(col, v) + ' ' + colorOf(s, id)) : ''; }
      });
      const can = id === me.pid && myTurn && col.length < 3;
      el.classList.toggle('can', can);
      el.tabIndex = can ? 0 : -1;
      if (nums) setNum($('[data-scores]', side).children[c], colScore(col), bump);
    });
    if (nums) setNum($('[data-tot]', side), total(s.boards[id]), bump);
    side.classList.toggle('active', s.turn === id);
  }
}
async function rollAnim(die, v) {
  if (still()) return;
  A(die, [{ transform: 'translateY(-46px) rotate(-220deg) scale(.5)', opacity: 0 }, { transform: 'translateY(6px) rotate(15deg) scale(1.12)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 720, easing: SPRING });
  for (let k = 0; k < 7; k++) { die.dataset.v = 1 + Math.floor(Math.random() * 6); await new Promise(r => setTimeout(r, 75)); }
  die.dataset.v = v;
}
function renderMid(s, anim) {
  const tray = $('#tray'), t = $('#turn');
  if (!tray) return;
  if (s.phase !== 'play') { tray.replaceChildren(); t.innerHTML = ''; return; }
  const [, top] = seats(s);
  tray.innerHTML = dieHTML(s.die, colorOf(s, s.turn));
  t.innerHTML = s.turn === me.pid
    ? '<span class="arrow">▼</span> <b>Твой ход.</b><br>Выбери столбец'
    : `<span class="arrow">${s.turn === top ? '▲' : '▼'}</span> Ходит <b>${esc(nameOf(s, s.turn))}</b>${s.turn === BOT_ID ? '<br>трясёт кость…' : ''}`;
  if (s.lastCall) t.innerHTML += '<br><b class="last-call">Последний ход!</b>'; // соперник уже заполнил поле
  if (!anim) return;
  rollAnim($('.die', tray), s.die);
  A(t, [{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 400 });
}
function renderSeries(s) {
  const el = $('#series'), [a, b] = s.duel;
  const wa = s.wins[a] || 0, wb = s.wins[b] || 0;
  el.innerHTML = wa + wb ? `Серия: ${esc(nameOf(s, a))} <b>${wa} : ${wb}</b> ${esc(nameOf(s, b))}` : `Партия ${s.match}`;
}

// Кость летит из лотка в столбец, одинаковые кости соперника разлетаются, оставшиеся съезжают к центру.
async function animateMove(s) {
  const { by, col, value } = s.last;
  const opp = s.duel.find(x => x !== by);
  const trayDie = $('#tray .die'), from = trayDie?.getBoundingClientRect();
  const oppCol = colEl(opp, col);
  const old = [...oppCol.querySelectorAll('.die:not(.ghost)')];
  const doomed = old.filter(d => +d.dataset.v === value), survivors = old.filter(d => +d.dataset.v !== value);
  const survRects = survivors.map(d => d.getBoundingClientRect());
  const ghosts = still() ? [] : doomed.map(d => {
    const r = d.getBoundingClientRect(), g = d.cloneNode(true);
    g.classList.remove('doomed'); g.classList.add('ghost-die');
    Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.append(g);
    return g;
  });
  if (trayDie) trayDie.style.visibility = 'hidden';
  clearPreview();
  renderBoards(s, false, false);

  const mineCol = colEl(by, col);
  const placed = mineCol.children[s.boards[by][col].length - 1]?.querySelector('.die');
  if (placed && from && !still()) {
    const to = placed.getBoundingClientRect();
    await A(placed, [{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px) rotate(-120deg) scale(1.15)` }, { transform: 'translateY(-8px) scale(1.12)', offset: .75 }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' });
  }
  A(mineCol, [{ transform: 'translateY(0)' }, { transform: 'translateY(5px)' }, { transform: 'none' }], { duration: 260 });
  const same = [...mineCol.querySelectorAll('.die')].filter(d => +d.dataset.v === value);
  if (same.length > 1) {
    same.forEach(d => A(d, [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'none' }], { duration: 520, easing: SPRING }));
    burstAt(placed, { chars: ['✨', '×' + same.length], n: 8, spread: 80, up: 110 });
  } else burstAt(placed, { chars: ['✦'], n: 4, spread: 40, up: 50 });
  renderBoards(s, true);

  if (ghosts.length) {
    ghosts.forEach(g => burstAt(g, { chars: ['💥', '🦴'], n: 8, spread: 90, up: 100 }));
    shake();
    const newDice = [...oppCol.querySelectorAll('.die')];
    newDice.forEach((d, i) => {
      const r = survRects[i], n = d.getBoundingClientRect();
      if (r) A(d, [{ transform: `translate(${r.left - n.left}px,${r.top - n.top}px)` }, { transform: 'none' }], { duration: 450, delay: 520, easing: SPRING });
    });
    await Promise.all(ghosts.map((g, k) => A(g, [
      { transform: 'none' }, { transform: 'rotate(-12deg) scale(1.12)', offset: .2 }, { transform: 'rotate(12deg) scale(1.18)', offset: .4 },
      { transform: `translate(${(k - (ghosts.length - 1) / 2) * 60}px,-140px) rotate(${200 + k * 50}deg) scale(.3)`, opacity: 0 },
    ], { duration: 700, fill: 'forwards', easing: 'cubic-bezier(.5,0,.7,.4)' })));
  }
  ghosts.forEach(g => g.remove());
}
async function patchMatch(p, s) {
  if (s.last && s.last.seq !== p.last?.seq) await animateMove(s);
  else renderBoards(s, true);
  renderMid(s, s.turn !== p.turn || s.die !== p.die);
  renderSeries(s);
  if (s.phase === 'over' && p.phase !== 'over') showResult(s, true);
}
function showResult(s, anim) {
  const [bottom, top] = seats(s), w = s.winner, playing = s.duel.includes(me.pid);
  const title = w === 'draw' ? 'Ничья!' : playing ? (w === me.pid ? 'Победа!' : 'Поражение') : `${esc(nameOf(s, w))} забирает партию`;
  const box = $('.mid'); // итог — в центре, на месте лотка с костью
  box.replaceChildren(h(`<div class="result"><h2>${title}</h2>
    <p>${esc(nameOf(s, bottom))} <b>${total(s.boards[bottom])}</b> : <b>${total(s.boards[top])}</b> ${esc(nameOf(s, top))}</p></div>`));
  if (!anim) return;
  A(box.firstElementChild, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 300, easing: SPRING });
  if (w === 'draw') return;
  const winSide = sideEl(w);
  setTimeout(() => {
    if (playing && w !== me.pid) burstAt(box.firstElementChild, { chars: ['💀', '🦴'], n: 12, spread: 140, up: 120 });
    else confetti(winSide, 90);
  }, 500);
}

/* ---------- boot ---------- */
initPage('dice', net);
if (!net.resume()) showHome();
