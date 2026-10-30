import { t } from '../shared/i18n.js?v=ui-20261029';
import { esc } from '../shared/kit.js';
import { recordArt, shelfPage, selectionPage } from './record-store-model.js?v=locale-20261029';

const stage = document.querySelector('#stage');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const colors = { 'new-wave': '#ef613b', 'ru-rap': '#b5a181', nostalgia: '#e287ce', kpop: '#b68aef', 'modern-pop': '#73b3de', 'mom-pop': '#ffd0ba', 'dad-rock': '#e6c68b', metal: '#df7067', 'us-hiphop': '#e4aa67', soundcloud: '#b8a3ef', 'dead-inside': '#c9c3d6' , drill: '#9fb3c8', hookah: '#c9a77c' };
let page = 0, selectedId = null, lastTitle = t('Новая школа', "New school"), playOnEntry = false;
let restoreFocus = null;

const sign = () => `<h1 class="store-sign"><span class="visually-hidden">${t("Полсекунды", "Half a Second")}</span><svg viewBox="0 0 800 155" aria-hidden="true"><g class="neon-tubes"><text class="neon-halo" x="400" y="111" text-anchor="middle">${t("Полсекунды", "Half a Second")}</text><text class="neon-tube" x="400" y="111" text-anchor="middle">${t("Полсекунды", "Half a Second")}</text><text class="neon-core" x="400" y="111" text-anchor="middle">${t("Полсекунды", "Half a Second")}</text><path class="neon-underline" d="M171 139 Q405 123 636 128"/></g></svg></h1>`;

function deck(title, artId, home = false) {
  return `<div class="store-deck${home ? ' home-deck' : ''}" style="--label-art:url('${recordArt(artId)}');--label-color:${colors[artId] || '#f2b85b'}">
    <img class="deck-body" src="assets/record-store/turntable-body.webp" alt="" draggable="false">
    <div class="deck-vinyl" aria-hidden="true"><div class="disc-spinning"><div class="disc-label"><span>${esc(title)}</span><small>${t("Полсекунды", "Half a Second")}</small></div></div><span class="disc-reflection"></span><i class="disc-spindle"></i></div>
    <img class="deck-arm" src="assets/record-store/tonearm.webp" alt="" draggable="false">
    ${home ? `<button type="button" class="deck-trigger" aria-label="${t("Начать игру", "Start game")}: ${esc(title)}"><span>▶</span></button>` : ''}
  </div>`;
}

