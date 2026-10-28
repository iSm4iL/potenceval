import { buildSession, buildChoices, createRound, startRound, answerRound, remainingTime, interruptRound } from './game.js?v=collections-20261026';
import { deezerRequest } from '../music/service.js';
import { AudioPlayer } from '../music/audio.js';
import { reportPlaybackError } from '../shared/diagnostics.js';

const $ = id => document.getElementById(id);
const player = new AudioPlayer();
let catalog = [], queue = [], reserves = [], history = [], round = null, choices = [];
let interval = null, request = null, generation = 0, starting = false, failures = 0;
let category = 'anime', playedByCategory = {};
const categoryLabels = { anime:'аниме', film:'фильм', series:'сериал', cartoon:'мультфильм' };
try {
  const saved = JSON.parse(localStorage.getItem('opening-played-v1') || '{}');
  for (const key of Object.keys(categoryLabels)) {
    playedByCategory[key] = Array.isArray(saved[key]) ? saved[key].filter(id => typeof id === 'string').slice(-2000) : [];
  }
} catch { /* Private mode or unavailable storage: keep this visit's history in memory. */ }
const fallback = new URL('assets/poster-fallback.svg', import.meta.url).href;
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
    const title = document.createElement('b'); title.textContent = entry.titleRu;
    const subtitle = document.createElement('small'); subtitle.textContent = entry.titleOriginal;
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
  if (round?.entry) reportPlaybackError('Угадай опенинг', { id: round.entry.trackId, title: round.entry.trackTitle, artist: round.entry.artist }, message);
  $('playLabel').textContent = 'Эту пластинку не удалось включить';
  $('roundStatus').textContent = 'Раунд не засчитан. Заменим песню без штрафа.';
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
  $('roundNumber').textContent = `Раунд ${history.length + 1} / 10`;
  $('reveal').hidden = true; $('technicalError').hidden = true; $('roundFoot').hidden = false;
  $('seconds').textContent = '30'; $('timeFill').style.transform = 'scaleX(1)';
  $('seconds').parentElement.classList.remove('urgent');
  $('listenButton').hidden = false; $('listenButton').disabled = true;
  $('playLabel').textContent = 'Готовим отрывок';
  $('roundStatus').textContent = 'Загружаем музыку. Таймер пока не идёт.';
  showScreen('game'); $('roundTitle').focus({ preventScroll: true });
  try {
    const track = await deezerRequest(`/track/${entry.trackId}`, {}, { signal: request.signal });
    if (token !== generation) return;
    if (Number(track.id) !== entry.trackId || !track.preview) throw new Error('У этой песни сейчас нет доступного превью.');
    const loaded = await player.load({ preview: track.preview });
    if (!loaded || token !== generation) return;
    if (player.buffer.duration < 29.5) throw new Error('Этот отрывок короче 30 секунд. Выберем другую песню.');
    round.phase = 'ready';
    player.getContext().onstatechange = () => {
      if (token === generation && round?.phase === 'playing' && player.getContext().state !== 'running') {
        showFailure('Браузер прервал звук. Заменим этот раунд без штрафа.');
      }
    };
    $('playLabel').textContent = 'Все четыре постера на месте';
    $('roundStatus').textContent = 'Нажми «Слушать» — начнутся твои 30 секунд.';
    $('listenButton').disabled = false;
  } catch (error) {
    if (token !== generation || error.name === 'AbortError') return;
    showFailure(error.message || 'Музыка не загрузилась. Проверь подключение к интернету.');
  }
}

