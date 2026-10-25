// Согласие на cookie Метрики и рекламы. Пока METRIKA_ID пуст, сайт ставит только
// необходимое (localStorage pv.*) — баннер не нужен и не показывается.
// После «Принять» счётчик грузится; до этого никаких запросов к mc.yandex.ru.
const METRIKA_ID = ''; // номер счётчика из metrika.yandex.ru, когда заведёшь
const KEY = 'pv.consent';
const ROOT = new URL('../', import.meta.url);

export const consented = () => { try { return localStorage.getItem(KEY) === 'yes'; } catch { return false; } };
const remember = v => { try { localStorage.setItem(KEY, v); } catch {} };

function loadMetrika() {
  window.ym = window.ym || function () { (ym.a = ym.a || []).push(arguments); };
  ym.l = Date.now();
  const s = document.createElement('script');
  s.async = true; s.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.append(s);
  ym(METRIKA_ID, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
}

if (METRIKA_ID) {
  let v = null; try { v = localStorage.getItem(KEY); } catch {}
  if (v === 'yes') loadMetrika();
  else if (v !== 'no') {
    const bar = document.createElement('div');
    bar.className = 'consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie');
    bar.innerHTML = `<p>Мы хотим включить Яндекс Метрику и рекламу — они ставят cookie. Без вашего согласия они не работают, игры от этого не ломаются.
      <a href="${new URL('legal/consent.html', ROOT).href}">Согласие</a> · <a href="${new URL('legal/privacy.html', ROOT).href}">Политика</a></p>
      <div><button data-v="no">Только необходимые</button><button data-v="yes" class="yes">Принять</button></div>`;
    bar.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      remember(b.dataset.v); bar.remove();
      if (b.dataset.v === 'yes') loadMetrika();
    };
    document.body.append(bar);
  }
}

// Отзыв согласия: ссылка с data-consent-reset (есть на странице политики).
addEventListener('click', e => {
  if (!e.target.closest('[data-consent-reset]')) return;
  e.preventDefault();
  try { localStorage.removeItem(KEY); } catch {}
  for (const c of document.cookie.split(';')) {
    const n = c.split('=')[0].trim();
    if (n.startsWith('_ym')) document.cookie = `${n}=; max-age=0; path=/; domain=.${location.hostname}`;
  }
  location.reload();
});
