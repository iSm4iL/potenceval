import { $, esc, LS, toast, enter, confetti } from '../shared/kit.js';
import { LENGTHS, POINTS, ARTIST_BONUS, createGame, guess, guessArtist, skip, openStep, surrender, nextRound, replaceBroken, restoreGame } from './game.js?v=covers-1';
import { PACKS, combineSuggestions, combineArtistSuggestions, artistOptions, snapshotTrack, sameArtist } from './catalog.js?v=dead-inside-1';
import { createDeezerClient } from './service.js?v=audio-20261023';
import { AudioPlayer } from './audio.js?v=silence-1';
import { resultPresentation } from './feedback.js?v=bonus-1';
import { createCatalogClient } from './collection.js';
import { createMultiplayer } from './multiplayer.js?v=friends-20261025-2';

const stage = $('#stage'), player = new AudioPlayer(), service = createDeezerClient(), catalog = createCatalogClient();
const stored = LS.get('music.online.settings') || {};
const settings = { mode: stored.mode === 'current' ? 'current' : 'hits', answerMode: stored.answerMode === 'artist' ? 'artist' : 'track', pack: PACKS.some(p => p.id === stored.pack) ? stored.pack : PACKS[0].id, rounds: [5, 10, 20].includes(stored.rounds) ? stored.rounds : 10, volume: Number.isFinite(stored.volume) && stored.volume >= 0 && stored.volume <= 1 ? stored.volume : 0.7 };
player.setVolume(settings.volume);
let customPack = null, state = null, savedGame = restoreGame(LS.get('music.online.session'));
let availableRounds = [], genreCounts = {}, pool = [], packInfo = null, packLoading = false, packError = '', packVersion = 0, packController;
// busy — грузим превью; playing — отрывок звучит (в это время можно писать ответ и остановить звук)
let screenVersion = 0, audioVersion = 0, audioController, busy = false, ready = false, heard = false, playing = false;
let renderedRoundKey = null;
// Подсказки новичку: каждая уходит, когда сделал её шаг; прошёл все — больше не показываем.
let coach = new Set(LS.get('music.online.coach') ? [] : [1, 2, 3]);
// ask — клавиша, ждущая второго нажатия; autoPlay — сыграть сразу после открытия длинного отрывка.
let ask = -1, askTimer, autoPlay = false, keyStep = { key: null, step: 0 };
let selectedTrack = null, matches = [], highlighted = -1, searchVersion = 0, searchTimer, searchController, artistTimer, artistController;
const cache = new Map();
const preloaded = new Map(); // id трека → Promise<{ full, buffer }>: следующая песня грузится, пока угадываете текущую
const number = n => n.toLocaleString('ru-RU');
const trackPlural = new Intl.PluralRules('ru');
const trackCount = n => `${number(n)} ${{ one: 'трек', few: 'трека', many: 'треков', other: 'треков' }[trackPlural.select(n)]}`;
const length = n => String(n).replace('.', ',');
const trackById = id => state?.tracks.find(t => t.id === id) || pool.find(t => t.id === id);
const currentPack = () => PACKS.find(p => p.id === settings.pack) || customPack || PACKS[0];
const artistMode = () => state?.answerMode === 'artist';
const emptyPackMessage = pack => settings.mode === 'current' && pack.curated ? 'Сейчас в свежем топ-100 нет подходящих песен этого жанра. Выбери «Знакомые хиты» или другой жанр.' : 'В этой подборке сейчас нет доступных песен. Выбери другую.';
const persistSettings = () => LS.set('music.online.settings', settings);
const persistGame = () => { if (!multiplayer.active) { savedGame = state; LS.set('music.online.session', state); } };

function leave() {
  if (multiplayer.active) { multiplayer.leave(); return; }
  screenVersion++; audioController?.abort(); player.stop(); closeSuggestions(); state = null; renderedRoundKey = null; renderSetup();
}

async function selectPack(pack, refresh = false) {
  packController?.abort();
  const controller = packController = new AbortController(), version = ++packVersion;
  settings.pack = pack.id; persistSettings(); packError = ''; pool = []; packInfo = null;
  const cacheKey = `${pack.id}:${settings.mode}`;
  const saved = cache.get(cacheKey);
  if (!refresh && saved && Date.now() - saved.loadedAt < 300000) { pool = saved.tracks; packInfo = saved; genreCounts = saved.counts || genreCounts; packError = pool.length ? '' : emptyPackMessage(pack); setAvailableRounds(); packLoading = false; renderSetup(); return; }
  packLoading = true; renderSetup();
  try {
    const result = pack.curated ? await catalog.load(pack.id, { mode: settings.mode, signal: controller.signal, refresh }) : await service.loadPack(pack, { signal: controller.signal });
    if (version !== packVersion) return;
    if (refresh && pack.curated) cache.clear();
    pool = result.tracks; packInfo = result; genreCounts = result.counts || genreCounts; setAvailableRounds(); cache.set(cacheKey, result);
    if (!pool.length) packError = emptyPackMessage(pack);
  } catch (error) { if (version === packVersion && error.name !== 'AbortError') packError = error.message; }
  finally { if (version === packVersion) { packLoading = false; renderSetup(); } }
}