async function play() {
  if (round?.phase !== 'ready' || starting) return;
  starting = true; $('listenButton').disabled = true;
  const token = generation;
  let timer;
  try {
    const context = player.getContext();
    await Promise.race([context.resume(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Браузер не включил звук. Нажми «Слушать» ещё раз.')), 5000); })]);
    if (token !== generation) return;
    if (context.state !== 'running') throw new Error('Разреши звук для сайта и нажми «Слушать» ещё раз.');
    const source = context.createBufferSource();
    source.buffer = player.buffer; source.connect(player.master); player.source = source;
    source.onended = () => {
      if (token === generation && round?.phase === 'playing' && remainingTime(round, performance.now()) > 1000) {
        showFailure('Звук прервался. Этот раунд заменим без штрафа.');
      }
    };
    source.start(0, 0, Math.min(30, player.buffer.duration));
    startRound(round, performance.now());
    document.body.classList.add('is-playing');
    $('playLabel').textContent = 'Слушай. Это точно знакомо.';
    $('roundStatus').textContent = `Выбери ${categoryLabels[category]} до конца отрывка.`;
    $('listenButton').hidden = true;
    for (const button of $('choices').children) button.disabled = false;
    interval = setInterval(tick, 70); tick();
  } catch (error) {
    if (token === generation) {
      $('roundStatus').textContent = error.message;
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
      badge.textContent = correct ? '✓ Это оно' : '✕ Твой ответ'; button.append(badge);
    }
  }
  $('playLabel').textContent = round.correct ? 'Попадание с первых нот!' : timedOut ? 'Время вышло' : 'Звучало похоже, но…';
  $('roundStatus').textContent = 'Правильный ответ уже открыт.';
  $('verdict').textContent = round.correct ? `Верно! +${round.points} очков` : timedOut ? '30 секунд закончились. В этот раз — 0 очков.' : 'Не угадал. Следующий саундтрек будет твоим.';
  $('answerTitle').textContent = round.entry.titleRu;
  $('answerSong').textContent = `${round.entry.trackTitle} — ${round.entry.artist}`;
  $('deezerLink').href = `https://www.deezer.com/track/${round.entry.trackId}`;
  $('nextButton').firstChild.textContent = queue.length ? 'Следующий раунд ' : 'Смотреть результат ';
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
  $('roundTitle').textContent = `Из какого ${category === 'anime' ? 'аниме' : category === 'film' ? 'фильма' : category === 'series' ? 'сериала' : 'мультфильма'} эта музыка?`;
  queue = all.slice(0, 10); reserves = all.slice(10);
  prepareRound(queue.shift());
}

function showResults() {
  cancelPlayback(); round = null;
  const correct = history.filter(item => item.correct).length;
  $('resultsTitle').textContent = correct >= 8 ? 'Вот это наслушанность!' : correct >= 4 ? 'Узнаёшь своих с первых нот.' : 'Твой следующий плейлист готов.';
  $('resultCorrect').textContent = `${correct} / ${history.length}`;
  $('resultPoints').textContent = `${totalScore()} очков`;
  $('resultNote').textContent = history.length < 10 ? `Доступные песни закончились. Сыграно ${history.length} из 10 раундов; технические замены не считаются ошибками.` : failures ? `Недоступных отрывков заменено: ${failures}. Без штрафа.` : 'В следующей партии сначала прозвучат ещё не сыгранные произведения.';
  $('playlist').replaceChildren(...history.map((item, index) => {
    const li = document.createElement('li');
    const n = document.createElement('span'); n.className = 'playlist-number'; n.textContent = index + 1;
    const img = document.createElement('img'); img.src = item.entry.poster; img.alt = ''; img.referrerPolicy = 'no-referrer'; safeImage(img);
    const copy = document.createElement('div'); copy.className = 'playlist-copy';
    const title = document.createElement('b'); title.textContent = item.entry.titleRu;
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
  $('catalogCount').textContent = `Произведений в подборке: ${pool.length}`;
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
  if (event.persisted && round) showFailure('Ты вернулся в игру после перехода на другую страницу. Прерванный раунд заменим без штрафа.');
});

try {
  const response = await fetch(new URL('data/catalog.json?v=collections-20261026', import.meta.url));
  if (!response.ok) throw new Error('Каталог не загрузился. Обнови страницу, чтобы попробовать снова.');
  const data = await response.json();
  catalog = data.entries;
  buildSession(catalog, 10);
  for (const button of document.querySelectorAll('[data-category]')) {
    const count = catalog.filter(entry => (entry.category || 'anime') === button.dataset.category).length;
    button.querySelector('small').textContent = `В подборке: ${count}`;
    button.disabled = count < 10;
  }
  selectCategory('anime');
} catch (error) { $('homeStatus').textContent = error.message || 'Не удалось загрузить игру. Обнови страницу.'; $('catalogCount').textContent = 'Каталог недоступен'; }
