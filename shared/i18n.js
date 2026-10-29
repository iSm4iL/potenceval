// Язык сайта: ru или en. Выбор запоминается в браузере, по умолчанию — язык браузера.
// В коде: t('Играть', 'Play'). В разметке: <h1 data-en="Play">Играть</h1>.
// Смена языка перезагружает страницу: тексты игр собираются один раз при загрузке.
const KEY = 'pv.lang';
const browser = typeof document !== 'undefined'; // в node-тестах всегда русский
const saved = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
export const lang = saved === 'ru' || saved === 'en' ? saved : browser && !(navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'en' : 'ru';
export const t = (ru, en) => (lang === 'en' ? en : ru);

export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch {}
  location.reload();
}

if (browser) document.documentElement.lang = lang;
if (browser && lang === 'en') for (const el of document.querySelectorAll('[data-en]')) el.innerHTML = el.dataset.en;
