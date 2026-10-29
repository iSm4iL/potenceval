import { t } from '../shared/i18n.js?v=ui-20261029';
// Только просмотренные фрагменты; не подставляем исходник банкноты при отсутствии фото.
export const BANKNOTES = ['RU', 'UA', 'BY', 'MD', 'CZ', 'BO', 'TJ'];
export function banknoteFor(id, currency) {
  const key = currency === 'Евро' ? 'EUR' : BANKNOTES.includes(id) ? id : null;
  return key ? `assets/banknotes/${key}.webp` : null;
}
export function banknoteHTML(id, currency) {
  const src = banknoteFor(id, currency);
  return src ? `<button type="button" class="photo-zoom banknote-zoom" data-zoom aria-label="${t('Увеличить фрагмент банкноты', 'Enlarge banknote fragment')}"><img class="evidence-photo banknote-photo" src="${src}" alt="${t('Фрагмент банкноты без названия страны', 'Banknote fragment with the country name removed')}"></button>` : '';
}
