// Cabinet presentation preserves the game controls and their event handlers.
const stage = document.querySelector('#stage');
const colors = ['#d66b46', '#799e9e', '#c5a25b', '#b58aa7', '#6f9aaa', '#c08a7c', '#9baf87', '#b65c4b'];
const speaker = () => '<div class="cabinet-speaker" aria-hidden="true"><span>♪</span></div>';
const pageSize = 8;
let collectionPage = 0, lastSelection = null, playOnEntry = false, arrivalStarted = -Infinity;

function decorateHome(home) {
  home.dataset.cabinet = 'true';
  const cards = [...home.querySelectorAll('[data-pack]')];
  const catalogModes = home.querySelector('.crate-heading .catalog-modes');
  const answerModes = home.querySelector('.answer-mode-picker');
  const rounds = home.querySelector('.setup-actions .setting-label');
  const start = home.querySelector('#startBtn');
  const status = home.querySelector('#packStatus');
  const lineup = home.querySelector('#lineupBtn');
  const artist = home.querySelector('#artistPicker');
  const refresh = home.querySelector('#refreshPack');
  const resume = home.querySelector('.resume-card');
  const cabinet = document.createElement('div');
  cabinet.className = 'cabinet';
  cabinet.innerHTML = `<div class="cabinet-crown"><span class="crown-line"></span><div><h1>Полсекунды</h1><p>Музыку выбираете вы</p></div><span class="crown-line"></span></div>
    <div class="cabinet-glass-frame"><div class="cabinet-glass"><div class="selection-side left"></div>
      <div class="record-scene"><div class="scene-caption">Ваша пластинка</div><button type="button" class="turntable"><span class="platter" aria-hidden="true"></span><span class="scene-vinyl"><span class="scene-label"><span>полсекунды</span><b class="record-title"></b><small>▶ Играть</small></span></span><span class="tonearm" aria-hidden="true"><i></i></span></button><div class="selected-ticket" role="status"><span class="ticket-code"></span><strong class="ticket-title"></strong><small class="ticket-note"></small></div></div>
      <div class="selection-side right"></div></div><nav class="collection-pages" aria-label="Страницы подборок" hidden><button type="button" class="page-back" aria-label="Предыдущие подборки">‹</button><span class="page-position" aria-live="polite"></span><button type="button" class="page-next" aria-label="Следующие подборки">›</button></nav><div class="glass-instruction"><span class="status-lamp"></span>Выберите название, затем нажмите на пластинку</div></div>
    <div class="cabinet-console"><div class="console-banks"><div class="control-bank catalog-bank"><span class="bank-label">Какие песни?</span></div><div class="control-bank answer-bank"></div><div class="control-bank rounds-bank"></div></div><div class="console-start"><div class="console-status"><span class="console-ready">Пластинка выбрана</span></div><div class="ignition"></div></div><div class="console-footer"><div class="collection-tools"></div><span>Один экран. Вся компания.</span></div></div>${speaker()}`;
  const selected = cards.find(card => card.getAttribute('aria-pressed') === 'true') || cards[0];
  const scene = cabinet.querySelector('.record-scene');
  const record = cabinet.querySelector('.turntable');
  const changed = lastSelection !== null && lastSelection !== selected.dataset.pack;
  if (lastSelection !== selected.dataset.pack) collectionPage = Math.floor(cards.indexOf(selected) / pageSize);
  lastSelection = selected.dataset.pack;
  cards.forEach((card, index) => {
    card.dataset.selection = `${index % pageSize < 4 ? 'A' : 'B'}${Math.floor(index / pageSize) * 4 + index % 4 + 1}`;
    card.style.setProperty('--record-label', colors[index % colors.length]);
    const code = document.createElement('span');
    code.className = 'selection-key'; code.textContent = card.dataset.selection;
    card.prepend(code);
    card.querySelector('.pack-meta small')?.remove();
  });
  function showPage(page) {
    collectionPage = Math.max(0, Math.min(page, Math.ceil(cards.length / pageSize) - 1));
    const first = collectionPage * pageSize;
    cabinet.querySelector('.selection-side.left').replaceChildren(...cards.slice(first, first + 4));
    cabinet.querySelector('.selection-side.right').replaceChildren(...cards.slice(first + 4, first + pageSize));
    cabinet.querySelector('.collection-pages').hidden = cards.length <= pageSize;
    cabinet.querySelector('.page-position').textContent = `Страница ${collectionPage + 1} из ${Math.ceil(cards.length / pageSize)}`;
    cabinet.querySelector('.page-back').disabled = collectionPage === 0;
    cabinet.querySelector('.page-next').disabled = first + pageSize >= cards.length;
  }
  cabinet.querySelector('.page-back').onclick = () => showPage(collectionPage - 1);
  cabinet.querySelector('.page-next').onclick = () => showPage(collectionPage + 1);
  showPage(collectionPage);
  const title = selected.querySelector('.pack-meta b').textContent;
  scene.style.setProperty('--record-label', colors[cards.indexOf(selected) % colors.length]);
  cabinet.querySelector('.ticket-code').textContent = selected.dataset.selection;
  cabinet.querySelector('.ticket-title').textContent = title;
  cabinet.querySelector('.record-title').textContent = title;
  cabinet.querySelector('.ticket-note').textContent = start.disabled ? status.classList.contains('failed') ? 'Выберите другую подборку или обновите эту' : 'Готовим подборку…' : 'Нажмите на пластинку, чтобы играть';
  record.disabled = start.disabled;
  record.setAttribute('aria-label', `Начать игру: ${title}`);
  if (changed) arrivalStarted = performance.now();
  const arrivalElapsed = performance.now() - arrivalStarted;
  if (arrivalElapsed < 700) {
    scene.classList.add('record-arriving');
    scene.querySelector('.scene-vinyl').style.animationDelay = `-${arrivalElapsed}ms`;
  }
  record.onclick = () => {
    playOnEntry = true;
    start.click();
    if (stage.contains(home)) playOnEntry = false;
  };
  cabinet.querySelector('.catalog-bank').append(catalogModes);
  cabinet.querySelector('.answer-bank').append(answerModes);
  cabinet.querySelector('.rounds-bank').append(rounds);
  cabinet.querySelector('.console-status').append(status);
  cabinet.querySelector('.ignition').append(start);
  cabinet.querySelector('.collection-tools').append(lineup, artist, refresh);
  if (start.disabled) cabinet.querySelector('.console-ready').textContent = status.classList.contains('failed') ? 'Подборка недоступна' : 'Готовим пластинку';
  if (resume) cabinet.querySelector('.cabinet-console').prepend(resume);
  home.replaceChildren(cabinet);
}