function renderSetup() {
  if (state || multiplayer.active) return;
  $('#exitBtn').hidden = true;
  const pack = currentPack(), packs = [...PACKS, ...(customPack ? [customPack] : [])];
  const cards = items => items.map((p, index) => `<button class="pack-card ${settings.pack === p.id ? 'selected' : ''}" data-pack="${esc(p.id)}" aria-pressed="${settings.pack === p.id}" style="--sleeve:${index + 1}"><span class="pack-art" aria-hidden="true"><span class="pack-disc"><span class="pack-disc-label"></span></span><span class="pack-sleeve"><span class="pack-art-icon">${p.icon || '♫'}</span><span class="pack-art-title">${esc(p.title)}</span><span class="pack-art-mark">полсекунды</span></span></span><span class="pack-meta"><b>${esc(p.title)}</b><small>${esc(p.description || 'Популярные треки исполнителя')}</small></span>${p.curated && !packLoading && packInfo ? `<span class="pack-count">${trackCount(genreCounts[p.id] || 0)}</span>` : ''}<span class="pack-selected" aria-hidden="true">✓</span></button>`).join('');
  const choices = [...new Set([...availableRounds.filter(n => n < 5), 5, 10, 20])];
  stage.dispatchEvent(new Event('music:before-setup'));
  stage.innerHTML = `<section class="music-home"><div class="music-intro"><div><span class="kicker">Музыкальная угадайка для друзей</span><h1>Полсекунды<i>.</i></h1><p class="sub">Выбирай пластинку. Узнавай трек с первых нот.</p></div><div class="intro-side"><span class="intro-pulse" aria-hidden="true">♫</span><p>От 0,5 секунды до полного ответа.<br>Один экран для всей компании.</p></div></div>
    ${savedGame && savedGame.phase !== 'summary' ? `<div class="resume-card"><p>Незаконченная партия: ${esc(savedGame.packTitle || 'Музыка')}. Счёт: ${number(savedGame.score)}.</p><button class="btn gold" id="resumeBtn">Продолжить игру</button></div>` : ''}
    <div class="crate-heading"><div><h2>Выбери свою пластинку</h2><p>Какую музыку сегодня угадываем?</p></div><div class="catalog-modes" aria-label="Тип подборки"><button data-mode="hits" class="${settings.mode === 'hits' ? 'selected' : ''}" aria-pressed="${settings.mode === 'hits'}">Знакомые хиты</button><button data-mode="current" class="${settings.mode === 'current' ? 'selected' : ''}" aria-pressed="${settings.mode === 'current'}">Сейчас в чартах</button></div></div>
    <div class="pack-list">${cards(packs)}</div>
    <div class="answer-mode-picker"><span>Что угадываем?</span><div class="catalog-modes" role="group" aria-label="Режим ответа"><button data-answer-mode="track" class="${settings.answerMode === 'track' ? 'selected' : ''}" aria-pressed="${settings.answerMode === 'track'}">Песню</button><button data-answer-mode="artist" class="${settings.answerMode === 'artist' ? 'selected' : ''}" aria-pressed="${settings.answerMode === 'artist'}">Исполнителя / группу</button></div><small>${settings.answerMode === 'artist' ? 'Достаточно назвать артиста или группу. Название песни знать не нужно.' : 'Нужно выбрать песню. Угаданный исполнитель даст подсказку.'}</small></div>
    <div class="setup-panel"><div class="setup-choice"><div><span class="choice-label">Твой выбор</span><h3>${esc(pack.title)}</h3><p>${pack.curated ? 'Разные исполнители. До двух песен каждого за партию.' : 'Популярные песни одного исполнителя.'}</p><button class="lineup-button" id="lineupBtn" aria-haspopup="dialog" ${packLoading || !pool.length ? 'disabled' : ''}><span aria-hidden="true">ⓘ</span> Исполнители</button><p class="pack-status ${packError ? 'failed' : ''}" id="packStatus" role="status">${packLoading ? 'Собираем треки…' : packError ? esc(packError) : `${trackCount(pool.length)} в подборке`}</p></div><button class="artist-picker" id="artistPicker">＋ Свой исполнитель</button></div>
      <div class="setup-actions"><div class="setting-label">Сколько треков сыграем?<div class="round-options">${choices.map(n => `<button class="round-choice ${settings.rounds === n ? 'selected' : ''}" data-rounds="${n}" aria-pressed="${settings.rounds === n}" ${packLoading || !availableRounds.includes(n) ? 'disabled' : ''}>${n}</button>`).join('')}</div></div><button class="btn primary big" id="startBtn" ${packLoading || packError || !availableRounds.includes(settings.rounds) ? 'disabled' : ''}>${packLoading ? 'Собираем треки…' : 'Начать игру'}</button></div>
      <div class="setup-footer"><span>Короткие онлайн-превью Deezer, без подписки.</span><button class="library-btn" id="refreshPack">${packError ? 'Попробовать ещё раз' : 'Обновить подборку'}</button></div>${packInfo?.failures?.length ? `<p class="source-note">Не удалось получить: ${esc(packInfo.failures.join(', '))}. Остальные исполнители доступны.</p>` : ''}</div></section>`;
  stage.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => { settings.mode = button.dataset.mode; genreCounts = {}; selectPack(currentPack()); });
  stage.querySelectorAll('[data-pack]').forEach(button => button.onclick = () => selectPack(packs.find(p => p.id === button.dataset.pack)));
  stage.querySelectorAll('[data-rounds]').forEach(button => button.onclick = () => { settings.rounds = Number(button.dataset.rounds); persistSettings(); renderSetup(); });
  stage.querySelectorAll('[data-answer-mode]').forEach(button => button.onclick = () => { settings.answerMode = button.dataset.answerMode; persistSettings(); renderSetup(); });
  const friends = document.createElement('button'); friends.id = 'friendsBtn'; friends.className = 'btn gold big'; friends.textContent = '♬  Играть с друзьями'; friends.onclick = () => multiplayer.open();
  $('#startBtn').after(friends);
  $('#startBtn').onclick = startGame; $('#refreshPack').onclick = () => selectPack(currentPack(), true);
  $('#artistPicker').onclick = () => { $('#artistDialog').showModal(); $('#artistInput').focus(); };
  $('#lineupBtn').onclick = () => {
    $('#lineupTitle').textContent = `Исполнители: ${pack.title}`;
    const names = [...new Set(pool.flatMap(track => track.artistNames || [track.artist]))].sort((a, b) => a.localeCompare(b, 'ru'));
    $('#lineupList').innerHTML = names.map(name => `<li>${esc(name)}</li>`).join('');
    $('#lineupDialog').showModal();
  };
  $('#resumeBtn')?.addEventListener('click', () => { state = savedGame; renderGame(); });
}

