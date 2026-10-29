// Только просмотренные фрагменты; не подставляем исходник банкноты при отсутствии фото.
export const BANKNOTES = ['RU', 'UA', 'BY', 'MD', 'CZ', 'BO', 'TJ'];
export function banknoteFor(id, currency) {
  const key = currency === 'Евро' ? 'EUR' : BANKNOTES.includes(id) ? id : null;
  return key ? `assets/banknotes/${key}.webp` : null;
}
export function banknoteHTML(id, currency) {
  const src = banknoteFor(id, currency);
  return src ? `<button type="button" class="photo-zoom banknote-zoom" data-zoom aria-label="Увеличить фрагмент банкноты"><img class="evidence-photo banknote-photo" src="${src}" alt="Фрагмент банкноты без названия страны"></button>` : '';
}
