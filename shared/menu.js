// Меню-бургер слева: список игр сайта. Подключается на каждой странице.
import './consent.js';
const ROOT = new URL('../', import.meta.url);
export const GAMES = [
  { path: 'genie/', icon: '✦', name: 'Джинн', desc: 'Суперсила с подвохом · 2–8 игроков' },
  { path: 'dice/', icon: '🎲', name: 'Костяшки', desc: 'Кости как в Cult of the Lamb · 1–2 игрока' },
  { path: 'music/', icon: '🎧', name: 'Полсекунды', desc: 'Популярные треки онлайн · один экран на всех' },
];
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden;
const anim = (el, kf, o) => (still() ? null : el.animate(kf, { easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards', ...o }));
const here = path => new URL(path, ROOT).pathname === location.pathname;

const btn = document.createElement('button');
btn.className = 'burger';
btn.setAttribute('aria-label', 'Меню игр');
btn.setAttribute('aria-expanded', 'false');
btn.innerHTML = '<span></span><span></span><span></span>';
document.querySelector('.top')?.prepend(btn);

const link = (path, icon, name, desc) => `<a class="dlink ${here(path) ? 'on' : ''}" href="${new URL(path, ROOT).href}">
  <span class="ic">${icon}</span><span><b>${name}</b><small>${desc}</small></span></a>`;
const drawer = document.createElement('div');
drawer.className = 'drawer';
drawer.hidden = true;
drawer.innerHTML = `<div class="drawer-bg"></div><nav class="drawer-panel" aria-label="Игры">
  <div class="drawer-head"><span class="logo"><b>potenceval</b><span>games</span></span></div>
  ${link('', '🏠', 'Главная', 'Все игры')}
  <div class="dlabel">Игры</div>
  ${GAMES.map(g => link(g.path, g.icon, g.name, g.desc)).join('')}
  <div class="dsoon">Скоро новые игры</div>
  <div class="dlegal"><a href="${new URL('legal/privacy.html', ROOT).href}">Конфиденциальность</a>
  <a href="${new URL('legal/terms.html', ROOT).href}">Соглашение</a>
  <a href="${new URL('legal/privacy.html#contacts', ROOT).href}">Контакты</a></div></nav>`;
document.body.append(drawer);
const panel = drawer.querySelector('.drawer-panel'), bg = drawer.querySelector('.drawer-bg');

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