function decorateHome(home) {
  home.dataset.store = 'true';
  const cards = [...home.querySelectorAll('[data-pack]')];
  const items = cards.map(card => ({ id: card.dataset.pack, card }));
  const selected = cards.find(card => card.getAttribute('aria-pressed') === 'true') || cards[0];
  const id = selected.dataset.pack;
  page = selectionPage(items, id, selectedId, page);
  const changed = selectedId !== null && selectedId !== id;
  selectedId = id;
  const title = selected.querySelector('.pack-meta b').textContent;
  lastTitle = title;
  const controls = {
    catalog: home.querySelector('.crate-heading .catalog-modes'),
    answer: home.querySelector('.answer-mode-picker'),
    rounds: home.querySelector('.setup-actions .setting-label'),
    start: home.querySelector('#startBtn'), friends: home.querySelector('#friendsBtn'), status: home.querySelector('#packStatus'),
    lineup: home.querySelector('#lineupBtn'), artist: home.querySelector('#artistPicker'),
    refresh: home.querySelector('#refreshPack'), resume: home.querySelector('.resume-card'),
  };
  const shop = document.createElement('div');
  shop.className = 'record-shop';
  shop.innerHTML = `<div class="store-masthead">${sign()}<p>${t("Хорошая музыка. Хорошая компания. Угадаешь с полсекунды?", "Good music. Good company. Can you name it in half a second?")}</p></div>
    <div class="shop-layout"><section class="record-crate" aria-label="${t("Выбор музыкальной подборки", "Choose a music collection")}">
      <div class="crate-back" aria-hidden="true"></div><div class="sleeve-grid"></div>
      <div class="crate-lip"><span class="crate-stamp">${t("Музыка", "Music")}<br>${t("объединяет", "brings us together")}</span><nav class="shelf-navigation" aria-label="${t("Страницы подборок", "Collection pages")}"><button type="button" class="shelf-prev" aria-label="${t("Предыдущие подборки", "Previous collections")}">←</button><span class="shelf-position" aria-live="polite" aria-atomic="true"></span><button type="button" class="shelf-next" aria-label="${t("Следующие подборки", "Next collections")}">→</button></nav><span class="crate-note">${t("Найди свою", "Find your")}<br>${t("пластинку", "record")} ♡</span></div>
      <p class="shelf-caption">${t("Выбери обложку, а потом нажми «Играть».", "Pick a cover, then press Play.")}</p></section>
    <aside class="shop-counter"><div class="counter-player${changed ? ' record-changed' : ''}">${deck(title, id, true)}</div>
      <div class="store-start"></div><div class="store-settings"><div class="store-catalog"><span class="store-setting-title">${t("Какие песни?", "Which songs?")}</span></div><div class="store-answer"></div><div class="store-rounds"></div></div>
      <div class="store-status"></div><div class="store-tools"></div></aside></div><div class="store-resume"></div>`;
  cards.forEach(card => {
    const cardTitle = card.querySelector('.pack-meta b').textContent;
    const description = card.querySelector('.pack-meta small').textContent;
    card.setAttribute('aria-label', cardTitle);
    card.title = description;
    card.innerHTML = `<span class="sleeve-disc" aria-hidden="true"></span><span class="sleeve-cover"><img src="${recordArt(card.dataset.pack)}" alt="" draggable="false"><span class="sleeve-lettering" style="--letter-color:${colors[card.dataset.pack] || '#ffe3c4'}">${esc(cardTitle)}</span><span class="sleeve-mark">${t("Полсекунды · коллекция", "Half a Second · collection")}</span></span><span class="sleeve-chosen" aria-hidden="true">${t("Выбрано ✓", "Selected ✓")}</span>`;
  });
  let turning = false;
  const grid = shop.querySelector('.sleeve-grid');
  function showPage(requested, animate = false, direction = 1) {
    if (turning) return;
    const next = shelfPage(items, requested);
    page = next.page;
    const replace = () => {
      if (!stage.contains(home)) return;
      grid.replaceChildren(...next.items.map(({ card }, index) => { card.style.setProperty('--arrival', `${index * 36}ms`); return card; }));
      grid.classList.remove('sleeves-leaving');
      grid.classList.toggle('sleeves-arriving', animate && !reducedMotion.matches);
      shop.querySelector('.shelf-position').textContent = `${next.page + 1} / ${next.pages}`;
      const prev = shop.querySelector('.shelf-prev'), forward = shop.querySelector('.shelf-next');
      prev.disabled = !next.previous; forward.disabled = !next.next;
      if (animate) (direction > 0 ? (next.next ? forward : prev) : (next.previous ? prev : forward)).focus({ preventScroll: true });
      turning = false;
    };
    if (animate && !reducedMotion.matches) {
      turning = true;
      grid.classList.remove('sleeves-arriving');
      grid.classList.add('sleeves-leaving');
      grid.style.setProperty('--page-direction', direction);
      setTimeout(replace, 190);
    } else replace();
  }
  shop.querySelector('.shelf-prev').onclick = () => showPage(page - 1, true, -1);
  shop.querySelector('.shelf-next').onclick = () => showPage(page + 1, true, 1);
  shop.querySelector('.store-catalog').append(controls.catalog);
  shop.querySelector('.store-answer').append(controls.answer);
  shop.querySelector('.store-rounds').append(controls.rounds);
  shop.querySelector('.store-start').append(controls.start, controls.friends);
  shop.querySelector('.store-status').append(controls.status);
  shop.querySelector('.store-tools').append(controls.lineup, controls.artist, controls.refresh);
  if (controls.resume) shop.querySelector('.store-resume').append(controls.resume);
  controls.start.textContent = controls.start.disabled ? controls.status.classList.contains('failed') ? t('Выбери другую подборку', "Choose another collection") : t('Собираем треки…', "Loading tracks…") : t('▶  Играть', "▶  Play");
  const trigger = shop.querySelector('.deck-trigger');
  trigger.disabled = controls.start.disabled;
  trigger.onclick = () => controls.start.click();
  controls.start.addEventListener('click', () => { playOnEntry = true; }, { capture: true });
  home.replaceChildren(shop);
  showPage(page);
  // на телефоне обложки занимают весь экран: выбрал — сами съезжаем к вертушке и «Играть»
  if (changed && matchMedia('(max-width:600px)').matches) shop.querySelector('.counter-player').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (restoreFocus) {
    const target = [...home.querySelectorAll('button')].find(button => !button.disabled && (restoreFocus.id ? button.id === restoreFocus.id : restoreFocus.shelf ? button.classList.contains(restoreFocus.shelf) : button.dataset[restoreFocus.key] === restoreFocus.value));
    if (!document.querySelector('dialog[open]')) target?.focus({ preventScroll: true });
    restoreFocus = null;
  }
}