function startGame() {
  if (packLoading || packError || !pool.length) return;
  const recent = LS.get('music.online.recent');
  try {
    state = createGame(pool, { rounds: settings.rounds, answerMode: settings.answerMode, maxPerArtist: currentPack().curated ? 2 : Infinity, recent: Array.isArray(recent) ? recent : [] });
    state.packTitle = currentPack().title + (currentPack().curated && settings.mode === 'current' ? ' · Сейчас в чартах' : ''); state.packId = settings.pack;
    persistSettings(); persistGame(); renderGame();
  } catch (error) { toast(error.message, 5000); }
}

function makeFriendMatch() {
  if (packLoading || packError || !pool.length) throw new Error('Подборка ещё не готова. Дождись загрузки или выбери другую пластинку.');
  return { ...createGame(pool, { rounds: settings.rounds, answerMode: settings.answerMode, maxPerArtist: currentPack().curated ? 2 : Infinity }), packTitle: currentPack().title + (currentPack().curated && settings.mode === 'current' ? ' · Сейчас в чартах' : ''), packId: settings.pack };
}

function apply(next, focusAnswer = false) { state = next; if (state.phase === 'reveal') rememberPlayed(); persistGame(); renderGame(focusAnswer); }

function rememberPlayed() {
  const recent = LS.get('music.online.recent');
  const keys = state.results.flatMap(r => { const t = trackById(r.id); return [t?.id, t?.answerKey, t?.workKey].filter(Boolean); });
  LS.set('music.online.recent', [...new Set([...(Array.isArray(recent) ? recent : []).filter(k => !keys.includes(k)), ...keys])].slice(-900));
}

function setAvailableRounds() {
  availableRounds = [5, 10, 20].filter(rounds => {
    try { createGame(pool, { rounds, maxPerArtist: currentPack().curated ? 2 : Infinity, random: () => 0.5 }); return true; } catch { return false; }
  });
  if (!availableRounds.length) {
    for (let rounds = Math.min(4, pool.length); rounds > 0; rounds--) {
      try { createGame(pool, { rounds, maxPerArtist: currentPack().curated ? 2 : Infinity }); availableRounds = [rounds]; break; } catch {}
    }
  }
  if (!availableRounds.includes(settings.rounds)) settings.rounds = availableRounds.at(-1) || 5;
}

function renderGame(focusAnswer = false) {
  const key = `${state.index}:${state.queue[state.index]}`, sameRound = key === renderedRoundKey;
  screenVersion++; audioController?.abort(); player.stop(); closeSuggestions();
  busy = false; ready = false; playing = false; heard = heard && sameRound; selectedTrack = null; matches = []; highlighted = -1;
  renderedRoundKey = key;
  $('#exitBtn').hidden = false;
  if (state.phase === 'summary') { renderSummary(); if (multiplayer.active) multiplayer.decorate(); stage.scrollIntoView({ block: 'start' }); return; }
  const track = trackById(state.queue[state.index]);
  if (state.phase === 'reveal') renderReveal(track); else renderRound();
  stage.scrollIntoView({ block: 'start' });
  prepareAudio(track, screenVersion, focusAnswer);
  if (multiplayer.active) multiplayer.decorate();
}

const coachHTML = (n, text) => coach.has(n) ? `<div class="coach" data-coach="${n}"><b>${n}</b><span>${text}</span><button type="button" class="coach-x" aria-label="Скрыть подсказку">✕</button></div>` : '';
function coachDone(n) {
  if (!coach.delete(n)) return;
  const el = $(`[data-coach="${n}"]`); if (el) { el.classList.add('bye'); setTimeout(() => el.remove(), 350); }
  if (!coach.size) LS.set('music.online.coach', true);
  const help = $('#helpBtn'); if (help) help.hidden = coach.size > 0;
}

// Полоска проигрывания: заполняется и считает секунды, пока звучит отрывок.
const progressHTML = seconds => `<div class="play-line" aria-hidden="true"><span class="pl-time" id="plTime">0,0</span><div class="pl-track"><span class="pl-fill" id="plFill"></span></div><span class="pl-total">${length(seconds)} с</span></div>`;
let progressFrame = 0;
function runProgress(seconds, version) {
  cancelAnimationFrame(progressFrame);
  const fill = $('#plFill'), time = $('#plTime'), started = performance.now();
  if (!fill) return;
  const tick = now => {
    if (version !== screenVersion || !playing) return;
    const elapsed = Math.min(seconds, (now - started) / 1000);
    fill.style.width = `${elapsed / seconds * 100}%`; time.textContent = elapsed.toFixed(1).replace('.', ',');
    if (elapsed < seconds) progressFrame = requestAnimationFrame(tick);
  };
  progressFrame = requestAnimationFrame(tick);
}
function resetProgress() {
  cancelAnimationFrame(progressFrame);
  const fill = $('#plFill'); if (!fill) return;
  fill.style.width = '0'; $('#plTime').textContent = '0,0';
}

