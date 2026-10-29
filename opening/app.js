import { buildSession, buildChoices, createRound, startRound, answerRound, remainingTime, interruptRound } from './game.js?v=lang-20261029';
import { deezerRequest } from '../music/service.js';
import { AudioPlayer } from '../music/audio.js';
import { reportPlaybackError } from '../shared/diagnostics.js';
import { t, lang } from '../shared/i18n.js?v=ui-20261029';
import { TITLES_EN } from './titles.en.js';

const $ = id => document.getElementById(id);
const player = new AudioPlayer();
let catalog = [], queue = [], reserves = [], history = [], round = null, choices = [];
let interval = null, request = null, generation = 0, starting = false, failures = 0;
let category = 'anime', playedByCategory = {};
const categoryLabels = { anime:t('аниме', 'anime'), film:t('фильм', 'movie'), series:t('сериал', 'series'), cartoon:t('мультфильм', 'cartoon') };
const titleFor = entry => lang === 'en' ? TITLES_EN[entry.animeId] || entry.titleOriginal : entry.titleRu;
// Shared audio and service errors may still arrive in Russian.
const errorMessage = (error, fallback) => error?.message && !(lang === 'en' && /[А-Яа-яЁё]/.test(error.message)) ? error.message : fallback;
$('roundDots').setAttribute('aria-label', t('Прогресс партии', 'Game progress'));
$('volume').setAttribute('aria-label', t('Громкость', 'Volume'));
$('seconds').parentElement.setAttribute('aria-label', t('Осталось секунд', 'Seconds remaining'));
$('choices').setAttribute('aria-label', t('Варианты ответа', 'Answer choices'));
$('closeRules').setAttribute('aria-label', t('Закрыть правила', 'Close rules'));
document.querySelector('meta[name="description"]').content = t(
  'Узнай аниме, фильм, сериал или мультфильм по музыке: 30 секунд, четыре постера и десять раундов. Новые произведения в каждой партии.',
  'Name That Soundtrack: recognize anime, movies, series and cartoons from music. 30 seconds, four posters and ten rounds, with new titles each game.'
);
try {
  const saved = JSON.parse(localStorage.getItem('opening-played-v1') || '{}');
  for (const key of Object.keys(categoryLabels)) {
    playedByCategory[key] = Array.isArray(saved[key]) ? saved[key].filter(id => typeof id === 'string').slice(-2000) : [];
  }
} catch { /* Private mode or unavailable storage: keep this visit's history in memory. */ }
const fallback = new URL(t('assets/poster-fallback.svg', 'assets/poster-fallback.en.svg'), import.meta.url).href;
const safeImage = image => { image.addEventListener('error', () => { if (image.src !== fallback) image.src = fallback; }); };
const totalScore = () => history.reduce((sum, item) => sum + item.points, 0);

