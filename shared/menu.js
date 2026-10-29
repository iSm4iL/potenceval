// Меню-бургер слева: список игр сайта. Подключается на каждой странице.
import './consent.js';
import { lang, t, setLang } from './i18n.js';
const ROOT = new URL('../', import.meta.url);
// Порядок = порядок на главной: сначала три основные игры.
export const GAMES = [
  { path: 'music/', icon: '🎧', name: t('Полсекунды', 'Half a Second'), desc: t('Угадай музыку · один экран или лобби', 'Guess the song · one screen or lobby') },
  { path: 'geo/', icon: '🕵️', name: t('Угадай страну', 'Guess the Country'), desc: t('Детективная доска с уликами · 1–4 игрока', 'A detective board of clues · 1–4 players') },
  { path: 'opening/', icon: '✷', name: t('Угадай опенинг', 'Name That Opening'), desc: t('Аниме, кино, сериалы и мультфильмы по музыке', 'Anime, movies, shows and cartoons by their music') },
  { path: 'where/', icon: '📍', name: t('Где я?', 'Where Am I?'), desc: t('Как GeoGuessr · один или с друзьями', 'Like GeoGuessr · solo or with friends') },
  { path: 'screen/', icon: '🎬', name: t('До титров', 'Before the Credits'), desc: t('Угадай кино, сериал, аниме или мультфильм', 'Guess the movie, show, anime or cartoon') },
  { path: 'genie/', icon: '✦', name: t('Джинн', 'Genie'), desc: t('Суперсила с подвохом · 2–8 игроков', 'A superpower with a catch · 2–8 players') },
  { path: 'dice/', icon: '🎲', name: t('Костяшки', 'Knucklebones'), desc: t('Кости как в Cult of the Lamb · 1–2 игрока', 'Dice like in Cult of the Lamb · 1–2 players') },
  { path: 'rap/', icon: '🎙', name: t('Биты', 'Beats'), desc: t('Звуковая мастерская · слушать и сохранять', 'Beat workshop · listen and save') },
];
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden;
const anim = (el, kf, o) => (still() ? null : el.animate(kf, { easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards', ...o }));
const here = path => new URL(path, ROOT).pathname === location.pathname;

const btn = document.createElement('button');
btn.className = 'burger';
btn.setAttribute('aria-label', t('Меню игр', 'Games menu'));
btn.setAttribute('aria-expanded', 'false');
btn.innerHTML = '<span></span><span></span><span></span>';
const top = document.querySelector('.top');
top?.prepend(btn);

// В игре шапка — меню, «potenceval» (на главную) и название игры (на её первый экран);
// кнопки игры (правила, выход, код комнаты) уезжают в меню.
const game = GAMES.find(g => here(g.path)), tools = document.querySelector('.top .top-right');
const logo = document.querySelector('.top .logo');
if (game && logo) {
  const box = document.createElement('div');
  box.className = logo.className;
  box.innerHTML = `<a href="${ROOT.href}"><b>potenceval</b></a><a href="${new URL(game.path, ROOT).href}"><span>${game.name}</span></a>`;
  box.addEventListener('click', e => { if (!e.target.closest('a')) location.href = ROOT.href; }); // значок слева от надписи
  logo.replaceWith(box);
}

// Переключатель языка — справа в шапке.
const langs = document.createElement('div');
langs.className = 'lang';
langs.setAttribute('role', 'group');
langs.setAttribute('aria-label', t('Язык', 'Language'));
langs.innerHTML = ['ru', 'en'].map(l => `<button data-l="${l}" aria-pressed="${l === lang}">${l.toUpperCase()}</button>`).join('');
langs.onclick = e => { const l = e.target.closest('button')?.dataset.l; if (l && l !== lang) setLang(l); };
top?.append(langs);

const link = (path, icon, name, desc) => `<a class="dlink ${here(path) ? 'on' : ''}" href="${new URL(path, ROOT).href}">
  <span class="ic">${icon}</span><span><b>${name}</b><small>${desc}</small></span></a>`;
const drawer = document.createElement('div');
drawer.className = 'drawer';
drawer.hidden = true;
drawer.innerHTML = `<div class="drawer-bg"></div><nav class="drawer-panel" aria-label="${t('Игры', 'Games')}">
  <div class="drawer-head"><span class="logo"><b>potenceval</b><span>games</span></span></div>
  ${tools ? `<div class="dgame"><div class="dlabel">${game?.name || t('Эта игра', 'This game')}</div><div class="dtools"></div></div>` : ''}
  ${link('', '🏠', t('Главная', 'Home'), t('Все игры', 'All games'))}
  <div class="dlabel">${t('Игры', 'Games')}</div>
  ${GAMES.map(g => link(g.path, g.icon, g.name, g.desc)).join('')}
  <div class="dsoon">${t('Скоро новые игры', 'More games soon')}</div>
  <div class="dlegal"><a href="${new URL('legal/privacy.html', ROOT).href}">${t('Конфиденциальность', 'Privacy')}</a>
  <a href="${new URL('legal/terms.html', ROOT).href}">${t('Соглашение', 'Terms')}</a>
  <a href="${new URL('legal/privacy.html#contacts', ROOT).href}">${t('Контакты', 'Contacts')}</a></div></nav>`;
document.body.append(drawer);
const panel = drawer.querySelector('.drawer-panel'), bg = drawer.querySelector('.drawer-bg');
if (tools) {
  const box = drawer.querySelector('.dtools');
  box.append(...tools.children);
  tools.remove();
  // нажал «Правила» — меню прячется; «Выйти» сначала переспрашивает («Точно выйти?») — тогда ждём второго нажатия
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) setTimeout(() => { if (!b.textContent.trim().endsWith('?')) close(); });
  });
}

function open() {
  drawer.hidden = false;
  btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
  anim(bg, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: 'ease-out' });
  anim(panel, [{ transform: 'translateX(-105%)' }, { transform: 'none' }], { duration: 550 });
  [...panel.children].forEach((el, k) => anim(el, [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 120 + k * 60 }));
  panel.querySelector('.dlink')?.focus({ preventScroll: true });
}
async function close() {
  if (drawer.hidden) return;
  btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
  const a = anim(panel, [{ transform: 'none' }, { transform: 'translateX(-105%)' }], { duration: 280, easing: 'ease-in', fill: 'forwards' });
  anim(bg, [{ opacity: 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' });
  await Promise.race([a?.finished, new Promise(r => setTimeout(r, 330))]);
  drawer.hidden = true;
  panel.getAnimations().forEach(x => x.cancel()); bg.getAnimations().forEach(x => x.cancel());
}
btn.onclick = () => (drawer.hidden ? open() : close());
bg.onclick = close;
addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
panel.addEventListener('click', e => { if (e.target.closest('.dlink.on')) { e.preventDefault(); close(); } });