function playFirstSnippet(game) {
  playOnEntry = false;
  const play = game.querySelector('#playBtn'), error = game.querySelector('#audioError');
  if (!play) return;
  const waiting = new MutationObserver(check);
  function check() {
    if (!stage.contains(game) || !error.hidden) waiting.disconnect();
    else if (!play.disabled) { waiting.disconnect(); play.click(); }
  }
  waiting.observe(play, { attributes: true, attributeFilter: ['disabled'] });
  waiting.observe(error, { attributes: true, attributeFilter: ['hidden'] });
  // Returning to the selection screen cancels this one-time playback request.
  waiting.observe(stage, { childList: true });
  check();
}

function decorate() {
  const home = stage.querySelector('.music-home');
  if (home && !home.dataset.cabinet) decorateHome(home);
  const game = stage.querySelector('.game-shell');
  if (game && !game.classList.contains('cabinet-round')) {
    game.classList.add('cabinet-round');
    const sign = document.createElement('div');
    sign.className = 'round-cabinet-sign'; sign.textContent = 'Полсекунды';
    game.prepend(sign);
    game.insertAdjacentHTML('beforeend', speaker());
    const jukebox = game.querySelector('.jukebox');
    if (jukebox) {
      const error = game.querySelector('#audioError');
      jukebox.querySelector('.jb-top').prepend(jukebox.querySelector('.jb-marquee'));
      jukebox.querySelector('.jb-glass').append(error);
      const syncError = () => jukebox.classList.toggle('audio-unavailable', !error.hidden);
      const errorObserver = new MutationObserver(() => {
        if (!stage.contains(game)) errorObserver.disconnect();
        else syncError();
      });
      errorObserver.observe(error, { attributes: true, attributeFilter: ['hidden'] });
      errorObserver.observe(stage, { childList: true });
      syncError();
    }
    if (playOnEntry) playFirstSnippet(game);
  }
}

new MutationObserver(decorate).observe(stage, { childList: true });
await import('./app.js?v=answers-20261023');
decorate();
