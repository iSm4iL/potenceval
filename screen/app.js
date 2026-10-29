import { TITLES as SEED_TITLES, OPTIONS } from './catalog.js';
import { EXTRA_TITLES } from './catalog.extra.js';
import { toEnglish, OPTIONS_EN } from './catalog.en.js';
import { t as tr, lang } from '../shared/i18n.js?v=ui-20261029';
import { revealPaidClue, BLUR, SHARPEN } from './round.js?v=posters-20261025';
import { visualFor } from './visuals.js?v=posters-20261026';
import { bindPoster } from './poster-image.js?v=lang-20261028';

const stage = document.querySelector('#stage');
const exitBtn = document.querySelector('#exitBtn');
const rules = document.querySelector('#rulesDialog');
document.querySelector('meta[name="description"]').content = tr('Угадай кино, сериал, аниме или мультфильм по подсказкам и размытому постеру.', 'Until the Credits: guess movies, series, anime and cartoons from a blurred poster and clues.');
const modes = [
  { id: 'film', icon: '▣', short: tr('КИНО', 'FILM'), name: tr('Кино', 'Movies'), desc: tr('Полнометражные фильмы', 'Feature films') },
  { id: 'series', icon: '▤', short: tr('СЕРИАЛЫ', 'SERIES'), name: tr('Сериалы', 'Series'), desc: tr('Истории на много серий', 'Stories over many episodes') },
  { id: 'anime', icon: '✿', short: tr('АНИМЕ', 'ANIME'), name: tr('Аниме', 'Anime'), desc: tr('Японская анимация', 'Japanese animation') },
  { id: 'cartoon', icon: '◉', short: tr('МУЛЬТ', 'TOONS'), name: tr('Мультфильмы', 'Cartoons'), desc: tr('Анимационное кино', 'Animated films') },
  { id: 'mom', icon: '♥', short: tr('МАМА', 'MOM'), name: tr('Мама', 'Mom'), desc: tr('Узнаваемые истории разных лет', 'Familiar stories from over the years') },
  { id: 'dad', icon: '★', short: tr('ПАПА', 'DAD'), name: tr('Папа', 'Dad'), desc: tr('Классика, приключения и фантастика', 'Classics, adventure and sci-fi') },
  { id: 'all', icon: '✦', short: tr('МИКС', 'MIX'), name: tr('Всё вперемешку', 'Everything mixed'), desc: tr('Любой экран — одна загадка', 'Any screen — one puzzle') }
];
const specialShelves = {
  mom: new Set(['tv-105', 'tv-1668', 'tv-14853', 'tv-104877', 'movie-114', 'movie-597', 'movie-150540', 'tv-119051']),
  dad: new Set(['movie-280', 'movie-11', 'movie-105', 'movie-20992', 'movie-603', 'movie-329', 'tv-1396'])
};
const hintDefs = [
  { key: 'genres', label: tr('Остальные жанры', 'Other genres'), cost: 8, get: t => t.genres.slice(1).join(', ') },
  { key: 'director', label: tr('Режиссёр / автор', 'Director / creator'), cost: 14, get: t => t.director },
  { key: 'premise', label: tr('О чём история', 'What it’s about'), cost: 24, get: t => t.premise }
];
let mode = 'all';
let selectedMode = 'all';
const TITLES = [...SEED_TITLES, ...EXTRA_TITLES].map(x => (lang === 'en' ? toEnglish(x) : x));
const ANSWERS = lang === 'en' ? OPTIONS_EN : OPTIONS;
// Подписи к постерам приходят по-русски из visuals.js и poster-overrides.js.
const caption = s => (lang === 'en' ? s.replace('Постер аниме', 'Anime poster').replace('Постер сериала', 'Series poster').replace('Постер', 'Poster').replace('Википедия', 'Wikipedia').replace('Общественное достояние', 'Public domain') : s);
let deck = [];
let round = null;
let total = 0;
let played = 0;
let selectedRounds = 5;

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const norm = s => String(s).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const inMode = (title, selected) => selected === 'all' || (specialShelves[selected] ? specialShelves[selected].has(title.id) : title.category === selected);
const puzzlesWord = (count, accusative = false) => lang === 'en' ? (count === 1 ? 'puzzle' : 'puzzles') : count % 100 >= 11 && count % 100 <= 14 ? 'загадок' : count % 10 === 1 ? accusative ? 'загадку' : 'загадка' : count % 10 >= 2 && count % 10 <= 4 ? 'загадки' : 'загадок';
const worksWord = count => lang === 'en' ? (count === 1 ? 'title' : 'titles') : count % 100 >= 11 && count % 100 <= 14 ? 'произведений' : count % 10 === 1 ? 'произведение' : count % 10 >= 2 && count % 10 <= 4 ? 'произведения' : 'произведений';