function showScreen(id) {
  for (const screen of ['home', 'game', 'results']) $(screen).hidden = screen !== id;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function cancelPlayback() {
  generation++;
  clearInterval(interval); interval = null;
  request?.abort(); request = null;
  player.stop(); starting = false;
  document.body.classList.remove('is-playing');
}

function renderDots() {
  $('roundDots').replaceChildren(...Array.from({ length: 10 }, (_, i) => {
    const dot = document.createElement('i');
    dot.className = history[i] ? (history[i].correct ? 'right' : 'wrong') : i === history.length ? 'current' : '';
    return dot;
  }));
  $('score').textContent = totalScore();
}

function renderChoices() {
  $('choices').replaceChildren(...choices.map((entry, index) => {
    const button = document.createElement('button');
    button.className = 'choice'; button.disabled = true;
    const figure = document.createElement('figure');
    const img = document.createElement('img'); img.src = entry.poster; img.alt = ''; img.width = 260; img.height = 350;
    img.referrerPolicy = 'no-referrer'; safeImage(img);
    const key = document.createElement('span'); key.className = 'choice-key'; key.textContent = index + 1;
    figure.append(img, key);
    const name = document.createElement('span'); name.className = 'choice-name';
    const title = document.createElement('b'); title.textContent = titleFor(entry);
    const subtitle = document.createElement('small'); subtitle.textContent = entry.titleOriginal;
    subtitle.hidden = title.textContent === entry.titleOriginal;
    name.append(title, subtitle); button.append(figure, name);
    button.addEventListener('click', () => finishRound(entry.animeId));
    return button;
  }));
}

function showFailure(message) {
  if (!interruptRound(round)) return;
  cancelPlayback();
  $('technicalError').hidden = false;
  $('errorText').textContent = message;
  if (round?.entry) reportPlaybackError(t('Угадай по саундтреку', 'Name That Soundtrack'), { id: round.entry.trackId, title: round.entry.trackTitle, artist: round.entry.artist }, message);
  $('playLabel').textContent = t('Эту пластинку не удалось включить', 'This record wouldn’t play');
  $('roundStatus').textContent = t('Раунд не засчитан. Заменим песню без штрафа.', 'This round won’t count. Replace the song without a penalty.');
  $('listenButton').hidden = true;
  for (const button of $('choices').children) button.disabled = true;
}

async function prepareRound(entry) {
  cancelPlayback();
  if (!entry) return showResults();
  const token = generation;
  request = new AbortController();
  round = createRound(entry); round.phase = 'loading';
  choices = buildChoices(entry, catalog);
  renderDots(); renderChoices();
  $('roundNumber').textContent = t(`Раунд ${history.length + 1} / 10`, `Round ${history.length + 1} / 10`);
  $('reveal').hidden = true; $('technicalError').hidden = true; $('roundFoot').hidden = false;
  $('seconds').textContent = '30'; $('timeFill').style.transform = 'scaleX(1)';
  $('seconds').parentElement.classList.remove('urgent');
  $('listenButton').hidden = false; $('listenButton').disabled = true;
  $('playLabel').textContent = t('Готовим отрывок', 'Preparing the clip');
  $('roundStatus').textContent = t('Загружаем музыку. Таймер пока не идёт.', 'Loading the music. The timer hasn’t started yet.');
  showScreen('game'); $('roundTitle').focus({ preventScroll: true });
  try {
    const track = await deezerRequest(`/track/${entry.trackId}`, {}, { signal: request.signal });
    if (token !== generation) return;
    if (Number(track.id) !== entry.trackId || !track.preview) throw new Error(t('У этой песни сейчас нет доступного превью.', 'This song has no preview available right now.'));
    const loaded = await player.load({ preview: track.preview });
    if (!loaded || token !== generation) return;
    if (player.buffer.duration < 29.5) throw new Error(t('Этот отрывок короче 30 секунд. Выберем другую песню.', 'This clip is shorter than 30 seconds. Let’s pick another song.'));
    round.phase = 'ready';
    player.getContext().onstatechange = () => {
      if (token === generation && round?.phase === 'playing' && player.getContext().state !== 'running') {
        showFailure(t('Браузер прервал звук. Заменим этот раунд без штрафа.', 'The browser interrupted the audio. Replace this round without a penalty.'));
      }
    };
    $('playLabel').textContent = t('Все четыре постера на месте', 'All four posters are ready');
    $('roundStatus').textContent = t('Нажми «Слушать» — начнутся твои 30 секунд.', 'Press “Listen” to start your 30 seconds.');
    $('listenButton').disabled = false;
  } catch (error) {
    if (token !== generation || error.name === 'AbortError') return;
    showFailure(errorMessage(error, t('Музыка не загрузилась. Проверь подключение к интернету.', 'The music didn’t load. Check your connection or replace the song without a penalty.')));
  }
}

async function play() {
  if (round?.phase !== 'ready' || starting) return;
  starting = true; $('listenButton').disabled = true;
  const token = generation;
  let timer;
  try {
    const context = player.getContext();
    await Promise.race([context.resume(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(t('Браузер не включил звук. Нажми «Слушать» ещё раз.', 'The browser didn’t start the audio. Press “Listen” again.'))), 5000); })]);
    if (token !== generation) return;
    if (context.state !== 'running') throw new Error(t('Разреши звук для сайта и нажми «Слушать» ещё раз.', 'Allow audio for this site and press “Listen” again.'));
    const source = context.createBufferSource();
    source.buffer = player.buffer; source.connect(player.master); player.source = source;
    source.onended = () => {
      if (token === generation && round?.phase === 'playing' && remainingTime(round, performance.now()) > 1000) {
        showFailure(t('Звук прервался. Этот раунд заменим без штрафа.', 'The audio stopped. Replace this round without a penalty.'));
      }
    };
    source.start(0, 0, Math.min(30, player.buffer.duration));
    startRound(round, performance.now());
    document.body.classList.add('is-playing');
    $('playLabel').textContent = t('Слушай. Это точно знакомо.', 'Listen. You’ve heard this before.');
    $('roundStatus').textContent = t(`Выбери ${categoryLabels[category]} до конца отрывка.`, `Pick the ${categoryLabels[category]} before the clip ends.`);
    $('listenButton').hidden = true;
    for (const button of $('choices').children) button.disabled = false;
    interval = setInterval(tick, 70); tick();
  } catch (error) {
    if (token === generation) {
      $('roundStatus').textContent = errorMessage(error, t('Не удалось включить звук. Нажми «Слушать» ещё раз.', 'Couldn’t start the audio. Allow audio for this site and press “Listen” again.'));
      $('listenButton').disabled = false;
    }
  } finally { clearTimeout(timer); if (token === generation) starting = false; }
}