// Раунд — музыкальный автомат: купол с пластинкой, большая кнопка, клавиши длин.
function jukeboxHTML() {
  const s = state.step, newRound = keyStep.key !== renderedRoundKey, fresh = newRound ? s : keyStep.step;
  keyStep = { key: renderedRoundKey, step: s };
  return `<div class="jukebox${newRound ? ' arriving' : ''}" id="listenCard">
    <div class="jb-top"><span class="jb-sign">Полсекунды</span><div class="jb-tools"><button type="button" class="help-btn" id="helpBtn" ${coach.size ? 'hidden' : ''}>? Подсказки</button><label class="volume"><span>Звук</span><input id="volume" type="range" min="0" max="1" step="0.05" value="${settings.volume}" aria-label="Громкость"></label></div></div>
    <div class="jb-dome"><div class="jb-glass">
      <div class="jb-marquee">★ за ответ сейчас <b>${POINTS[s]}</b> очков ★</div>
      <div class="jb-record" aria-hidden="true"></div>
      <button class="jb-play" id="playBtn" aria-label="Слушать отрывок" disabled><span class="record-symbol" aria-hidden="true">▶</span></button>
      <div class="jb-cap"><b>${length(LENGTHS[s])} с</b>музыки</div>
    </div></div>
    ${progressHTML(LENGTHS[s])}
    <div class="jb-status play-status" id="playStatus" role="status">Готовим онлайн-превью…</div>
    ${coachHTML(1, 'Жми большую кнопку — сыграет кусочек песни. Повторять можно сколько угодно.')}
    <div class="jb-keys" id="jbKeys" role="group" aria-label="Длина отрывка">${LENGTHS.map((n, i) => `<button type="button" class="jb-key ${i === s ? 'current' : i < s ? 'opened' : 'locked'}${i > fresh && i <= s ? ' just' : ''}" data-step="${i}" ${i === s ? 'aria-current="step"' : ''}><i></i>${length(n)} с<small>${POINTS[i]}</small></button>`).join('')}</div>
    <button type="button" class="jb-more" id="skipBtn" disabled>${s === LENGTHS.length - 1 ? 'Не узнал — показать ответ' : `Не узнал? Слушать ${length(LENGTHS[s + 1])} с <small>· за ответ станет ${POINTS[s + 1]}</small>`}</button>
    ${coachHTML(2, 'Не узнал — жми «Слушать дольше» или сразу любую клавишу. Чем длиннее кусок, тем меньше очков.')}
  </div><div class="audio-error" id="audioError" role="alert" hidden><p id="audioErrorText"></p><button class="btn ghost" id="retryAudio">Попробовать ещё раз</button><button class="btn ghost" id="replaceTrack">Заменить без штрафа</button></div>`;
}

// Закрытая клавиша открывается вторым нажатием: случайный тап не сжигает очки.
function markAsk() {
  document.querySelectorAll('.jb-key').forEach(b => {
    const i = Number(b.dataset.step), on = i === ask;
    b.classList.toggle('ask', on);
    if (on) b.dataset.ask = `Ещё раз\n−${POINTS[state.step] - POINTS[i]}`;
  });
}
function pressKey(i) {
  if (busy || !ready) return;
  if (i <= state.step) return listen();
  if (ask !== i) { ask = i; clearTimeout(askTimer); askTimer = setTimeout(() => { ask = -1; markAsk(); }, 3000); return markAsk(); }
  coachDone(2); autoPlay = heard; if (multiplayer.active) multiplayer.send('open', { index: i }); else apply(openStep(state, i));
}

function playerHTML(reveal = false) {
  if (!reveal) return jukeboxHTML();
  return `<div class="listen-card ${reveal ? 'result-player' : ''}" id="listenCard">
    <div class="listen-top"><span>${reveal ? 'Онлайн-превью · Deezer' : `За ответ сейчас: ${POINTS[state.step]} очков`}</span><label class="volume"><span>Звук</span><input id="volume" type="range" min="0" max="1" step="0.05" value="${settings.volume}" aria-label="Громкость"></label></div>
    <div class="player-body"><button class="record-button" id="playBtn" aria-label="Слушать отрывок" disabled><span class="vinyl" aria-hidden="true"></span><span class="record-symbol" aria-hidden="true">▶</span></button><div class="player-copy"><div class="duration-line"><b>${reveal ? 15 : length(LENGTHS[state.step])}</b>с музыки</div><div class="play-status" id="playStatus" role="status">Готовим онлайн-превью…</div></div></div>${progressHTML(15)}
    ${!reveal ? `<ol class="length-steps" aria-label="Открытые отрывки">${LENGTHS.map((n, i) => `<li class="${i === state.step ? 'current' : i < state.step ? 'opened' : ''}" ${i === state.step ? 'aria-current="step"' : ''}>${length(n)} с<small>${POINTS[i]} очков</small></li>`).join('')}</ol>` : ''}
    </div><div class="audio-error" id="audioError" role="alert" hidden><p id="audioErrorText"></p><button class="btn ghost" id="retryAudio">Попробовать ещё раз</button>${reveal ? '' : '<button class="btn ghost" id="replaceTrack">Заменить без штрафа</button>'}</div>`;
}

const statusLabel = { wrong: 'Не та песня', artist: 'Исполнитель угадан', correct: 'Точно!' };
function historyHTML() {
  return `<section class="attempt-history" aria-labelledby="attemptTitle"><div class="history-heading"><h2 id="attemptTitle">Ваши попытки <small>${state.attempts.length}/6</small></h2><span><i class="legend-dot wrong"></i>Мимо ${artistMode() ? '' : '<i class="legend-dot artist"></i>Исполнитель'} <i class="legend-dot correct"></i>Точно</span></div>${state.attempts.length ? `<ol aria-label="Последняя попытка сверху">${[...state.attempts].reverse().map(a => `<li class="attempt ${a.status}"><span class="attempt-symbol" aria-hidden="true">${a.status === 'correct' ? '✓' : a.status === 'artist' ? '≈' : '×'}</span><div><b>${esc(a.kind === 'artist' ? a.name : a.title)}</b>${a.kind === 'artist' ? '' : `<small>${esc(a.artist)}</small>`}<span class="attempt-verdict">${artistMode() && a.status === 'wrong' ? 'Другой исполнитель' : statusLabel[a.status]} · ${length(LENGTHS[a.step])} с</span></div></li>`).join('')}</ol>` : '<p class="history-empty">Здесь появятся ваши ответы.<br>Последняя попытка всегда сверху.</p>'}</section>`;
}

