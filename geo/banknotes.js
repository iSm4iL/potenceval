import { t } from '../shared/i18n.js?v=ui-20261029';
import { CURRENCY_PHOTOS } from './currency-photos.js?v=clues-20261112';

function currencyPhoto(id) {
  return CURRENCY_PHOTOS[id === 'LI' ? 'CH' : id === 'EC' ? 'US' : id];
}

export function banknoteKind(id, currency) {
  if (!currency) return null;
  if (currency === 'Евро') return 'specimen';
  if (currency === 'Фунт стерлингов') return 'fragment';
  const photo = currencyPhoto(id);
  return photo ? photo[1] ? 'historical' : 'photo' : null;
}

export function banknoteFor(id, currency) {
  switch (banknoteKind(id, currency)) {
    case 'specimen': return 'assets/banknotes/EUR-ecb-72dpi.jpg';
    case 'fragment': return 'assets/banknotes/sterling-detail.webp';
    case 'photo':
    case 'historical': return currencyPhoto(id)[0];
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
    photo: t('Изображение валюты', 'Currency image'),
    historical: t('Исторический выпуск', 'Historical issue'),
  }[kind];
  return `<button type="button" class="photo-zoom banknote-zoom" data-zoom aria-label="${t('Увеличить изображение','Enlarge image')} — ${label}"><img class="evidence-photo banknote-photo banknote-${kind}" src="${src}" alt="${label}"></button>`;
}
