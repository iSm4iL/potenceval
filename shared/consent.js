// Согласие на cookie Метрики и рекламы. Пока METRIKA_ID и ADSENSE пусты, сайт ставит только
// необходимое (localStorage pv.*) — баннер не нужен и не показывается.
// После «Принять» грузятся счётчик и AdSense; до этого никаких запросов к mc.yandex.ru и Google.
const METRIKA_ID = ''; // номер счётчика из metrika.yandex.ru, когда заведёшь
const ADSENSE = 'ca-pub-9572809042176495'; // издатель AdSense; он же в meta на главной и в /ads.txt
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

function loadAds() {
  const s = document.createElement('script');
  s.async = true; s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`;
  document.head.append(s);
}

const load = () => { if (METRIKA_ID) loadMetrika(); if (ADSENSE) loadAds(); };

if (METRIKA_ID || ADSENSE) {
  let v = null; try { v = localStorage.getItem(KEY); } catch {}
  if (v === 'yes') load();
  else if (v !== 'no') {
    const bar = document.createElement('div');
    bar.className = 'consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie');
    const what = [ADSENSE && 'рекламу Google', METRIKA_ID && 'Яндекс Метрику'].filter(Boolean).join(' и ');
    bar.innerHTML = `<p>Мы хотим включить ${what} — это ставит cookie. Без вашего согласия ничего из этого не загружается, игры работают как обычно.
      <a href="${new URL('legal/consent.html', ROOT).href}">Согласие</a> · <a href="${new URL('legal/privacy.html', ROOT).href}">Политика</a></p>
      <div><button data-v="no">Только необходимые</button><button data-v="yes" class="yes">Принять</button></div>`;
    bar.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      remember(b.dataset.v); bar.remove();
      if (b.dataset.v === 'yes') load();
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
    if (/^(_ym|__gads|__gpi|__eoi)/.test(n)) document.cookie = `${n}=; max-age=0; path=/; domain=.${location.hostname}`;
  }
  location.reload();
});