function roundHeader() {
  return `<div class="round-top" data-pack-id="${esc(state.packId || '')}" data-pack-title="${esc(state.packTitle || '')}"><div><h1>${state.phase === 'reveal' ? 'Ответ на раунд' : artistMode() ? 'Кто исполняет этот трек?' : 'Угадай этот трек'}</h1><p>Раунд ${state.index + 1} из ${state.queue.length} · ${esc(state.packTitle || 'Музыка')} · ${artistMode() ? 'Угадываем исполнителя' : 'Угадываем песню'}</p></div><div class="total-score"><b>${number(state.score)}</b> очков</div></div>`;
}

function attemptFeedbackHTML() {
  const last = state.attempts.at(-1);
  return last ? `<div class="round-feedback ${last.status}" id="roundFeedback" role="status"><b>${artistMode() ? 'Другой исполнитель. Попробуйте ещё.' : last.status === 'artist' ? `Исполнитель тот самый — +${ARTIST_BONUS} уже ваши. Угадаете песню — будет больше.` : 'Не та песня. Попробуйте ещё.'}</b><span>${last.kind === 'artist' ? esc(last.name) : `${esc(last.artist)} — ${esc(last.title)}`}</span></div>` : `<p class="answer-hint">Можно писать с опечатками и русскими буквами. Enter — выбрать ${artistMode() ? 'исполнителя' : 'песню'}, ещё раз Enter — ответить. Пробел — играть/стоп.</p>`;
}

function bindPlayer() {
  $('#playBtn').onclick = listen;
  $('#volume').oninput = e => { settings.volume = Number(e.target.value); player.setVolume(settings.volume); persistSettings(); };
  $('#retryAudio').onclick = () => prepareAudio(trackById(state.queue[state.index]), screenVersion);
  $('#replaceTrack')?.addEventListener('click', () => { if (multiplayer.active) return; toast('Песня заменена без штрафа.', 3000); apply(replaceBroken(state)); });
}

function renderRound() {
  stage.innerHTML = `<section class="game-shell">${roundHeader()}<div class="round-layout"><div class="round-main">${playerHTML()}
    <form class="guess-form" id="guessForm" autocomplete="off"><label for="answerInput">${artistMode() ? 'Группа или исполнитель' : 'Название песни или исполнитель'}</label><div class="answer-row"><div class="search-wrap"><input class="field" id="answerInput" placeholder="${artistMode() ? 'Например, Металлика…' : 'Кажется, я знаю…'}" role="combobox" aria-autocomplete="list" aria-controls="suggestions" aria-expanded="false" spellcheck="false" maxlength="180" disabled><ul class="suggestions" id="suggestions" role="listbox" aria-label="${artistMode() ? 'Исполнители' : 'Песни'}" hidden></ul></div><button class="btn primary" id="guessBtn" type="submit" disabled>Ответить</button></div>${coachHTML(3, artistMode() ? 'Узнал — пиши имя артиста или группы и выбери исполнителя из списка. Название песни не нужно.' : 'Узнал — пиши название или исполнителя и выбери песню из списка.')}<button class="give-up" id="surrenderBtn" type="button" disabled>Сдаться и посмотреть ответ</button></form>${attemptFeedbackHTML()}</div>${historyHTML()}</div></section>`;
  bindPlayer();
  $('#answerInput').oninput = () => { selectedTrack = null; updateSuggestions(); updateControls(); };
  $('#answerInput').onkeydown = handleSearchKey;
  $('#answerInput').onfocus = () => { if (!selectedTrack) updateSuggestions(); };
  $('#answerInput').onblur = closeSuggestions;
  $('#suggestions').onmousedown = e => e.preventDefault();
  $('#suggestions').onclick = e => { const option = e.target.closest('[data-option]'); if (option) selectAnswer(Number(option.dataset.option)); };
  $('#guessForm').onsubmit = e => {
    e.preventDefault(); if (busy || !ready || !heard || !selectedTrack) return;
    if (multiplayer.active) { multiplayer.send('guess', { answer: selectedTrack }); return; }
    const next = artistMode() ? guessArtist(state, selectedTrack) : guess(state, selectedTrack); if (next === state) return;
    const status = next.attempts.at(-1).status;
    apply(next, true);
    if (status === 'correct') { $('#resultHead').classList.add('celebrate'); confetti($('#resultHead'), resultPresentation(next.results.at(-1)).particles); }
  };
  $('#skipBtn').onclick = () => { if (busy || !ready || multiplayer.loading) return; coachDone(2); autoPlay = heard && state.step < LENGTHS.length - 1; if (multiplayer.active) multiplayer.send('skip'); else apply(skip(state)); };
  $('#jbKeys').onclick = e => { const key = e.target.closest('[data-step]'); if (key) pressKey(Number(key.dataset.step)); };
  $('#playBtn').addEventListener('click', () => coachDone(1));
  $('#answerInput').addEventListener('input', () => coachDone(3));
  stage.querySelectorAll('.coach-x').forEach(x => x.onclick = () => coachDone(Number(x.parentElement.dataset.coach)));
  $('#helpBtn').onclick = () => { coach = new Set([1, 2, 3]); LS.set('music.online.coach', false); renderGame(); };
  ask = -1;
  $('#surrenderBtn').onclick = () => { if (!multiplayer.loading && (!busy && ready || multiplayer.active)) { if (multiplayer.active) multiplayer.send('surrender'); else apply(surrender(state)); } };
}

