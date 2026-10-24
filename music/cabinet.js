// Cabinet presentation preserves the game controls and their event handlers.
const stage = document.querySelector('#stage');
const colors = ['#d66b46', '#799e9e', '#c5a25b', '#b58aa7', '#6f9aaa', '#c08a7c', '#9baf87', '#b65c4b'];
// Свой цвет у каждой подборки: им горят лампочка клавиши, яблоко пластинки и подсветка стекла.
const packColors = { 'new-wave': '#ff6a3d', 'ru-rap': '#f2b632', nostalgia: '#39c2d0', kpop: '#b874ff', 'modern-pop': '#4b9bff', 'mom-pop': '#ff7eb3', 'dad-rock': '#8cc152', metal: '#e04848' };
const colorOf = (card, index) => packColors[card.dataset.pack] || colors[index % colors.length];
const bulbs = n => `<span class="bulbs" aria-hidden="true">${'<i></i>'.repeat(n)}</span>`;
// Динамик — только украшение: вместо круглой «кнопки» эквалайзер, который пляшет, пока играет музыка.
const speaker = () => `<div class="cabinet-speaker" aria-hidden="true"><span class="speaker-eq">${'<i></i>'.repeat(28)}</span></div>`;
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
  cabinet.innerHTML = `<div class="cabinet-crown">${bulbs(9)}<div><h1>Полсекунды</h1><p>Выбери пластинку — и угадывай с полсекунды</p></div>${bulbs(9)}</div>
    <div class="cabinet-glass-frame"><span class="tube left" aria-hidden="true"></span><span class="tube right" aria-hidden="true"></span><div class="cabinet-glass"><div class="selection-side left"></div>
      <div class="record-scene"><div class="scene-caption">Ваша пластинка</div><button type="button" class="turntable"><span class="platter" aria-hidden="true"></span><span class="scene-vinyl"><span class="vinyl-spin"><svg class="label-ring" viewBox="0 0 100 100" aria-hidden="true"><path id="labelRing" d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0" fill="none"/><text><textPath href="#labelRing">ПОЛСЕКУНДЫ ★ УГАДАЙ С ПОЛСЕКУНДЫ ★ ПОЛСЕКУНДЫ ★ УГАДАЙ С ПОЛСЕКУНДЫ ★</textPath></text></svg><span class="scene-label"></span></span><span class="label-face"><i class="record-icon"></i><b class="record-title"></b></span></span><span class="tonearm" aria-hidden="true"><i></i></span></button><button type="button" class="scene-play"><span class="scene-play-icon">▶</span><span><b class="ticket-title"></b><small class="ticket-note"></small></span><span class="ticket-code"></span></button></div>
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
    card.style.setProperty('--c', colorOf(card, index));
    const code = document.createElement('span');
    code.className = 'selection-key'; code.innerHTML = `<i></i>${card.dataset.selection}`;
    const icon = document.createElement('span');
    icon.className = 'strip-icon'; icon.setAttribute('aria-hidden', 'true');
    icon.textContent = card.querySelector('.pack-art-icon')?.textContent || '♫';
    card.prepend(code, icon);
    const small = card.querySelector('.pack-meta small');
    if (small) small.textContent = small.textContent.replace(/,\s*/g, ' · ');
    card.insertAdjacentHTML('beforeend', '<span class="strip-eq" aria-hidden="true"><i></i><i></i><i></i></span>');
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
  const color = colorOf(selected, cards.indexOf(selected));
  cabinet.style.setProperty('--sel', color); scene.style.setProperty('--record-label', color);
  cabinet.querySelector('.record-icon').textContent = selected.querySelector('.strip-icon').textContent;
  cabinet.querySelector('.ticket-code').textContent = selected.dataset.selection;
  cabinet.querySelector('.ticket-title').textContent = title;
  cabinet.querySelector('.record-title').textContent = title;
  cabinet.querySelector('.ticket-note').textContent = start.disabled ? status.classList.contains('failed') ? 'Выберите другую подборку или обновите эту' : 'Готовим подборку…' : 'Нажми, чтобы начать';
  record.disabled = start.disabled;
  record.setAttribute('aria-label', `Начать игру: ${title}`);
  if (changed) arrivalStarted = performance.now();
  const arrivalElapsed = performance.now() - arrivalStarted;
  if (arrivalElapsed < 900) {
    scene.classList.add('record-arriving');
    scene.querySelectorAll('.scene-vinyl,.tonearm,.scene-play').forEach(el => el.style.animationDelay = `-${arrivalElapsed}ms`);
  }
  record.onclick = () => {
    playOnEntry = true;
    start.click();
    if (stage.contains(home)) playOnEntry = false;
  };
  const play = cabinet.querySelector('.scene-play');
  play.disabled = start.disabled; play.onclick = record.onclick;
  if (changed) cabinet.classList.add('just-picked');
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

// Пластинки крутятся по инерции: разгоняются, плавно тормозят и не прыгают обратно в исходное положение.
const stillMotion = matchMedia('(prefers-reduced-motion: reduce)');
const spinners = [
  { selector: '.vinyl-spin', base: '', angle: 0, speed: el => el.closest('.turntable:hover:not(:disabled)') ? 170 : 40, kick: el => el.closest('.record-arriving') ? 520 : 0 },
  { selector: '.cabinet-round .jb-record', base: 'translate(-50%, -50%) ', angle: 0, speed: el => el.closest('.is-playing') ? 170 : 0, kick: el => el.closest('.arriving') ? 380 : 0 },
  { selector: '.result-player .vinyl', base: '', angle: -22, speed: el => el.closest('.is-playing') ? 120 : 0, kick: () => 0 },
].map(s => ({ ...s, velocity: 0, el: null }));
let spinClock = performance.now();
function spinFrame(now) {
  const dt = Math.min(0.1, (now - spinClock) / 1000);
  spinClock = now;
  for (const s of spinners) {
    const el = document.querySelector(s.selector);
    if (!el) { s.el = null; continue; }
    if (el !== s.el) { s.el = el; if (!stillMotion.matches) s.velocity = Math.max(s.velocity, s.kick(el)); }
    const target = stillMotion.matches ? 0 : s.speed(el);
    // разгон быстрый, торможение мягкое — как у настоящего диска
    s.velocity += (target - s.velocity) * Math.min(1, dt * (target > s.velocity ? 5 : 1.4));
    if (target === 0 && s.velocity < 1) s.velocity = 0;
    s.angle = (s.angle + s.velocity * dt) % 360;
    el.style.transform = `${s.base}rotate(${s.angle.toFixed(2)}deg)`;
  }
  requestAnimationFrame(spinFrame);
}
requestAnimationFrame(spinFrame);

new MutationObserver(decorate).observe(stage, { childList: true });
await import('./app.js?v=bonus-1');
decorate();
