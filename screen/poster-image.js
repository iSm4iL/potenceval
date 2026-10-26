export function bindPoster({image, message, retry, credit, candidates, onReady = () => {}}) {
  let index = 0;
  function load() {
    const item = candidates[index];
    image.hidden = false; message.hidden = false; retry.hidden = true;
    message.textContent = 'Загружаем настоящий постер…';
    credit.href = item.source; credit.textContent = item.caption;
    onReady(false); image.src = item.image;
  }
  image.addEventListener('load', () => { message.hidden = true; retry.hidden = true; onReady(true); });
  image.addEventListener('error', () => {
    if (++index < candidates.length) return load();
    image.hidden = true; message.hidden = false; retry.hidden = false;
    message.textContent = 'Постер не загрузился. Проверь подключение или попробуй ещё раз.';
    onReady(false);
  });
  retry.addEventListener('click', () => { index = 0; load(); });
  load();
}