function tick() {
  if (round?.phase !== 'playing') return;
  const remaining = remainingTime(round, performance.now());
  $('seconds').textContent = Math.ceil(remaining / 1000);
  $('timeFill').style.transform = `scaleX(${remaining / 30000})`;
  $('seconds').parentElement.classList.toggle('urgent', remaining <= 5000);
  if (remaining <= 0) finishRound(null);
}

function finishRound(selectedId) {
  if (!round || !answerRound(round, selectedId, performance.now())) return;
  const timedOut = remainingTime(round, performance.now()) === 0;
  cancelPlayback();
  history.push(round); renderDots();
  const played = playedByCategory[category] || [];
  playedByCategory[category] = played.includes(round.entry.animeId) ? [round.entry.animeId] : [...played, round.entry.animeId];
  try { localStorage.setItem('opening-played-v1', JSON.stringify(playedByCategory)); } catch { /* Memory history still works. */ }
  for (const [index, button] of [...$('choices').children].entries()) {
    button.disabled = true;
    const correct = choices[index].animeId === round.entry.animeId;
    const chosen = choices[index].animeId === selectedId;
    button.classList.add(correct ? 'correct' : chosen ? 'incorrect' : 'dimmed');
    if (correct || chosen) {
      const badge = document.createElement('span'); badge.className = 'choice-badge';
      badge.textContent = correct ? t('✓ Это оно', '✓ That’s it') : t('✕ Твой ответ', '✕ Your answer'); button.append(badge);
    }
  }
  $('playLabel').textContent = round.correct ? t('Попадание с первых нот!', 'Got it from the first notes!') : timedOut ? t('Время вышло', 'Time’s up') : t('Звучало похоже, но…', 'It sounded close, but…');
  $('roundStatus').textContent = t('Правильный ответ уже открыт.', 'The correct answer is now revealed.');
  $('verdict').textContent = round.correct ? t(`Верно! +${round.points} очков`, `Correct! +${round.points} points`) : timedOut ? t('30 секунд закончились. В этот раз — 0 очков.', 'Your 30 seconds are up. No points this time.') : t('Не угадал. Следующий саундтрек будет твоим.', 'Not this time. The next soundtrack could be yours.');
  $('answerTitle').textContent = titleFor(round.entry);
  $('answerSong').textContent = `${round.entry.trackTitle} — ${round.entry.artist}`;
  $('deezerLink').href = `https://www.deezer.com/track/${round.entry.trackId}`;
  $('nextButton').firstChild.textContent = queue.length ? t('Следующий раунд ', 'Next round ') : t('Смотреть результат ', 'See results ');
  $('roundFoot').hidden = true; $('reveal').hidden = false;
  // ответ и «Следующий раунд» появляются под постерами — подкручиваем ровно настолько, чтобы их было видно
  $('reveal').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function startGame() {
  cancelPlayback(); history = []; failures = 0;
  const pool = catalog.filter(entry => (entry.category || 'anime') === category);
  const count = new Set(pool.map(entry => entry.franchiseId)).size;
  const all = buildSession(catalog, count, Math.random, { category, seenIds: playedByCategory[category] || [] });
  if (all.length < 10) return;
  $('roundTitle').textContent = t(`Из какого ${category === 'anime' ? 'аниме' : category === 'film' ? 'фильма' : category === 'series' ? 'сериала' : 'мультфильма'} эта музыка?`, `Which ${categoryLabels[category]} is this music from?`);
  queue = all.slice(0, 10); reserves = all.slice(10);
  prepareRound(queue.shift());
}

function showResults() {
  cancelPlayback(); round = null;
  const correct = history.filter(item => item.correct).length;
  $('resultsTitle').textContent = correct >= 8 ? t('Вот это наслушанность!', 'You’ve got a great ear!') : correct >= 4 ? t('Узнаёшь своих с первых нот.', 'You know your favorites from the first notes.') : t('Твой следующий плейлист готов.', 'Your next playlist is ready.');
  $('resultCorrect').textContent = `${correct} / ${history.length}`;
  $('resultPoints').textContent = t(`${totalScore()} очков`, `${totalScore()} points`);
  $('resultNote').textContent = history.length < 10 ? t(`Доступные песни закончились. Сыграно ${history.length} из 10 раундов; технические замены не считаются ошибками.`, `No more songs are available. You played ${history.length} of 10 rounds; technical replacements don’t count as mistakes.`) : failures ? t(`Недоступных отрывков заменено: ${failures}. Без штрафа.`, `Unavailable clips replaced: ${failures}. No penalty.`) : t('В следующей партии сначала прозвучат ещё не сыгранные произведения.', 'Your next game will start with titles you haven’t played yet.');
  $('playlist').replaceChildren(...history.map((item, index) => {
    const li = document.createElement('li');
    const n = document.createElement('span'); n.className = 'playlist-number'; n.textContent = index + 1;
    const img = document.createElement('img'); img.src = item.entry.poster; img.alt = ''; img.referrerPolicy = 'no-referrer'; safeImage(img);
    const copy = document.createElement('div'); copy.className = 'playlist-copy';
    const title = document.createElement('b'); title.textContent = titleFor(item.entry);
    const song = document.createElement('span'); song.textContent = `${item.entry.trackTitle} — ${item.entry.artist}`;
    copy.append(title, song);
    const link = document.createElement('a'); link.href = `https://www.deezer.com/track/${item.entry.trackId}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Deezer ↗';
    const points = document.createElement('span'); points.className = `playlist-result${item.correct ? '' : ' miss'}`; points.textContent = item.correct ? `+${item.points}` : '✕';
    li.append(n, img, copy, link, points); return li;
  }));
  showScreen('results'); $('resultsTitle').focus({ preventScroll: true });
}

$('startButton').addEventListener('click', startGame);
$('againButton').addEventListener('click', startGame);
$('nextButton').addEventListener('click', () => prepareRound(queue.shift()));
$('replaceButton').addEventListener('click', () => { failures++; prepareRound(reserves.shift() || queue.pop()); });
$('listenButton').addEventListener('click', play);
for (const id of ['exitButton', 'homeButton']) $(id).addEventListener('click', () => { cancelPlayback(); round = null; showScreen('home'); $('startButton').focus(); });
$('volume').addEventListener('input', event => player.setVolume(event.target.value / 100));
$('rulesButton').addEventListener('click', () => $('rules').showModal());
$('closeRules').addEventListener('click', () => $('rules').close());
function selectCategory(key) {
  category = key;
  const pool = catalog.filter(entry => (entry.category || 'anime') === key);
  for (const button of document.querySelectorAll('[data-category]')) {
    const active = button.dataset.category === key;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  }
  $('catalogCount').textContent = t(`Произведений в подборке: ${pool.length}`, `Titles in this collection: ${pool.length}`);
  $('posterFan').replaceChildren(...pool.slice(0, 3).map(entry => {
    const image = document.createElement('img'); image.src = entry.poster; image.alt = ''; image.referrerPolicy = 'no-referrer'; safeImage(image); return image;
  }));
  $('startButton').disabled = pool.length < 10;
}
for (const button of document.querySelectorAll('[data-category]')) button.addEventListener('click', () => selectCategory(button.dataset.category));
$('rules').addEventListener('click', event => { if (event.target === $('rules')) { const box = $('rules').getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) $('rules').close(); } });
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || $('rules').open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (/^[1-4]$/.test(event.key) && round?.phase === 'playing') { event.preventDefault(); finishRound(choices[Number(event.key) - 1].animeId); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
window.addEventListener('pagehide', cancelPlayback);
window.addEventListener('pageshow', event => {
  if (event.persisted && round) showFailure(t('Ты вернулся в игру после перехода на другую страницу. Прерванный раунд заменим без штрафа.', 'You returned after leaving the page. Replace the interrupted round without a penalty.'));
});

try {
  const response = await fetch(new URL('data/catalog.json?v=collections-20261026', import.meta.url));
  if (!response.ok) throw new Error(t('Каталог не загрузился. Обнови страницу, чтобы попробовать снова.', 'The catalog didn’t load. Refresh the page to try again.'));
  const data = await response.json();
  catalog = data.entries;
  buildSession(catalog, 10);
  for (const button of document.querySelectorAll('[data-category]')) {
    const count = catalog.filter(entry => (entry.category || 'anime') === button.dataset.category).length;
    button.querySelector('small').textContent = t(`В подборке: ${count}`, `In this collection: ${count}`);
    button.disabled = count < 10;
  }
  selectCategory('anime');
} catch (error) { $('homeStatus').textContent = errorMessage(error, t('Не удалось загрузить игру. Обнови страницу.', 'The game couldn’t load. Refresh the page to try again.')); $('catalogCount').textContent = t('Каталог недоступен', 'Catalog unavailable'); }
