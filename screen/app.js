import { TITLES as SEED_TITLES, OPTIONS } from './catalog.js';
import { EXTRA_TITLES } from './catalog.extra.js';
import { revealPaidClue, BLUR, SHARPEN } from './round.js?v=posters-20261025';
import { visualFor } from './visuals.js?v=posters-20261025';

const stage = document.querySelector('#stage');
const exitBtn = document.querySelector('#exitBtn');
const rules = document.querySelector('#rulesDialog');
const modes = [
  { id: 'film', icon: '▣', short: 'КИНО', name: 'Кино', desc: 'Полнометражные фильмы' },
  { id: 'series', icon: '▤', short: 'СЕРИАЛЫ', name: 'Сериалы', desc: 'Истории на много серий' },
  { id: 'anime', icon: '✿', short: 'АНИМЕ', name: 'Аниме', desc: 'Японская анимация' },
  { id: 'cartoon', icon: '◉', short: 'МУЛЬТ', name: 'Мультфильмы', desc: 'Анимационное кино' },
  { id: 'mom', icon: '♥', short: 'МАМА', name: 'Мама', desc: 'Узнаваемые истории разных лет' },
  { id: 'dad', icon: '★', short: 'ПАПА', name: 'Папа', desc: 'Классика, приключения и фантастика' },
  { id: 'all', icon: '✦', short: 'МИКС', name: 'Всё вперемешку', desc: 'Любой экран — одна загадка' }
];
const specialShelves = {
  mom: new Set(['tv-105', 'tv-1668', 'tv-14853', 'tv-104877', 'movie-114', 'movie-597', 'movie-150540', 'tv-119051']),
  dad: new Set(['movie-280', 'movie-11', 'movie-105', 'movie-20992', 'movie-603', 'movie-329', 'tv-1396'])
};
const hintDefs = [
  { key: 'genres', label: 'Остальные жанры', cost: 8, get: t => t.genres.slice(1).join(', ') },
  { key: 'director', label: 'Режиссёр / автор', cost: 14, get: t => t.director },
  { key: 'premise', label: 'О чём история', cost: 24, get: t => t.premise }
];
let mode = 'all';
let selectedMode = 'all';
const TITLES = [...SEED_TITLES, ...EXTRA_TITLES];
let deck = [];
let round = null;
let total = 0;
let played = 0;
let selectedRounds = 5;

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const norm = s => String(s).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const inMode = (title, selected) => selected === 'all' || (specialShelves[selected] ? specialShelves[selected].has(title.id) : title.category === selected);
const puzzlesWord = (count, accusative = false) => count % 100 >= 11 && count % 100 <= 14 ? 'загадок' : count % 10 === 1 ? accusative ? 'загадку' : 'загадка' : count % 10 >= 2 && count % 10 <= 4 ? 'загадки' : 'загадок';
const worksWord = count => count % 100 >= 11 && count % 100 <= 14 ? 'произведений' : count % 10 === 1 ? 'произведение' : count % 10 >= 2 && count % 10 <= 4 ? 'произведения' : 'произведений';

