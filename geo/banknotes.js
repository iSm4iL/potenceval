import { t } from '../shared/i18n.js?v=ui-20261029';

const CROPS = new Map([['Фунт стерлингов', 'sterling-detail.webp']]);
const TOKEN_MARKS = [
  'M18 26 26 14 34 26 26 38Z M22 26h8',
  'M15 30q5-14 11 0t11 0 M15 22q5-14 11 0t11 0',
  'M17 20 26 15 35 20 35 32 26 37 17 32Z M17 20l9 5 9-5 M26 25v12',
  'M17 32 22 20l4 5 4-5 5 12Z M22 36h8',
  'M26 16v20 M16 26h20 M19 19l14 14 M33 19 19 33',
  'M15 27q11-17 22 0-11 17-22 0Z M26 22v10',
  'M16 34h20 M19 28h14 M22 22h8 M25 16h2',
  'M17 34a9 9 0 0 1 18 0 M20 25a6 6 0 0 1 12 0 M26 15v4',
];

function currencyToken(currency) {
  // Derive the illustration from the displayed clue so shared names reveal no country-specific detail.
  let seed = 2166136261;
  for (const char of currency) seed = Math.imul(seed ^ char.codePointAt(0), 16777619) >>> 0;
  const hue = seed % 360;
  const mark = TOKEN_MARKS[(seed >>> 16) % TOKEN_MARKS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="104" viewBox="0 0 52 52">
    <circle cx="26" cy="28" r="22" fill="hsl(${hue},26%,25%)"/>
    <circle cx="26" cy="25" r="22" fill="hsl(${hue},38%,77%)" stroke="hsl(${hue},28%,28%)"/>
    <circle cx="26" cy="25" r="18.5" fill="none" stroke="hsl(${hue},32%,51%)" stroke-dasharray="1 2"/>
    <circle cx="26" cy="25" r="15.5" fill="hsl(${hue},32%,87%)" stroke="hsl(${hue},28%,53%)"/>
    <path d="${mark}" transform="translate(0 -1)" fill="none" stroke="hsl(${hue},36%,25%)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function banknoteKind(_id, currency) {
  if (!currency) return null;
  if (currency === 'Евро') return 'specimen';
  return CROPS.has(currency) ? 'fragment' : 'illustration';
}

export function banknoteFor(id, currency) {
  switch (banknoteKind(id, currency)) {
    case 'specimen': return 'assets/banknotes/EUR-ecb-72dpi.jpg';
    case 'fragment': return `assets/banknotes/${CROPS.get(currency)}`;
    case 'illustration': return currencyToken(currency);
    default: return null;
  }
}

export function banknoteHTML(id, currency) {
  const src = banknoteFor(id, currency);
  if (!src) return '';
  const kind = banknoteKind(id, currency);
  const label = {
    specimen: t('Образец банкноты', 'Banknote specimen'),
    fragment: t('Фрагмент банкноты', 'Banknote fragment'),
    illustration: t('Игровая иллюстрация валюты', 'Game illustration of the currency'),
  }[kind];
  return `<button type="button" class="photo-zoom banknote-zoom" data-zoom aria-label="${t('Увеличить изображение','Enlarge image')} — ${label}"><img class="evidence-photo banknote-photo banknote-${kind}" src="${src}" alt="${label}"></button>`;
}
