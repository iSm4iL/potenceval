import { t } from '../shared/i18n.js?v=ui-20261029';
export function bindPoster({image, message, retry, credit, candidates, onReady = () => {}}) {
  let index = 0;
  function load() {
    const item = candidates[index];
    image.hidden = false; message.hidden = false; retry.hidden = true;
    message.textContent = t('Загружаем настоящий постер…', 'Loading the real poster…');
    credit.href = item.source; credit.textContent = item.caption;
    onReady(false); image.src = item.image;
  }
  image.addEventListener('load', () => { message.hidden = true; retry.hidden = true; onReady(true); });
  image.addEventListener('error', () => {
    if (++index < candidates.length) return load();
    image.hidden = true; message.hidden = false; retry.hidden = false;
    message.textContent = t('Постер не загрузился. Проверь подключение или попробуй ещё раз.', 'The poster didn’t load. Check your connection or try again.');
    onReady(false);
  });
  retry.addEventListener('click', () => { index = 0; load(); });
  load();
}