function updateControls() {
  if (!state || state.phase === 'summary') return;
  const play = $('#playBtn');
  play.disabled = busy || !ready || multiplayer.loading;
  play.classList.toggle('stop', playing);
  play.querySelector('.record-symbol').textContent = playing ? '■' : '▶';
  play.setAttribute('aria-label', playing ? 'Остановить отрывок' : `Слушать отрывок: ${length(state.phase === 'reveal' ? 15 : LENGTHS[state.step])} с`);
  if (state.phase !== 'round') return;
  $('#answerInput').disabled = busy || !ready || multiplayer.loading; $('#guessBtn').disabled = busy || !ready || !heard || !selectedTrack || multiplayer.loading;
  $('#skipBtn').disabled = busy || !ready || multiplayer.loading; $('#surrenderBtn').disabled = multiplayer.loading || (!multiplayer.active && (busy || !ready));
}

async function prepareAudio(track, version, focusAnswer = false) {
  audioController?.abort();
  const controller = audioController = new AbortController(), request = ++audioVersion;
  busy = true; ready = false; $('#audioError').hidden = true; $('#playStatus').textContent = 'Получаем ссылку на песню из Deezer…'; updateControls();
  try {
    if (player.track?.id !== track.id || !player.buffer) {
      const pre = preloaded.get(track.id);
      preloaded.delete(track.id);
      let full, buffer;
      if (pre) { $('#playStatus').textContent = 'Ожидаем загрузку следующей песни…'; try { ({ full, buffer } = await pre); } catch { /* не догрузилась — грузим как обычно */ } }
      if (!full) full = await service.track(track.deezerId, { signal: controller.signal });
      if (version !== screenVersion || request !== audioVersion) return;
      if (!multiplayer.active && state.phase === 'round' && !state.attempts.length) { state = { ...state, tracks: state.tracks.map(t => t.id === full.id ? { ...t, ...snapshotTrack(full) } : t) }; persistGame(); }
      if (buffer) player.useBuffer(full, buffer);
      else {
        const loaded = await player.load(full, { onStatus: status => { if (version === screenVersion && request === audioVersion) $('#playStatus').textContent = status; } });
        if (!loaded || version !== screenVersion || request !== audioVersion) return;
      }
    }
    ready = true; preload(trackById(state.queue[state.index + 1])); $('#playStatus').textContent = state.phase === 'reveal' ? 'Нажми на пластинку — сыграют 15 секунд.' : 'Жми ▶ и прислушайся.';
  } catch (error) {
    if (version !== screenVersion || request !== audioVersion) return;
    $('#audioErrorText').textContent = error.message; $('#audioError').hidden = false; $('#playStatus').textContent = 'Не удалось получить превью.';
    if (multiplayer.active) multiplayer.audioError();
  } finally {
    if (version === screenVersion && request === audioVersion) {
      busy = false; updateControls();
      if (ready && multiplayer.active) multiplayer.ready();
      if (autoPlay) { autoPlay = false; if (ready && state.phase === 'round') listen(); }
      if (focusAnswer && ready && state.phase === 'round' && !document.hidden) $('#answerInput').focus({ preventScroll: true });
    }
  }
}

function preload(track) {
  if (multiplayer.active) return;
  if (!track || preloaded.has(track.id) || player.track?.id === track.id) return;
  preloaded.clear(); // в памяти держим только одну следующую песню
  const job = service.track(track.deezerId).then(async full => ({ full, buffer: await player.fetchBuffer(full) }));
  job.catch(() => { if (preloaded.get(track.id) === job) preloaded.delete(track.id); });
  preloaded.set(track.id, job);
}

// Повторное нажатие останавливает звук. Пока отрывок играет, поле ответа и кнопки работают.
async function listen() {
  if (playing) { player.stop(); return; }
  if (busy || !ready || multiplayer.loading) return;
  const version = screenVersion, seconds = state.phase === 'reveal' ? 15 : LENGTHS[state.step];
  playing = true; updateControls(); $('#audioError').hidden = true;
  $('#playStatus').textContent = 'Включаем звук в браузере…';
  if (state.phase === 'round' && matchMedia('(pointer: fine)').matches) $('#answerInput').focus({ preventScroll: true });
  try {
    const complete = await player.play(seconds, { onStart: () => {
      if (version !== screenVersion) return;
      heard = true; updateControls(); $('#listenCard').classList.add('is-playing'); document.body.classList.add('music-on');
      $('#playStatus').textContent = state.phase === 'round' ? 'Слушаем… Можно сразу писать ответ.' : 'Слушаем…';
      runProgress(seconds, version);
    } }); if (version !== screenVersion) return;
    if (!complete) resetProgress();
    $('#playStatus').textContent = complete ? artistMode() ? 'Выберите исполнителя. Повтор отрывка — бесплатно.' : 'Выберите песню. Повтор отрывка — бесплатно.' : 'Остановлено. Можно включить ещё раз.';
  } catch (error) { if (version === screenVersion) { $('#playStatus').textContent = 'Звук не запустился.'; $('#audioErrorText').textContent = error.message; $('#audioError').hidden = false; } }
  finally { document.body.classList.remove('music-on'); if (version === screenVersion) { playing = false; $('#listenCard').classList.remove('is-playing'); updateControls(); } }
}

