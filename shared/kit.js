// Общее для всех игр: анимации, эффекты, тосты, правила, лобби, хранилище.
import { t } from './i18n.js?v=ui-20261029';
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const EASE = 'cubic-bezier(.2,.8,.2,1)', SPRING = 'cubic-bezier(.34,1.56,.64,1)';
export const still = () => reduceMotion || document.hidden;
// Анимации только декоративные: итоговое состояние всегда задаётся классами/стилями.
export const A = (el, kf, o = {}) => {
  if (!el || still()) return Promise.resolve();
  const opts = { duration: 500, easing: EASE, fill: 'backwards', ...o };
  const anim = el.animate(kf, opts);
  // Браузер может поставить анимации на паузу (окно свёрнуто или перекрыто) — очередь отрисовки их не ждёт.
  return Promise.race([anim.finished.catch(() => {}), new Promise(r => setTimeout(r, opts.duration + (opts.delay || 0) + 150))]);
};
export const wait = ms => new Promise(r => setTimeout(r, still() ? 0 : ms));
export const $ = (sel, root = document) => root.querySelector(sel);
export const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const first = name => (Array.from(name || '?')[0] || '?').toUpperCase();
export const nameOf = (s, id) => s.players.find(p => p.id === id)?.name || '???';
export const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

export const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem('pv.' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('pv.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('pv.' + k); } catch {} },
};
// Один и тот же игрок во всех играх сайта: id живёт в браузере, по нему узнаём после перезагрузки.
export const me = LS.get('me') || { pid: Math.random().toString(36).slice(2, 12), name: '' };
LS.set('me', me);
export const isHostOf = s => s.hostId === me.pid;

/* ---------- effects ---------- */
export function burst(x, y, { chars = ['🔥'], n = 8, spread = 70, up = 130 } = {}) {
  if (still()) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'pt'; s.textContent = chars[i % chars.length]; document.body.append(s);
    const dx = (Math.random() - .5) * spread * 2, dy = -(up * .5 + Math.random() * up), r = (Math.random() - .5) * 120;
    s.animate([
      { transform: `translate(${x}px,${y}px) translate(-50%,-50%) scale(.3)`, opacity: 0 },
      { transform: `translate(${x + dx * .4}px,${y + dy * .4}px) translate(-50%,-50%) scale(1.25)`, opacity: 1, offset: .25 },
      { transform: `translate(${x + dx}px,${y + dy}px) translate(-50%,-50%) rotate(${r}deg) scale(.7)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.finally(() => s.remove());
  }
}
export const burstAt = (el, o) => { if (el) { const [x, y] = center(el); burst(x, y, o); } };
export function confetti(el, n = 70) {
  if (still() || !el) return;
  const [x, y] = center(el);
  const cols = ['#ff4d6d', '#ffc94a', '#7c5cff', '#8ff0b5', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'cf-bit'; s.style.background = cols[i % cols.length]; document.body.append(s);
    const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260, dx = Math.cos(a) * v, dy = Math.sin(a) * v - 160, r = Math.random() * 720 - 360;
    s.animate([
      { transform: `translate(${x}px,${y}px)`, opacity: 1 },
      { transform: `translate(${x + dx}px,${y + dy}px) rotate(${r / 2}deg)`, opacity: 1, offset: .45 },
      { transform: `translate(${x + dx * 1.2}px,${y + dy + 380}px) rotate(${r}deg)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.15,.6,.4,1)', fill: 'forwards' }).finished.finally(() => s.remove());
  }
}
export const shake = (el = $('#stage')) => A(el, [{ transform: 'translate(0)' }, { transform: 'translate(-7px,2px)' }, { transform: 'translate(6px,-2px)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(0)' }], { duration: 380 });
export const nudge = el => A(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 360 });
export function smoke(host, colors = ['rgba(255,201,74,.55)', 'rgba(124,92,255,.6)']) {
  if (still()) return;
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('span');
    const sz = 60 + Math.random() * 80;
    s.className = 'smoke';
    Object.assign(s.style, { width: sz + 'px', height: sz + 'px', left: (20 + Math.random() * 60) + '%', top: (20 + Math.random() * 60) + '%', background: colors[i % colors.length] });
    host.append(s);
    s.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: .9 }, { transform: `translate(calc(-50% + ${(Math.random() - .5) * 160}px),calc(-50% + ${-40 - Math.random() * 90}px)) scale(2.2)`, opacity: 0 }],
      { duration: 1400 + i * 120, easing: EASE, fill: 'forwards' }).finished.finally(() => s.remove());
  }
}
export const enter = root => [...root.querySelectorAll('[data-in]')].forEach((el, k) =>
  A(el, [{ opacity: 0, transform: 'translateY(20px)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 650, delay: 60 + k * 80 }));
export const flyIn = el => A(el, [{ transform: 'translateY(160px) rotate(-14deg) scale(.6)', opacity: 0 }, { transform: 'translateY(-10px) rotate(2deg) scale(1.04)', opacity: 1, offset: .72 }, { transform: 'none', opacity: 1 }], { duration: 720 });
export const flip = inner => A(inner, [{ transform: 'rotateY(0) scale(1)' }, { transform: 'rotateY(-8deg) scale(.94)', offset: .15 }, { transform: 'rotateY(195deg) scale(1.07)', offset: .72 }, { transform: 'rotateY(180deg) scale(1)' }], { duration: 900 });

/* ---------- toast, rules, controls ---------- */
let toastT;
export function toast(msg, ms) {
  const t = $('#toast');
  clearTimeout(toastT);
  const wasHidden = t.hidden;
  t.textContent = msg; t.hidden = false;
  if (wasHidden) A(t, [{ opacity: 0, transform: 'translate(-50%,16px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 350, easing: SPRING });
  if (ms) toastT = setTimeout(hideToast, ms);
}
export const hideToast = () => { clearTimeout(toastT); $('#toast').hidden = true; };

export function openRules() {
  const m = $('#rules'); m.hidden = false;
  A(m, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  A($('.sheet', m), [{ opacity: 0, transform: 'translateY(26px) scale(.95)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 650, easing: SPRING });
  [...m.querySelectorAll('.rc,.score-rule,#rulesOk')].forEach((c, k) => A(c, [{ opacity: 0, transform: 'translateY(18px) rotate(-2deg)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 220 + k * 110, easing: SPRING }));
}
export async function closeRules() {
  await A($('#rules'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
  $('#rules').hidden = true;
}
// Правила при первом заходе в игру, кнопки [data-rules], кнопка «Выйти».
export function initPage(game, net) {
  document.addEventListener('click', e => { if (e.target.closest('[data-rules]')) openRules(); });
  $('#rulesOk').onclick = closeRules;
  $('#rules').onclick = e => { if (e.target.id === 'rules') closeRules(); };
  // подтверждение прямо на кнопке: системный confirm браузер может молча заблокировать
  const exit = $('#exitBtn'); let armed = null;
  exit.onclick = () => {
    if (armed) { clearTimeout(armed); armed = null; exit.textContent = t('Выйти', 'Leave'); net.leave(); return; }
    exit.textContent = net.isHost ? t('Закрыть лобби?', 'Close lobby?') : t('Точно выйти?', 'Really leave?');
    armed = setTimeout(() => { armed = null; exit.textContent = t('Выйти', 'Leave'); }, 3000);
  };
  if (!LS.get(game + '.seenRules')) { LS.set(game + '.seenRules', 1); setTimeout(openRules, 700); }
}

let ctrlSig = null;
// list: [id, label, classes, onClick]
export function setControls(list) {
  const sig = list.map(x => x[0] + x[1]).join('|');
  if (sig === ctrlSig) return;
  ctrlSig = sig;
  const box = $('#controls');
  box.replaceChildren(...list.map(([, label, cls, fn]) => { const el = h(`<button class="btn ${cls}">${label}</button>`); el.onclick = fn; return el; }));
  [...box.children].forEach((el, k) => A(el, [{ opacity: 0, transform: 'translateY(12px) scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: 450, delay: k * 60, easing: SPRING }));
}

/* ---------- home & lobby ---------- */
// Имя + «Создать лобби» / «Войти по коду». hero — HTML левой колонки.
export function buildHome(stage, net, hero) {
  const code = (new URLSearchParams(location.search).get('c') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  stage.append(h(`<section class="home">${hero}
    <div class="panel" data-in>
      <label for="nameIn">${t('Твоё имя', 'Your name')}</label><input class="field" id="nameIn" maxlength="20" placeholder="${t('Как тебя звать?', 'What should we call you?')}" value="${esc(me.name)}">
      <button class="btn primary big" id="createBtn">${t('Создать лобби', 'Create lobby')}</button>
      <div class="or">${t('или войди к друзьям', 'or join your friends')}</div>
      <div class="joinrow"><input class="field" id="codeIn" maxlength="5" placeholder="${t('КОД', 'CODE')}" autocomplete="off" value="${esc(code)}"><button class="btn ghost" id="joinBtn">${t('Войти', 'Join')}</button></div>
      <button class="linkbtn" data-rules>${t('Как играть?', 'How to play?')}</button>
    </div></section>`));
  const title = $('#heroTitle');
  if (title) {
    title.innerHTML = [...title.textContent].map(c => `<span>${esc(c)}</span>`).join('');
    [...title.children].forEach((sp, k) => A(sp, [{ opacity: 0, transform: 'translateY(40px) rotate(8deg)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 200 + k * 70, easing: SPRING }));
  }
  const takeName = () => {
    const v = $('#nameIn').value.replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!v) { nudge($('#nameIn')); $('#nameIn').focus(); return false; }
    me.name = v; LS.set('me', me); return true;
  };
  const join = () => {
    const c = $('#codeIn').value.trim().toUpperCase();
    if (c.length !== 5) { nudge($('#codeIn')); $('#codeIn').focus(); return; }
    if (takeName()) net.join(c);
  };
  $('#createBtn').onclick = () => { if (takeName()) net.host(); };
  $('#joinBtn').onclick = join;
  $('#codeIn').onkeydown = e => { if (e.key === 'Enter') join(); };
  $('#codeIn').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  $('#nameIn').onkeydown = e => { if (e.key === 'Enter') (code ? join() : $('#createBtn').click()); };
  if (code) $('#nameIn').focus();
}

// Код комнаты, ссылка, список игроков. tag(player, state) — подпись под именем.
// onKick(id) — если передан, хост видит у игроков кнопку «выгнать»
export function buildLobby(stage, s, sub, tag, onKick) {
  stage.append(h(`<div class="phase-title" data-in><span class="kicker">${t('Лобби', 'Lobby')}</span><h1>${t('Зови друзей', 'Invite friends')}</h1><p class="sub">${sub}</p></div>`));
  const code = h(`<div class="code" data-in>${[...s.code].map(c => `<span>${c}</span>`).join('')}</div>`);
  stage.append(code);
  [...code.children].forEach((sp, k) => A(sp, [{ opacity: 0, transform: 'translateY(-30px) rotateX(90deg)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 250 + k * 80, easing: SPRING }));
  stage.append(h(`<div class="row" data-in><button class="btn ghost" id="copyBtn">${t('Скопировать ссылку', 'Copy link')}</button></div>`));
  $('#copyBtn').onclick = async () => {
    const url = location.origin + location.pathname + '?c=' + s.code;
    try { await navigator.clipboard.writeText(url); toast(t('Ссылка скопирована — кидай друзьям', 'Link copied — send it to your friends'), 1800); } catch { prompt(t('Скопируй ссылку:', 'Copy the link:'), url); }
  };
  stage.append(h(`<div class="plist" id="plist" data-in></div>`));
  renderPlist(s, tag);
  if (onKick) $('#plist').addEventListener('click', e => {
    const b = e.target.closest('[data-kick]');
    if (!b) return;
    if (b.dataset.armed) onKick(b.dataset.kick);
    else { b.dataset.armed = 1; b.textContent = t('Выгнать?', 'Kick?'); setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '✕'; } }, 3000); }
  });
}
export function renderPlist(s, tag) {
  const box = $('#plist');
  if (!box) return;
  const ids = new Set(s.players.map(x => x.id));
  box.querySelectorAll('[data-id]').forEach(el => {
    if (!ids.has(el.dataset.id)) A(el, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.8)' }], { duration: 250, fill: 'forwards' }).then(() => el.remove());
  });
  for (const pl of s.players) {
    let el = box.querySelector(`[data-id="${CSS.escape(pl.id)}"]`);
    if (!el) {
      el = h(`<div class="pcard-l" data-id="${esc(pl.id)}"></div>`);
      const bot = box.querySelector('.pcard-l.genie');
      if (bot && !pl.genie && !pl.bot) box.insertBefore(el, bot); else box.append(el);
      A(el, [{ opacity: 0, transform: 'translateY(20px) scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 550, easing: SPRING });
    }
    const kick = isHostOf(s) && pl.id !== me.pid && !pl.genie && !pl.bot ? `<button class="kick" data-kick="${esc(pl.id)}" title="${t('Выгнать из лобби', 'Kick from lobby')}">✕</button>` : '';
    el.innerHTML = `<span class="av" style="background:${esc(pl.color)}">${pl.genie ? '✦' : pl.bot ? '💀' : esc(first(pl.name))}</span><span>${pl.id === s.hostId ? '👑 ' : ''}${esc(pl.name)}${pl.id === me.pid ? t(' (ты)', ' (you)') : ''}<small>${tag(pl, s)}</small></span>${kick}`;
    el.classList.toggle('genie', !!(pl.genie || pl.bot)); el.classList.toggle('off', !pl.online);
  }
}
export const seg = (k, label, opts, val, suf, on) => `<div class="set">${label}<div class="seg" data-seg="${k}"><span class="pill"></span>${opts.map(o => `<button data-k="${k}" data-v="${o}" class="${o === val ? 'on' : ''}" ${on ? '' : 'disabled'}>${o}${suf}</button>`).join('')}</div></div>`;
export function placeSegPills() {
  document.querySelectorAll('.seg').forEach(sg => {
    const on = sg.querySelector('button.on'), p = sg.querySelector('.pill');
    if (on) { p.style.left = on.offsetLeft + 'px'; p.style.width = on.offsetWidth + 'px'; }
  });
}