function home() {
  exitBtn.hidden = true;
  const cassette = m => `<button type="button" class="cassette cassette-${m.id}${m.id === selectedMode ? ' selected' : ''}" data-mode="${m.id}" aria-label="${m.name}" aria-pressed="${m.id === selectedMode}"><span class="cassette-cap" aria-hidden="true"></span><span class="cassette-stamp" aria-hidden="true">${m.icon}</span><span class="cassette-title" aria-hidden="true">${m.short}</span><span class="cassette-foot" aria-hidden="true">PV · DVD</span></button>`;
  const blanks = side => `<span class="blank-bank blank-bank-${side}" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<span class="blank-case blank-tone-${i % 4}"><i></i></span>`).join('')}</span>`;
  const chosen = modes.find(m => m.id === selectedMode);
  const chosenCount = TITLES.filter(t => inMode(t, selectedMode)).length;
  stage.innerHTML = `<section class="launch"><div class="launch-intro"><div class="cabinet-stamp">Видеопрокат · potenceval</div><div class="cabinet-plaque"><p class="eyebrow">Угадай до финальных титров</p><h1>До титров</h1><p class="hero-copy">Выбери кассету с полки. Узнавай кино, сериал, аниме или мультфильм по постеру и подсказкам.</p><div class="launch-facts"><span>Размытый постер</span><span>100 очков</span><span>Подсказки за баллы</span></div></div><div class="cabinet-hinge hinge-one" aria-hidden="true"></div><div class="cabinet-hinge hinge-two" aria-hidden="true"></div></div>
  <div class="launch-panel"><div class="launch-panel-head"><span>Полка с историями</span><small>Нажми на кассету</small></div><div class="shelf-cabinet"><div class="shelf shelf-top" aria-label="Кино, сериалы, аниме и мультфильмы">${blanks('left')}${modes.slice(0, 4).map(cassette).join('')}${blanks('right')}</div><div class="shelf shelf-bottom" aria-label="Подборки Мама, Папа и смешанная">${blanks('left')}${modes.slice(4).map(cassette).join('')}${blanks('right')}</div></div><div class="selected-summary" aria-live="polite"><span>Выбрана кассета · ${chosenCount} ${puzzlesWord(chosenCount)}</span><strong id="selectedTitle">${chosen.name}</strong><small id="selectedDesc">${chosen.desc}</small></div><div class="round-picker"><span>Сколько угадываем?</span><div id="roundChoices" class="round-choices" role="group" aria-label="Количество загадок"></div></div><button id="startBtn" class="btn primary launch-start">Играть: ${chosen.name} <span>↗</span></button><p class="launch-note">В коллекции ${TITLES.length} ${worksWord(TITLES.length)}. «Мама» и «Папа» собирают знакомые истории разных лет и форматов.</p></div></section>`;
  const renderRoundChoices = () => {
    const count = TITLES.filter(t => inMode(t, selectedMode)).length;
    if (selectedRounds > count) selectedRounds = count;
    const choices = [...new Set([3, 5, 10, 20, 50, count, selectedRounds])].filter(n => n > 0 && n <= count).sort((a, b) => a - b);
    stage.querySelector('#roundChoices').innerHTML = choices.map(n => `<button type="button" class="round-choice${n === selectedRounds ? ' selected' : ''}" data-rounds="${n}" aria-pressed="${n === selectedRounds}">${n === count ? `Все · ${n}` : n}</button>`).join('');
  };
  renderRoundChoices();
  stage.querySelector('#roundChoices').addEventListener('click', e => {
    const button = e.target.closest('[data-rounds]');
    if (!button) return;
    selectedRounds = Number(button.dataset.rounds);
    renderRoundChoices();
  });
  stage.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    selectedMode = b.dataset.mode;
    stage.querySelectorAll('[data-mode]').forEach(card => {
      const active = card.dataset.mode === selectedMode;
      card.classList.toggle('selected', active);
      card.setAttribute('aria-pressed', String(active));
    });
    const selected = modes.find(m => m.id === selectedMode);
    const count = TITLES.filter(t => inMode(t, selectedMode)).length;
    stage.querySelector('.selected-summary>span').textContent = `Выбрана кассета · ${count} ${puzzlesWord(count)}`;
    stage.querySelector('#selectedTitle').textContent = selected.name;
    stage.querySelector('#selectedDesc').textContent = selected.desc;
    stage.querySelector('#startBtn').innerHTML = `Играть: ${selected.name} <span>↗</span>`;
    renderRoundChoices();
  }));
  stage.querySelector('#startBtn').addEventListener('click', () => start(selectedMode));
}

function start(selected) {
  mode = selected;
  deck = TITLES.filter(t => inMode(t, mode));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  deck = deck.slice(0, selectedRounds);
  total = 0;
  played = 0;
  next();
}

function next() {
  if (!deck.length) return finish();
  round = { title: deck.pop(), score: 100, opened: new Set(), sharp: new Set(), shownBlur: BLUR[0], openActors: new Set(), attempts: new Set(), done: false };
  played += 1;
  exitBtn.hidden = false;
  renderRound();
}

function renderRound() {
  const t = round.title;
  const visual = visualFor(t);
  const art = `<div class="clue-illustration" style="--art-dark:${visual.dark};--art-light:${visual.light}" aria-hidden="true"><span class="art-ring"></span><span class="art-corner">${esc(visual.glyph)}</span><span class="art-glyph">${esc(visual.glyph)}</span></div>`;
  const available = hintDefs.filter(h => h.get(t));
  const actors = (t.cast || '').split(', ').filter(Boolean).slice(0, 3);
  const castLabel = t.category === 'anime' || t.category === 'cartoon' ? 'Актёры озвучивания' : 'В главных ролях';
  const actorCosts = [10, 14, 18];
  const level = round.sharp.size, blur = round.done ? 0 : BLUR[level];
  stage.innerHTML = `<div class="round-head"><div><p class="eyebrow">${esc(modes.find(m => m.id === mode).name)} · ${played} из ${played + deck.length}</p><h1>Что это?</h1></div><div class="score"><strong>${round.score}</strong><span>очков в раунде</span></div></div>
  <div class="round-layout"><div class="poster-column"><div class="poster-frame" style="--blur:${round.shownBlur}px">${art}${visual.image ? `<img class="clue-photo" src="${esc(visual.image)}" alt="Размытый постер" referrerpolicy="no-referrer">` : ''}</div>
  <div class="sharpen"><div class="sharp-steps" aria-label="Чёткость ${level + 1} из ${BLUR.length}">${BLUR.map((_, i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</div>${round.done || level >= SHARPEN.length ? `<p class="poster-caption">${round.done ? 'Постер открыт' : 'Чётче уже некуда'}</p>` : `<button class="btn sharpen-btn" id="sharpBtn" ${round.score < SHARPEN[level] ? 'disabled' : ''}>Сделать чётче <b>−${SHARPEN[level]}</b></button>`}</div></div>
  <div class="facts-column"><div class="answer-area"><label for="guess">Название</label><div class="guess-row"><input id="guess" type="search" placeholder="Начни писать название…" autocomplete="off" ${round.done ? 'disabled' : ''}><button id="guessBtn" class="btn primary" ${round.done ? 'disabled' : ''}>Ответить</button></div><div id="suggestions" class="suggestions" hidden></div><p id="feedback" class="feedback" role="status" aria-live="polite">Выбери название из списка или напиши его целиком.</p></div>
  <div class="facts-head"><h2>Досье</h2><span>Выбирай, что узнать дальше</span></div><div class="free-facts"><span><small>Год</small><b>${esc(t.year)}</b></span><span><small>Страна</small><b>${esc(t.country)}</b></span><span><small>Длительность</small><b>${esc(t.runtime)}</b></span><span><small>Жанр</small><b>${esc(t.genres[0])}</b></span></div>
  ${actors.length ? `<section class="actor-section"><div class="clue-head"><h3>${castLabel}</h3><span>Открывай по одному имени</span></div><div class="actor-list">${actors.map((name, i) => `<div class="actor-row"><span class="actor-num">${String(i + 1).padStart(2, '0')}</span>${round.openActors.has(i) || round.done ? `<b>${esc(name)}</b>` : `<span class="actor-hidden">Имя скрыто</span><button data-actor="${i}" ${round.score < actorCosts[i] ? 'disabled' : ''}>Открыть <b>−${actorCosts[i]}</b></button>`}</div>`).join('')}</div></section>` : ''}
  <section class="clue-section"><div class="clue-head"><h3>Другие зацепки</h3><span>Цена указана на каждой карточке</span></div><div class="clue-grid">${available.map(h => `<div class="clue-card${round.opened.has(h.key) || round.done ? ' open' : ''}"><span>${esc(h.label)}</span>${round.opened.has(h.key) || round.done ? `<strong>${esc(h.get(t))}</strong>` : `<button data-hint="${h.key}" ${round.score < h.cost ? 'disabled' : ''}>Открыть <b>−${h.cost}</b></button>`}</div>`).join('')}</div></section>
  <div class="round-foot"><button class="skip" id="skipBtn">Пропустить раунд</button><span>${visual.image ? `<a href="${esc(visual.source)}" target="_blank" rel="noopener noreferrer">${esc(visual.caption)}</a>` : 'Оригинальная иллюстрация-подсказка'}</span></div></div></div>`;
  const photo = stage.querySelector('.clue-photo');
  if (photo) {
    const visualCredit = stage.querySelector('.round-foot span');
    const showIllustration = () => {
      photo.remove();
      visualCredit.textContent = 'Оригинальная иллюстрация-подсказка';
    };
    photo.addEventListener('error', showIllustration, { once: true });
    if (photo.complete && !photo.naturalWidth) showIllustration();
  }
  // Постер плавно становится чётче: кадр рисуется с прошлым размытием и сразу переходит к новому.
  const frame = stage.querySelector('.poster-frame');
  void frame.offsetWidth; // зафиксировать прошлое размытие, чтобы сработал плавный переход
  frame.style.setProperty('--blur', `${blur}px`);
  round.shownBlur = blur;
  stage.querySelector('#sharpBtn')?.addEventListener('click', () => { if (revealPaidClue(round, round.sharp, level, SHARPEN[level])) renderRound(); });
  stage.querySelectorAll('[data-actor]').forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.actor); if (revealPaidClue(round, round.openActors, i, actorCosts[i])) renderRound(); }));
  stage.querySelectorAll('[data-hint]').forEach(b => b.addEventListener('click', () => { const key = b.dataset.hint; if (revealPaidClue(round, round.opened, key, hintDefs.find(h => h.key === key).cost)) renderRound(); }));
  stage.querySelector('#skipBtn').addEventListener('click', () => resolve(false));
  stage.querySelector('#guessBtn').addEventListener('click', submit);
  const input = stage.querySelector('#guess');
  input.addEventListener('input', suggest);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  if (round.done) showResult();
}

function candidates() {
  const list = mode === 'all' ? Object.values(OPTIONS).flat() : OPTIONS[mode] || [];
  return [...new Set([...TITLES.filter(t => inMode(t, mode)).flatMap(t => [t.title, ...(t.aliases || [])]), ...list])];
}

function suggest() {
  const input = stage.querySelector('#guess');
  const box = stage.querySelector('#suggestions');
  const query = norm(input.value);
  if (!query) { box.hidden = true; return; }
  const found = candidates().filter(name => norm(name).includes(query)).slice(0, 6);
  box.innerHTML = found.map(name => `<button type="button" data-value="${esc(name)}">${esc(name)}</button>`).join('');
  box.hidden = !found.length;
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.value; box.hidden = true; submit(); }));
}

function submit() {
  if (round.done) return;
  const input = stage.querySelector('#guess');
  const answer = norm(input.value);
  const feedback = stage.querySelector('#feedback');
  if (!answer) { feedback.textContent = 'Сначала напиши название.'; input.focus(); return; }
  if ([round.title.title, ...round.title.aliases].some(name => norm(name) === answer)) return resolve(true);
  if (!candidates().some(name => norm(name) === answer)) { feedback.textContent = 'Выбери название из списка.'; input.focus(); return; }
  if (round.attempts.has(answer)) { feedback.textContent = 'Такой ответ уже был.'; return; }
  round.attempts.add(answer);
  round.score = Math.max(0, round.score - 10);
  renderRound();
  stage.querySelector('#feedback').textContent = `Не угадали. Ещё попытка? −10 очков · ошибок: ${round.attempts.size}`;
  stage.querySelector('#guess').focus();
}

function resolve(correct) {
  round.done = true;
  round.correct = correct;
  if (correct) total += round.score;
  renderRound();
}

function showResult() {
  const t = round.title;
  const area = stage.querySelector('.answer-area');
  area.innerHTML = `<div class="result ${round.correct ? 'win' : ''}"><span>${round.correct ? `+${round.score} очков` : 'Раунд пропущен'}</span><h2>${esc(t.title)}</h2><p>${esc(t.year)} · ${esc(t.genres.join(', '))}</p><button id="nextBtn" class="btn primary">${deck.length ? 'Следующая загадка' : 'Посмотреть итог'}</button></div>`;
  stage.querySelector('#nextBtn').addEventListener('click', next);
  stage.querySelector('#skipBtn').remove();
}

function finish() {
  exitBtn.hidden = true;
  stage.innerHTML = `<section class="finish"><div class="finish-mark">✦</div><h1>Титры!</h1><p>Ты прошёл ${played} ${puzzlesWord(played, true)} и набрал</p><strong>${total}</strong><span>очков</span><div class="finish-buttons"><button class="btn primary" id="againBtn">Ещё раз</button><button class="btn ghost" id="homeBtn">Выбрать подборку</button></div></section>`;
  stage.querySelector('#againBtn').addEventListener('click', () => start(mode));
  stage.querySelector('#homeBtn').addEventListener('click', home);
}

exitBtn.addEventListener('click', home);
document.querySelector('#rulesBtn').addEventListener('click', () => rules.showModal());
document.querySelector('#rulesClose').addEventListener('click', () => rules.close());
rules.addEventListener('click', e => { if (e.target === rules) rules.close(); });
home();