function home() {
  exitBtn.hidden = true;
  const cassette = m => `<button type="button" class="cassette cassette-${m.id}${m.id === selectedMode ? ' selected' : ''}" data-mode="${m.id}" aria-label="${m.name}" aria-pressed="${m.id === selectedMode}"><span class="cassette-cap" aria-hidden="true"></span><span class="cassette-stamp" aria-hidden="true">${m.icon}</span><span class="cassette-title" aria-hidden="true">${m.short}</span><span class="cassette-foot" aria-hidden="true">PV · DVD</span></button>`;
  const blanks = side => `<span class="blank-bank blank-bank-${side}" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<span class="blank-case blank-tone-${i % 4}"><i></i></span>`).join('')}</span>`;
  const chosen = modes.find(m => m.id === selectedMode);
  const chosenCount = TITLES.filter(t => inMode(t, selectedMode)).length;
  stage.innerHTML = `<section class="launch"><div class="launch-intro"><div class="cabinet-stamp">${tr('Видеопрокат', 'Video rental')} · potenceval</div><div class="cabinet-plaque"><p class="eyebrow">${tr('Угадай до финальных титров', 'Guess it before the end credits')}</p><h1>${tr('До титров', 'Until the Credits')}</h1><p class="hero-copy">${tr('Выбери кассету с полки. Узнавай кино, сериал, аниме или мультфильм по постеру и подсказкам.', 'Pick a tape from the shelf. Guess the movie, series, anime or cartoon from the poster and clues.')}</p><div class="launch-facts"><span>${tr('Размытый постер', 'Blurred poster')}</span><span>${tr('100 очков', '100 points')}</span><span>${tr('Подсказки за баллы', 'Clues cost points')}</span></div></div><div class="cabinet-hinge hinge-one" aria-hidden="true"></div><div class="cabinet-hinge hinge-two" aria-hidden="true"></div></div>
  <div class="launch-panel"><div class="launch-panel-head"><span>${tr('Полка с историями', 'Shelf of stories')}</span><small>${tr('Нажми на кассету', 'Tap a tape')}</small></div><div class="shelf-cabinet"><div class="shelf shelf-top" aria-label="${tr('Кино, сериалы, аниме и мультфильмы', 'Movies, series, anime and cartoons')}">${blanks('left')}${modes.slice(0, 4).map(cassette).join('')}${blanks('right')}</div><div class="shelf shelf-bottom" aria-label="${tr('Подборки Мама, Папа и смешанная', 'Mom, Dad and mixed collections')}">${blanks('left')}${modes.slice(4).map(cassette).join('')}${blanks('right')}</div></div><div class="selected-summary" aria-live="polite"><span>${tr('Выбрана кассета', 'Tape selected')} · ${chosenCount} ${puzzlesWord(chosenCount)}</span><strong id="selectedTitle">${chosen.name}</strong><small id="selectedDesc">${chosen.desc}</small></div><div class="round-picker"><span>${tr('Сколько угадываем?', 'How many to guess?')}</span><div id="roundChoices" class="round-choices" role="group" aria-label="${tr('Количество загадок', 'Number of puzzles')}"></div></div><button id="startBtn" class="btn primary launch-start">${tr('Играть', 'Play')}: ${chosen.name} <span>↗</span></button><p class="launch-note">${tr('В коллекции', 'The collection has')} ${TITLES.length} ${worksWord(TITLES.length)}. ${tr('«Мама» и «Папа» собирают знакомые истории разных лет и форматов.', '“Mom” and “Dad” gather familiar stories from different years and formats.')}</p></div></section>`;
  const renderRoundChoices = () => {
    const count = TITLES.filter(t => inMode(t, selectedMode)).length;
    if (selectedRounds > count) selectedRounds = count;
    const choices = [...new Set([3, 5, 10, 20, 50, count, selectedRounds])].filter(n => n > 0 && n <= count).sort((a, b) => a - b);
    stage.querySelector('#roundChoices').innerHTML = choices.map(n => `<button type="button" class="round-choice${n === selectedRounds ? ' selected' : ''}" data-rounds="${n}" aria-pressed="${n === selectedRounds}">${n === count ? `${tr('Все', 'All')} · ${n}` : n}</button>`).join('');
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
    stage.querySelector('.selected-summary>span').textContent = `${tr('Выбрана кассета', 'Tape selected')} · ${count} ${puzzlesWord(count)}`;
    stage.querySelector('#selectedTitle').textContent = selected.name;
    stage.querySelector('#selectedDesc').textContent = selected.desc;
    stage.querySelector('#startBtn').innerHTML = `${tr('Играть', 'Play')}: ${selected.name} <span>↗</span>`;
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
  const available = hintDefs.filter(h => h.get(t));
  const actors = (t.cast || '').split(', ').filter(Boolean).slice(0, 3);
  const castLabel = t.category === 'anime' || t.category === 'cartoon' ? tr('Актёры озвучивания', 'Voice cast') : tr('В главных ролях', 'Starring');
  const actorCosts = [10, 14, 18];
  const level = round.sharp.size, blur = round.done ? 0 : BLUR[level];
  stage.innerHTML = `<div class="round-head"><div><p class="eyebrow">${esc(modes.find(m => m.id === mode).name)} · ${played} ${tr('из', 'of')} ${played + deck.length}</p><h1>${tr('Что это?', 'What is it?')}</h1></div><div class="score"><strong>${round.score}</strong><span>${tr('очков в раунде', 'points this round')}</span></div></div>
  <div class="round-layout"><div class="poster-column"><div class="poster-frame" style="--blur:${round.shownBlur}px"><img class="clue-photo" alt="${tr('Постер для угадывания', 'Poster to guess')}" referrerpolicy="no-referrer" hidden><div class="poster-message" id="posterStatus" role="status">${tr('Загружаем настоящий постер…', 'Loading the real poster…')}</div><button class="poster-retry" id="posterRetry" hidden>${tr('Повторить загрузку', 'Try again')}</button></div>
  <div class="sharpen"><div class="sharp-steps" aria-label="${tr('Чёткость', 'Sharpness')} ${level + 1} ${tr('из', 'of')} ${BLUR.length}">${BLUR.map((_, i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</div>${round.done || level >= SHARPEN.length ? `<p class="poster-caption">${round.done ? tr('Постер открыт', 'Poster revealed') : tr('Чётче уже некуда', 'As sharp as it gets')}</p>` : `<button class="btn sharpen-btn" id="sharpBtn" ${round.score < SHARPEN[level] ? 'disabled' : ''}>${tr('Сделать чётче', 'Sharpen')} <b>−${SHARPEN[level]}</b></button>`}</div></div>
  <div class="facts-column"><div class="answer-area"><label for="guess">${tr('Название', 'Title')}</label><div class="guess-row"><input id="guess" type="search" placeholder="${tr('Начни писать название…', 'Start typing the title…')}" autocomplete="off" ${round.done ? 'disabled' : ''}><button id="guessBtn" class="btn primary" ${round.done ? 'disabled' : ''}>${tr('Ответить', 'Answer')}</button></div><div id="suggestions" class="suggestions" hidden></div><p id="feedback" class="feedback" role="status" aria-live="polite">${tr('Выбери название из списка или напиши его целиком.', 'Pick a title from the list or type it in full.')}</p></div>
  <div class="facts-head"><h2>${tr('Досье', 'Dossier')}</h2><span>${tr('Выбирай, что узнать дальше', 'Choose what to learn next')}</span></div><div class="free-facts"><span><small>${tr('Год', 'Year')}</small><b>${esc(t.year)}</b></span><span><small>${tr('Страна', 'Country')}</small><b>${esc(t.country)}</b></span><span><small>${tr('Длительность', 'Runtime')}</small><b>${esc(t.runtime)}</b></span><span><small>${tr('Жанр', 'Genre')}</small><b>${esc(t.genres[0])}</b></span></div>
  ${actors.length ? `<section class="actor-section"><div class="clue-head"><h3>${castLabel}</h3><span>${tr('Открывай по одному имени', 'Reveal one name at a time')}</span></div><div class="actor-list">${actors.map((name, i) => `<div class="actor-row"><span class="actor-num">${String(i + 1).padStart(2, '0')}</span>${round.openActors.has(i) || round.done ? `<b>${esc(name)}</b>` : `<span class="actor-hidden">${tr('Имя скрыто', 'Name hidden')}</span><button data-actor="${i}" ${round.score < actorCosts[i] ? 'disabled' : ''}>${tr('Открыть', 'Reveal')} <b>−${actorCosts[i]}</b></button>`}</div>`).join('')}</div></section>` : ''}
  <section class="clue-section"><div class="clue-head"><h3>${tr('Другие зацепки', 'Other clues')}</h3><span>${tr('Цена указана на каждой карточке', 'Each card shows its cost')}</span></div><div class="clue-grid">${available.map(h => `<div class="clue-card${round.opened.has(h.key) || round.done ? ' open' : ''}"><span>${esc(h.label)}</span>${round.opened.has(h.key) || round.done ? `<strong>${esc(h.get(t))}</strong>` : `<button data-hint="${h.key}" ${round.score < h.cost ? 'disabled' : ''}>${tr('Открыть', 'Reveal')} <b>−${h.cost}</b></button>`}</div>`).join('')}</div></section>
  <div class="round-foot"><button class="skip" id="skipBtn">${tr('Пропустить раунд', 'Skip round')}</button><span>${visual.image ? `<a href="${esc(visual.source)}" target="_blank" rel="noopener noreferrer">${esc(caption(visual.caption))}</a>` : tr('Оригинальная иллюстрация-подсказка', 'Original clue illustration')}</span></div></div></div>`;
  const photo = stage.querySelector('.clue-photo');
  const sharpButton = stage.querySelector('#sharpBtn');
  const currentRound = round;
  bindPoster({image:photo,message:stage.querySelector('#posterStatus'),retry:stage.querySelector('#posterRetry'),
    credit:stage.querySelector('.round-foot a'),candidates:[visual,...(visual.alternatives || [])].map(c => ({ ...c, caption: caption(c.caption || '') })),
    onReady:ready => { if (sharpButton) sharpButton.disabled = !ready || currentRound.score < SHARPEN[level]; }
  });
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
  const list = mode === 'all' ? Object.values(ANSWERS).flat() : ANSWERS[mode] || [];
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
  if (!answer) { feedback.textContent = tr('Сначала напиши название.', 'Type a title first.'); input.focus(); return; }
  if ([round.title.title, ...round.title.aliases].some(name => norm(name) === answer)) return resolve(true);
  if (!candidates().some(name => norm(name) === answer)) { feedback.textContent = tr('Выбери название из списка.', 'Pick a title from the list.'); input.focus(); return; }
  if (round.attempts.has(answer)) { feedback.textContent = tr('Такой ответ уже был.', 'You already tried that.'); return; }
  round.attempts.add(answer);
  round.score = Math.max(0, round.score - 10);
  renderRound();
  stage.querySelector('#feedback').textContent = tr(`Не угадали. Ещё попытка? −10 очков · ошибок: ${round.attempts.size}`, `Wrong. Try again? −10 points · misses: ${round.attempts.size}`);
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
  area.innerHTML = `<div class="result ${round.correct ? 'win' : ''}"><span>${round.correct ? `+${round.score} ${tr('очков', 'points')}` : tr('Раунд пропущен', 'Round skipped')}</span><h2>${esc(t.title)}</h2><p>${esc(t.year)} · ${esc(t.genres.join(', '))}</p><button id="nextBtn" class="btn primary">${deck.length ? tr('Следующая загадка', 'Next puzzle') : tr('Посмотреть итог', 'See results')}</button></div>`;
  stage.querySelector('#nextBtn').addEventListener('click', next);
  stage.querySelector('#skipBtn').remove();
}

function finish() {
  exitBtn.hidden = true;
  stage.innerHTML = `<section class="finish"><div class="finish-mark">✦</div><h1>${tr('Титры!', 'Roll credits!')}</h1><p>${tr(`Ты прошёл ${played} ${puzzlesWord(played, true)} и набрал`, `You played ${played} ${puzzlesWord(played)} and scored`)}</p><strong>${total}</strong><span>${tr('очков', 'points')}</span><div class="finish-buttons"><button class="btn primary" id="againBtn">${tr('Ещё раз', 'Again')}</button><button class="btn ghost" id="homeBtn">${tr('Выбрать подборку', 'Pick a collection')}</button></div></section>`;
  stage.querySelector('#againBtn').addEventListener('click', () => start(mode));
  stage.querySelector('#homeBtn').addEventListener('click', home);
}

exitBtn.addEventListener('click', home);
document.querySelector('#rulesBtn').addEventListener('click', () => rules.showModal());
document.querySelector('#rulesClose').addEventListener('click', () => rules.close());
rules.addEventListener('click', e => { if (e.target === rules) rules.close(); });
home();