function closeSuggestions() {
  clearTimeout(searchTimer); searchController?.abort(); searchVersion++;
  const input = $('#answerInput'), list = $('#suggestions');
  if (list) list.hidden = true;
  input?.setAttribute('aria-expanded', 'false'); input?.removeAttribute('aria-activedescendant');
}

function showSuggestions(tracks, emptyMessage) {
  const activeId = matches[highlighted]?.id;
  matches = tracks;
  highlighted = activeId ? matches.findIndex(t => t.id === activeId) : -1;
  const list = $('#suggestions');
  list.innerHTML = matches.length ? matches.map((t, i) => `<li id="answer-option-${i}" role="option" aria-selected="${i === highlighted}" data-option="${i}">${t.kind !== 'artist' && /^https:\/\/cdn-images\.dzcdn\.net\//.test(t.cover || '') ? `<img class="suggestion-cover" src="${esc(t.cover)}" alt="" loading="lazy">` : ''}<b>${esc(t.kind === 'artist' ? t.name : t.title)}</b>${t.kind === 'artist' ? '' : `<small>${esc(t.artist)}</small>`}</li>`).join('') : `<li class="search-empty" role="presentation">${esc(emptyMessage)}</li>`;
  list.hidden = false; $('#answerInput').setAttribute('aria-expanded', 'true');
  if (highlighted >= 0) $('#answerInput').setAttribute('aria-activedescendant', `answer-option-${highlighted}`);
  else $('#answerInput').removeAttribute('aria-activedescendant');
}

function updateSuggestions() {
  clearTimeout(searchTimer); searchController?.abort(); const token = ++searchVersion;
  const query = $('#answerInput').value.trim();
  if (!query) { closeSuggestions(); return; }
  const artistsOnly = artistMode(), local = artistsOnly ? artistOptions([...state.tracks, ...pool]) : [...state.tracks, ...pool];
  const combine = artistsOnly ? combineArtistSuggestions : combineSuggestions;
  const tried = state.attempts.map(a => a.id);
  showSuggestions(combine(local, [], query, tried), query.length < 2 ? 'Введи хотя бы две буквы.' : artistsOnly ? 'Ищем исполнителей…' : 'Ищем песни в Deezer…');
  if (query.length < 2) return;
  searchTimer = setTimeout(async () => {
    const controller = searchController = new AbortController();
    try {
      const remote = artistsOnly ? (await service.searchArtists(query, { signal: controller.signal })).map(a => ({ kind: 'artist', id: `artist-${a.id}`, artistId: String(a.id), name: a.name })) : await service.searchTracks(query, { signal: controller.signal });
      if (token !== searchVersion || selectedTrack || !state || state.phase !== 'round') return;
      showSuggestions(combine(local, remote, query, tried), artistsOnly ? 'Исполнитель не найден. Попробуй написать имя иначе.' : 'Песня не найдена. Попробуй другое название или исполнителя.');
    } catch (error) { if (token === searchVersion && error.name !== 'AbortError') showSuggestions(combine(local, [], query, tried), 'Онлайн-поиск недоступен. Попробуй ещё раз.'); }
  }, 300);
}

function selectAnswer(index) {
  const track = matches[index]; if (!track || busy) return;
  selectedTrack = track; $('#answerInput').value = track.kind === 'artist' ? track.name : `${track.artist} — ${track.title}`;
  closeSuggestions(); updateControls(); $('#answerInput').focus();
}