// Read the actual focus immediately before replacement, including late catalog updates.
stage.addEventListener('music:before-setup', () => {
  restoreFocus = null;
  const button = document.activeElement?.closest('button');
  if (!button || !stage.contains(button)) return;
  const key = ['pack', 'mode', 'answerMode', 'rounds'].find(name => name in button.dataset);
  if (key) restoreFocus = { key, value: button.dataset[key] };
  else if (button.id) restoreFocus = { id: button.id };
  else if (button.matches('.shelf-prev,.shelf-next')) restoreFocus = { shelf: button.matches('.shelf-prev') ? 'shelf-prev' : 'shelf-next' };
});

function decorateGame(game) {
  game.dataset.store = 'true';
  const jukebox = game.querySelector('.jukebox');
  if (!jukebox) return;
  const answerInput = game.querySelector('#answerInput');
  const restoreAnswerFocus = answerInput && document.activeElement === answerInput;
  const round = game.querySelector('.round-top');
  const artId = round.dataset.packId || selectedId || 'new-wave';
  const title = round.dataset.packTitle || lastTitle;
  const top = jukebox.querySelector('.jb-top');
  const points = jukebox.querySelector('.jb-marquee');
  points.innerHTML = `${t("За ответ:", "Correct answer:")} <b>${points.querySelector('b').textContent}</b>`;
  const tools = top.querySelector('.jb-tools');
  tools.before(points);
  const score = round.querySelector('.total-score');
  const roundControls = document.createElement('div');
  roundControls.className = 'round-controls';
  score.replaceWith(roundControls);
  roundControls.append(score, tools);
  const scene = document.createElement('div');
  scene.className = 'round-turntable';
  scene.innerHTML = deck(title, artId);
  scene.querySelector('.store-deck').append(jukebox.querySelector('#playBtn'));
  jukebox.querySelector('.jb-dome').replaceWith(scene);
  const tinySign = top.querySelector('.jb-sign');
  tinySign.replaceWith(Object.assign(document.createElement('span'), { className: 'player-caption', textContent: title }));
  const error = game.querySelector('#audioError');
  jukebox.querySelector('.play-status').after(error);
  const form = game.querySelector('#guessForm');
  const history = game.querySelector('.attempt-history');
  if (form && history) {
    const answer = document.createElement('div');
    answer.className = 'store-answer-panel';
    const heading = document.createElement('h2');
    heading.textContent = t('Что это за песня?', "What’s this song?");
    if (game.dataset.answerMode === 'artist') heading.textContent = t('Кто это поёт?', "Who’s singing?");
    answer.append(heading, form, history);
    const feedback = game.querySelector('.round-feedback,.answer-hint');
    if (feedback) form.after(feedback);
    game.querySelector('.round-layout').append(answer);
  }
  // высота раунда = экран минус шапка сайта над ним (см. «Раунд на компьютере — ровно один экран» в CSS)
  game.style.setProperty('--shell-top', `${Math.round(game.getBoundingClientRect().top + scrollY)}px`);
  if (restoreAnswerFocus) answerInput.focus({ preventScroll: true });
  if (playOnEntry) {
    playOnEntry = false;
    const play = game.querySelector('#playBtn');
    const observer = new MutationObserver(() => {
      if (!game.isConnected || !error.hidden) observer.disconnect();
      else if (!play.disabled) { observer.disconnect(); play.click(); }
    });
    observer.observe(play, { attributes: true, attributeFilter: ['disabled'] });
    observer.observe(error, { attributes: true, attributeFilter: ['hidden'] });
    observer.observe(stage, { childList: true });
    if (!play.disabled) { observer.disconnect(); play.click(); }
  }
}

function decorate() {
  const home = stage.querySelector('.music-home');
  if (home && !home.dataset.store) decorateHome(home);
  const game = stage.querySelector('.game-shell');
  if (game && !game.dataset.store) decorateGame(game);
  document.body.classList.toggle('store-playing-screen', !!game);
}

// Rotate the vinyl and printed label together; room reflections and the spindle stay still.
let lastFrame = performance.now(), angle = 0, velocity = 0;
function rotate(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.08);
  lastFrame = now;
  const disc = stage.querySelector('.disc-spinning');
  const playing = !!stage.querySelector('.is-playing');
  const target = !reducedMotion.matches && !document.hidden && (playing || !!disc?.closest('.home-deck:hover')) ? 200 : 0;
  velocity += (target - velocity) * Math.min(1, dt * (target > velocity ? 7 : 2.5));
  if (velocity < 0.1) velocity = 0;
  angle = (angle + velocity * dt) % 360;
  if (disc) disc.style.transform = `rotate(${angle}deg)`;
  requestAnimationFrame(rotate);
}
requestAnimationFrame(rotate);

new MutationObserver(decorate).observe(stage, { childList: true });
await import('./app.js?v=music-fixes-20261030');
decorate();