function handleSearchKey(e) {
  const list = $('#suggestions');
  if (e.key === 'Escape') { closeSuggestions(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (list.hidden) updateSuggestions(); if (!matches.length) return;
    highlighted = highlighted < 0 ? (e.key === 'ArrowDown' ? 0 : matches.length - 1) : (highlighted + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
    [...list.children].forEach((el, i) => el.setAttribute('aria-selected', String(i === highlighted)));
    $('#answerInput').setAttribute('aria-activedescendant', `answer-option-${highlighted}`); list.children[highlighted].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && !list.hidden && matches.length) { e.preventDefault(); selectAnswer(highlighted < 0 ? 0 : highlighted); }
}

function renderReveal(track) {
  const result = state.results.at(-1), query = encodeURIComponent(`${track.artist} ${track.title}`), feedback = resultPresentation(result);
  stage.innerHTML = `<section class="game-shell result-screen">${roundHeader()}<div class="round-layout"><div class="round-main">
    <div class="result-head ${feedback.tier}" id="resultHead" role="status"><div class="result-verdict"><span class="result-icon" aria-hidden="true">${result.won ? '✓' : '♫'}</span><strong>${feedback.label}</strong><b class="result-points">${result.points ? `+${number(result.points)}` : '0 очков'}</b></div>
    <div class="track-reveal"><div class="cover-art"><span aria-hidden="true">♫</span>${track.cover ? `<img id="coverArt" src="${esc(track.cover)}" alt="Обложка альбома" width="112" height="112">` : ''}</div><div class="track-info"><h2 id="trackTitle">${esc(track.title)}</h2><p class="artist">${esc(track.artist)}</p><p class="result-detail">${result.won ? `Угадали за ${length(LENGTHS[result.step])} с${result.attempts?.at(-1)?.title && !sameArtist(track, result.attempts.at(-1)) ? '. Засчитано: та же песня в другом исполнении' : ''}` : result.points ? `+${ARTIST_BONUS} за исполнителя. Послушайте песню целиком` : 'Послушайте и запомните на следующий раз'}</p></div></div></div>
    <div class="reveal-actions"><span>${result.won ? 'Точный ответ. Очки ваши!' : 'Ответ раскрыт. Играем дальше?'}</span><button class="btn primary" id="nextBtn">${state.results.length >= state.queue.length ? 'Результаты' : 'Следующий трек'}</button></div>
    ${playerHTML(true)}<nav class="external-links" aria-label="Послушать песню"><a href="https://www.deezer.com/track/${track.deezerId}" target="_blank" rel="noopener noreferrer">Deezer</a><a href="https://music.yandex.ru/search?text=${query}" target="_blank" rel="noopener noreferrer">Яндекс Музыка</a><a href="https://open.spotify.com/search/${query}" target="_blank" rel="noopener noreferrer">Spotify</a></nav>${evidenceHTML(track)}</div>${historyHTML()}</div></section>`;
  $('#coverArt')?.addEventListener('error', event => { event.target.hidden = true; });
  bindPlayer(); $('#nextBtn').onclick = () => apply(nextRound(state));
}

function evidenceHTML(track) {
  const safe = (track.evidence || []).filter(e => { try { const u = new URL(e.url); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } });
  if (!safe.length) return '';
  return `<details class="track-evidence"><summary>Откуда эта песня в подборке?</summary><ul>${safe.map(e => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title)}</a>${e.kind !== 'apple-playlist' && Number.isInteger(e.position) ? ` · №${e.position}` : ''}${e.period ? ` · ${esc(e.period)}` : ''}<small>${{ 'apple-playlist': 'Редакторская подборка', 'apple-chart': 'Чарт', 'deezer-artist-top': 'Популярное у исполнителя на Deezer' }[e.kind] || 'Рейтинг'}${e.date ? ` · проверено ${new Date(e.date).toLocaleDateString('ru-RU')}` : ''}${e.stale ? ' · сохранённая версия' : ''}</small></li>`).join('')}</ul></details>`;
}

function renderSummary() {
  const won = state.results.filter(r => r.won), instant = won.filter(r => r.step === 0);
  rememberPlayed();
  stage.innerHTML = `<section class="game-shell"><div class="summary-head"><span class="kicker">${esc(state.packTitle || 'Музыка онлайн')}</span><h1>${won.length === state.results.length && won.length ? 'Все песни ваши!' : 'Вот это послушали'}</h1><div class="final-score">${number(state.score)}</div><p class="sub">очков на вашу компанию</p><div class="summary-stats"><span>Угадали <b>${won.length} из ${state.results.length}</b></span><span>С полсекунды <b>${instant.length}</b></span></div></div><div class="result-list">${state.results.map((r, i) => { const t = trackById(r.id); return `<div class="result-row ${r.won ? 'won' : ''}"><span class="result-no">${i + 1}</span><div><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></div><div class="result-value">${r.points ? `+${r.points}` : '—'}<small>${r.won ? `${length(LENGTHS[r.step])} с` : r.points ? 'Исполнитель' : 'Не угадали'}</small></div></div>`; }).join('') || '<p class="sub">Превью оказались недоступны. Выбери другую подборку.</p>'}</div><div class="summary-buttons"><button class="btn primary" id="againBtn">Новая партия</button></div></section>`;
  $('#againBtn').onclick = leave;
}

$('#artistInput').oninput = () => {
  clearTimeout(artistTimer); artistController?.abort();
  const query = $('#artistInput').value.trim(); $('#artistResults').innerHTML = '';
  if (query.length < 2) return;
  $('#artistResults').textContent = 'Ищем исполнителей…';
  artistTimer = setTimeout(async () => {
    const controller = artistController = new AbortController();
    try {
      const artists = await service.searchArtists(query, { signal: controller.signal });
      if (controller.signal.aborted || !$('#artistDialog').open || $('#artistInput').value.trim() !== query) return;
      $('#artistResults').innerHTML = artists.length ? artists.map((a, i) => `<button class="artist-result" data-artist="${i}"><b>${esc(a.name)}</b><small>Топ треков исполнителя</small></button>`).join('') : '<p class="sub">Не найдено. Попробуй точное написание имени.</p>';
      $('#artistResults').querySelectorAll('[data-artist]').forEach(button => button.onclick = () => { const a = artists[Number(button.dataset.artist)]; customPack = { id: `artist-${a.id}`, title: a.name, icon: '♫', description: '10 верхних треков исполнителя', topLimit: 10, artists: [a] }; $('#artistDialog').close(); selectPack(customPack); });
    } catch (error) { if (!controller.signal.aborted) $('#artistResults').textContent = error.message; }
  }, 300);
};
$('#artistDialog').addEventListener('close', () => { clearTimeout(artistTimer); artistController?.abort(); });
$('#rulesOpen').onclick = () => $('#rulesDialog').showModal(); $('#exitBtn').onclick = leave;
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(`#${button.dataset.close}`).close());
document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
// Пробел вне поля ввода — играть / остановить отрывок
addEventListener('keydown', e => {
  if (e.code !== 'Space' || e.repeat || !state || state.phase === 'summary' || (e.target instanceof Element && e.target.closest('input, textarea, button, select, dialog'))) return;
  e.preventDefault(); listen();
});
addEventListener('pagehide', () => { audioController?.abort(); player.stop(); });
addEventListener('pageshow', event => { if (event.persisted && state) renderGame(); });
const multiplayer = createMultiplayer({
  getMatch: makeFriendMatch,
  getSettings: () => ({ packTitle: currentPack().title, rounds: settings.rounds, answerMode: settings.answerMode }),
  verifyTrack: id => service.track(id),
  showGame: game => { const focusAnswer = state?.phase === 'round' && game.phase === 'round' && state.attempts.length !== game.attempts.length; state = game; renderGame(focusAnswer); },
  stopGame: () => { screenVersion++; audioController?.abort(); player.stop(); closeSuggestions(); autoPlay = false; state = null; renderedRoundKey = null; },
  showHome: renderSetup,
});
renderSetup(); enter(stage); selectPack(currentPack());
