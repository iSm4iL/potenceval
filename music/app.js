import { t, lang } from '../shared/i18n.js?v=ui-20261029';
import { $, esc, LS, toast, enter, confetti } from '../shared/kit.js';
import { LENGTHS, POINTS, ARTIST_BONUS, createGame, guess, guessArtist, skip, openStep, surrender, nextRound, replaceBroken, restoreGame } from './game.js?v=locale-20261029';
import { PACKS, localizedPackTitle, combineSuggestions, combineArtistSuggestions, artistOptions, sameArtist } from './catalog.js?v=music-fixes-20261030';
import { createDeezerClient } from './service.js?v=music-fixes-20261030';
import { AudioPlayer } from './audio.js?v=music-fixes-20261030';
import { resultPresentation } from './feedback.js?v=locale-20261029';
import { createCatalogClient } from './collection.js?v=locale-20261029';
import './report.js?v=locale-20261029';
import { createMultiplayer } from './multiplayer.js?v=locale-20261029';

// shared/i18n handles data-en text; translate attributes without replacing controls.
if (lang === 'en') for (const attribute of ['aria-label', 'placeholder', 'content']) {
  for (const element of document.querySelectorAll(`[data-en-${attribute}]`)) element.setAttribute(attribute, element.getAttribute(`data-en-${attribute}`));
}

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
const locale = t('ru-RU', 'en-US');
const number = n => n.toLocaleString(locale);
const trackPlural = new Intl.PluralRules(lang);
const trackCount = n => `${number(n)} ${{ one: t('трек', "track"), few: t('трека', "tracks"), many: t('треков', "tracks"), other: t('треков', "tracks") }[trackPlural.select(n)]}`;
const length = n => String(n).replace('.', t(',', '.'));
const trackById = id => state?.tracks.find(t => t.id === id) || pool.find(t => t.id === id);
const currentPack = () => PACKS.find(p => p.id === settings.pack) || customPack || PACKS[0];
const artistMode = () => state?.answerMode === 'artist';
const gamePackTitle = game => localizedPackTitle(game.packId, game.packTitle, game.catalogMode);
const emptyPackMessage = pack => settings.mode === 'current' && pack.curated ? t('Сейчас в свежем топ-100 нет подходящих песен этого жанра. Выбери «Знакомые хиты» или другой жанр.', "There are no songs for this genre in the current top 100. Choose “Familiar hits” or another genre.") : t('В этой подборке сейчас нет доступных песен. Выбери другую.', "There are no available songs in this collection. Choose another one.");
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
  const cards = items => items.map((p, index) => `<button class="pack-card ${settings.pack === p.id ? 'selected' : ''}" data-pack="${esc(p.id)}" aria-pressed="${settings.pack === p.id}" style="--sleeve:${index + 1}"><span class="pack-art" aria-hidden="true"><span class="pack-disc"><span class="pack-disc-label"></span></span><span class="pack-sleeve"><span class="pack-art-icon">${p.icon || '♫'}</span><span class="pack-art-title">${esc(p.title)}</span><span class="pack-art-mark">${t("полсекунды", "half a second")}</span></span></span><span class="pack-meta"><b>${esc(p.title)}</b><small>${esc(p.description || t('Популярные треки исполнителя', "Popular tracks by this artist"))}</small></span>${p.curated && !packLoading && packInfo ? `<span class="pack-count">${trackCount(genreCounts[p.id] || 0)}</span>` : ''}<span class="pack-selected" aria-hidden="true">✓</span></button>`).join('');
  const choices = [...new Set([...availableRounds.filter(n => n < 5), 5, 10, 20])];
  stage.dispatchEvent(new Event('music:before-setup'));
  stage.innerHTML = `<section class="music-home"><div class="music-intro"><div><span class="kicker">${t("Музыкальная угадайка для друзей", "A music guessing game for friends")}</span><h1>${t("Полсекунды", "Half a Second")}<i>.</i></h1><p class="sub">${t("Выбирай пластинку. Узнавай трек с первых нот.", "Pick a record. Recognize the song from its first notes.")}</p></div><div class="intro-side"><span class="intro-pulse" aria-hidden="true">♫</span><p>${t("От 0,5 секунды до полного ответа.", "From half a second to the full answer.")}<br>${t("Один экран для всей компании.", "One screen for everyone.")}</p></div></div>
    ${savedGame && savedGame.phase !== 'summary' ? `<div class="resume-card"><p>${t("Незаконченная партия:", "Unfinished game:")} ${esc(gamePackTitle(savedGame))}. ${t("Счёт:", "Score:")} ${number(savedGame.score)}.</p><button class="btn gold" id="resumeBtn">${t("Продолжить игру", "Resume game")}</button></div>` : ''}
    <div class="crate-heading"><div><h2>${t("Выбери свою пластинку", "Pick your record")}</h2><p>${t("Какую музыку сегодня угадываем?", "What are we listening to today?")}</p></div><div class="catalog-modes" aria-label="${t("Тип подборки", "Collection type")}"><button data-mode="hits" class="${settings.mode === 'hits' ? 'selected' : ''}" aria-pressed="${settings.mode === 'hits'}">${t("Знакомые хиты", "Familiar hits")}</button><button data-mode="current" class="${settings.mode === 'current' ? 'selected' : ''}" aria-pressed="${settings.mode === 'current'}">${t("Сейчас в чартах", "In the charts")}</button></div></div>
    <div class="pack-list">${cards(packs)}</div>
    <div class="answer-mode-picker"><span>${t("Что угадываем?", "What are we guessing?")}</span><div class="catalog-modes" role="group" aria-label="${t("Режим ответа", "Answer mode")}"><button data-answer-mode="track" class="${settings.answerMode === 'track' ? 'selected' : ''}" aria-pressed="${settings.answerMode === 'track'}">${t("Песню", "Song")}</button><button data-answer-mode="artist" class="${settings.answerMode === 'artist' ? 'selected' : ''}" aria-pressed="${settings.answerMode === 'artist'}">${t("Исполнителя / группу", "Artist / band")}</button></div><small>${settings.answerMode === 'artist' ? t('Достаточно назвать артиста или группу. Название песни знать не нужно.', "Just name the artist or band. No song title needed.") : t('Нужно выбрать песню. Угаданный исполнитель даст подсказку.', "Choose the song. Getting the artist right gives you a hint.")}</small></div>
    <div class="setup-panel"><div class="setup-choice"><div><span class="choice-label">${t("Твой выбор", "Your pick")}</span><h3>${esc(pack.title)}</h3><p>${pack.curated ? t('Разные исполнители. До двух песен каждого за партию.', "Different artists. Up to two songs each per game.") : t('Популярные песни одного исполнителя.', "Popular songs by one artist.")}</p><button class="lineup-button" id="lineupBtn" aria-haspopup="dialog" ${packLoading || !pool.length ? 'disabled' : ''}><span aria-hidden="true">ⓘ</span> ${t("Исполнители", "Artists")}</button><p class="pack-status ${packError ? 'failed' : ''}" id="packStatus" role="status">${packLoading ? t('Собираем треки…', "Loading tracks…") : packError ? esc(packError) : `${trackCount(pool.length)} ${t("в подборке", "in this collection")}`}</p></div><button class="artist-picker" id="artistPicker">＋ ${t("Свой исполнитель", "Pick an artist")}</button></div>
      <div class="setup-actions"><div class="setting-label">${t("Сколько треков сыграем?", "How many tracks?")}<div class="round-options">${choices.map(n => `<button class="round-choice ${settings.rounds === n ? 'selected' : ''}" data-rounds="${n}" aria-pressed="${settings.rounds === n}" ${packLoading || !availableRounds.includes(n) ? 'disabled' : ''}>${n}</button>`).join('')}</div></div><button class="btn primary big" id="startBtn" ${packLoading || packError || !availableRounds.includes(settings.rounds) ? 'disabled' : ''}>${packLoading ? t('Собираем треки…', "Loading tracks…") : t('Начать игру', "Start game")}</button></div>
      <div class="setup-footer"><span>${t("Короткие онлайн-превью Deezer, без подписки.", "Short Deezer previews. No subscription needed.")}</span><button class="library-btn" id="refreshPack">${packError ? t('Попробовать ещё раз', "Try again") : t('Обновить подборку', "Refresh collection")}</button></div>${packInfo?.failures?.length ? `<p class="source-note">${t("Не удалось получить:", "Could not load:")} ${esc(packInfo.failures.join(', '))}. ${t("Остальные исполнители доступны.", "Other artists are available.")}</p>` : ''}</div></section>`;
  stage.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => { settings.mode = button.dataset.mode; genreCounts = {}; selectPack(currentPack()); });
  stage.querySelectorAll('[data-pack]').forEach(button => button.onclick = () => selectPack(packs.find(p => p.id === button.dataset.pack)));
  stage.querySelectorAll('[data-rounds]').forEach(button => button.onclick = () => { settings.rounds = Number(button.dataset.rounds); persistSettings(); renderSetup(); });
  stage.querySelectorAll('[data-answer-mode]').forEach(button => button.onclick = () => { settings.answerMode = button.dataset.answerMode; persistSettings(); renderSetup(); });
  const friends = document.createElement('button'); friends.id = 'friendsBtn'; friends.className = 'btn gold big'; friends.textContent = t('♬  Играть с друзьями', "♬  Play with friends"); friends.onclick = () => multiplayer.open();
  $('#startBtn').after(friends);
  $('#startBtn').onclick = startGame; $('#refreshPack').onclick = () => selectPack(currentPack(), true);
  $('#artistPicker').onclick = () => { $('#artistDialog').showModal(); $('#artistInput').focus(); };
  $('#lineupBtn').onclick = () => {
    $('#lineupTitle').textContent = `${t("Исполнители", "Artists")}: ${pack.title}`;
    const names = [...new Set(pool.flatMap(track => track.artistNames || [track.artist]))].sort((a, b) => a.localeCompare(b, lang));
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
    state.packTitle = currentPack().title + (currentPack().curated && settings.mode === 'current' ? t(' · Сейчас в чартах', " · In the charts") : ''); state.packId = settings.pack; state.catalogMode = settings.mode;
    persistSettings(); persistGame(); renderGame();
  } catch (error) { toast(error.message, 5000); }
}

function makeFriendMatch() {
  if (packLoading || packError || !pool.length) throw new Error(t('Подборка ещё не готова. Дождись загрузки или выбери другую пластинку.', "This collection is still loading. Wait or choose another record."));
  return { ...createGame(pool, { rounds: settings.rounds, answerMode: settings.answerMode, maxPerArtist: currentPack().curated ? 2 : Infinity }), packTitle: currentPack().title + (currentPack().curated && settings.mode === 'current' ? t(' · Сейчас в чартах', " · In the charts") : ''), packId: settings.pack, catalogMode: settings.mode };
}

function apply(next, focusAnswer = false) { state = next; if (state.phase === 'reveal') rememberPlayed(); persistGame(); renderGame(focusAnswer); }

function rememberPlayed() {
  const recent = LS.get('music.online.recent');
  const keys = state.results.flatMap(r => { const track = trackById(r.id); return [track?.id, track?.answerKey, track?.workKey].filter(Boolean); });
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
  // внутри раунда (ошибка, «слушать дольше») не прыгаем к вертушке: поле ответа остаётся под пальцем
  const keepScroll = sameRound && state.phase === 'round';
  screenVersion++; audioController?.abort(); player.stop(); closeSuggestions();
  busy = false; ready = false; playing = false; heard = heard && sameRound; selectedTrack = null; matches = []; highlighted = -1;
  renderedRoundKey = key;
  $('#exitBtn').hidden = false;
  if (state.phase === 'summary') { renderSummary(); if (multiplayer.active) multiplayer.decorate(); stage.scrollIntoView({ block: 'start' }); return; }
  const track = trackById(state.queue[state.index]);
  stage.dataset.reportTrack = JSON.stringify({ id: track.deezerId, title: track.title, artist: track.artist, pack: gamePackTitle(state) }); // для флажка жалобы (report.js)
  if (state.phase === 'reveal') renderReveal(track); else renderRound();
  if (!keepScroll) stage.scrollIntoView({ block: 'start' });
  prepareAudio(track, screenVersion, focusAnswer);
  if (multiplayer.active) multiplayer.decorate();
}

const coachHTML = (n, text) => coach.has(n) ? `<div class="coach" data-coach="${n}"><b>${n}</b><span>${text}</span><button type="button" class="coach-x" aria-label="${t("Скрыть подсказку", "Dismiss tip")}">✕</button></div>` : '';
function coachDone(n) {
  if (!coach.delete(n)) return;
  const el = $(`[data-coach="${n}"]`); if (el) { el.classList.add('bye'); setTimeout(() => el.remove(), 350); }
  if (!coach.size) LS.set('music.online.coach', true);
  const help = $('#helpBtn'); if (help) help.hidden = coach.size > 0;
}

// Полоска проигрывания: заполняется и считает секунды, пока звучит отрывок.
const progressHTML = seconds => `<div class="play-line" aria-hidden="true"><span class="pl-time" id="plTime">${t("0,0", "0.0")}</span><div class="pl-track"><span class="pl-fill" id="plFill"></span></div><span class="pl-total">${length(seconds)} ${t("с", "s")}</span></div>`;
let progressFrame = 0;
function runProgress(seconds, version) {
  cancelAnimationFrame(progressFrame);
  const fill = $('#plFill'), time = $('#plTime'), started = performance.now();
  if (!fill) return;
  const tick = now => {
    if (version !== screenVersion || !playing) return;
    const elapsed = Math.min(seconds, (now - started) / 1000);
    fill.style.width = `${elapsed / seconds * 100}%`; time.textContent = length(elapsed.toFixed(1));
    if (elapsed < seconds) progressFrame = requestAnimationFrame(tick);
  };
  progressFrame = requestAnimationFrame(tick);
}
function resetProgress() {
  cancelAnimationFrame(progressFrame);
  const fill = $('#plFill'); if (!fill) return;
  fill.style.width = '0'; $('#plTime').textContent = t('0,0', '0.0');
}

// Раунд — музыкальный автомат: купол с пластинкой, большая кнопка, клавиши длин.
function jukeboxHTML() {
  const s = state.step, newRound = keyStep.key !== renderedRoundKey, fresh = newRound ? s : keyStep.step;
  keyStep = { key: renderedRoundKey, step: s };
  return `<div class="jukebox${newRound ? ' arriving' : ''}" id="listenCard">
    <div class="jb-top"><span class="jb-sign">${t("Полсекунды", "Half a Second")}</span><div class="jb-tools"><button type="button" class="help-btn" id="helpBtn" ${coach.size ? 'hidden' : ''}>? ${t("Подсказки", "Tips")}</button><label class="volume"><span>${t("Звук", "Sound")}</span><input id="volume" type="range" min="0" max="1" step="0.05" value="${settings.volume}" aria-label="${t("Громкость", "Volume")}"></label></div></div>
    <div class="jb-dome"><div class="jb-glass">
      <div class="jb-marquee">★ ${t("за ответ сейчас", "for a correct answer now")} <b>${POINTS[s]}</b> ${t("очков", "points")} ★</div>
      <div class="jb-record" aria-hidden="true"></div>
      <button class="jb-play" id="playBtn" aria-label="${t("Слушать отрывок", "Play snippet")}" disabled><span class="record-symbol" aria-hidden="true">▶</span></button>
      <div class="jb-cap"><b>${length(LENGTHS[s])} ${t("с", "s")}</b>${t("музыки", "of music")}</div>
    </div></div>
    ${progressHTML(LENGTHS[s])}
    <div class="jb-status play-status" id="playStatus" role="status">${t("Готовим онлайн-превью…", "Preparing preview…")}</div>
    ${coachHTML(1, t('Жми большую кнопку — сыграет кусочек песни. Повторять можно сколько угодно.', "Press the big button to hear a snippet. Replay it as often as you like."))}
    <div class="jb-keys" id="jbKeys" role="group" aria-label="${t("Длина отрывка", "Snippet length")}">${LENGTHS.map((n, i) => `<button type="button" class="jb-key ${i === s ? 'current' : i < s ? 'opened' : 'locked'}${i > fresh && i <= s ? ' just' : ''}" data-step="${i}" ${i === s ? 'aria-current="step"' : ''}><i></i>${length(n)} ${t("с", "s")}<small>${POINTS[i]}</small></button>`).join('')}</div>
    <button type="button" class="jb-more" id="skipBtn" disabled>${s === LENGTHS.length - 1 ? t('Не узнал — показать ответ', "Don’t know it? Reveal answer") : `${t("Не узнал? Слушать", "Need more? Listen for")} ${length(LENGTHS[s + 1])} ${t("с", "s")} <small>· ${t("за ответ станет", "points for a correct answer:")} ${POINTS[s + 1]}</small>`}</button>
    ${coachHTML(2, t('Не узнал — жми «Слушать дольше» или сразу любую клавишу. Чем длиннее кусок, тем меньше очков.', "Need more? Listen longer or pick a duration. Longer snippets earn fewer points."))}
  </div><div class="audio-error" id="audioError" role="alert" hidden><p id="audioErrorText"></p><button class="btn ghost" id="retryAudio">${t("Попробовать ещё раз", "Try again")}</button><button class="btn ghost" id="replaceTrack">${t("Заменить без штрафа", "Replace without penalty")}</button></div>`;
}

// Закрытая клавиша открывается вторым нажатием: случайный тап не сжигает очки.
function markAsk() {
  document.querySelectorAll('.jb-key').forEach(b => {
    const i = Number(b.dataset.step), on = i === ask;
    b.classList.toggle('ask', on);
    if (on) b.dataset.ask = `${t("Ещё раз", "Press again")}\n−${POINTS[state.step] - POINTS[i]}`;
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
    <div class="listen-top"><span>${reveal ? t('Онлайн-превью · Deezer', "Online preview · Deezer") : `${t("За ответ сейчас:", "Correct answer now:")} ${POINTS[state.step]} ${t("очков", "points")}`}</span><label class="volume"><span>${t("Звук", "Sound")}</span><input id="volume" type="range" min="0" max="1" step="0.05" value="${settings.volume}" aria-label="${t("Громкость", "Volume")}"></label></div>
    <div class="player-body"><button class="record-button" id="playBtn" aria-label="${t("Слушать отрывок", "Play snippet")}" disabled><span class="vinyl" aria-hidden="true"></span><span class="record-symbol" aria-hidden="true">▶</span></button><div class="player-copy"><div class="duration-line"><b>${reveal ? 15 : length(LENGTHS[state.step])}</b>${t("с", "s")} ${t("музыки", "of music")}</div><div class="play-status" id="playStatus" role="status">${t("Готовим онлайн-превью…", "Preparing preview…")}</div></div></div>${progressHTML(15)}
    ${!reveal ? `<ol class="length-steps" aria-label="${t("Открытые отрывки", "Unlocked snippets")}">${LENGTHS.map((n, i) => `<li class="${i === state.step ? 'current' : i < state.step ? 'opened' : ''}" ${i === state.step ? 'aria-current="step"' : ''}>${length(n)} ${t("с", "s")}<small>${POINTS[i]} ${t("очков", "points")}</small></li>`).join('')}</ol>` : ''}
    </div><div class="audio-error" id="audioError" role="alert" hidden><p id="audioErrorText"></p><button class="btn ghost" id="retryAudio">${t("Попробовать ещё раз", "Try again")}</button>${reveal ? '' : t('<button class="btn ghost" id="replaceTrack">Заменить без штрафа</button>', "<button class=\"btn ghost\" id=\"replaceTrack\">Replace without penalty</button>")}</div>`;
}

const statusLabel = { wrong: t('Не та песня', "Wrong song"), artist: t('Исполнитель угадан', "Artist guessed"), correct: t('Точно!', "Correct!") };
function historyHTML() {
  return `<section class="attempt-history" aria-labelledby="attemptTitle"><div class="history-heading"><h2 id="attemptTitle">${t("Ваши попытки", "Your guesses")} <small>${state.attempts.length}/6</small></h2><span><i class="legend-dot wrong"></i>${t("Мимо", "Miss")} ${artistMode() ? '' : t('<i class="legend-dot artist"></i>Исполнитель', "<i class=\"legend-dot artist\"></i>Artist")} <i class="legend-dot correct"></i>${t("Точно", "Correct")}</span></div>${state.attempts.length ? `<ol aria-label="${t("Последняя попытка сверху", "Latest guess first")}">${[...state.attempts].reverse().map(a => `<li class="attempt ${a.status}"><span class="attempt-symbol" aria-hidden="true">${a.status === 'correct' ? '✓' : a.status === 'artist' ? '≈' : '×'}</span><div><b>${esc(a.kind === 'artist' ? a.name : a.title)}</b>${a.kind === 'artist' ? '' : `<small>${esc(a.artist)}</small>`}<span class="attempt-verdict">${artistMode() && a.status === 'wrong' ? t('Другой исполнитель', "Wrong artist") : statusLabel[a.status]} · ${length(LENGTHS[a.step])} ${t("с", "s")}</span></div></li>`).join('')}</ol>` : t('<p class="history-empty">Здесь появятся ваши ответы.<br>Последняя попытка всегда сверху.</p>', "<p class=\"history-empty\">Your guesses will appear here.<br>Latest guess first.</p>")}</section>`;
}

function roundHeader() {
  return `<div class="round-top" data-pack-id="${esc(state.packId || '')}" data-pack-title="${esc(gamePackTitle(state))}"><div><h1>${state.phase === 'reveal' ? t('Ответ на раунд', "Round answer") : artistMode() ? t('Кто исполняет этот трек?', "Who performs this track?") : t('Угадай этот трек', "Guess this track")}</h1><p>${t("Раунд", "Round")} ${state.index + 1} ${t("из", "of")} ${state.queue.length} · ${esc(gamePackTitle(state))} · ${artistMode() ? t('Угадываем исполнителя', "Guess the artist") : t('Угадываем песню', "Guess the song")}</p></div><div class="total-score"><b>${number(state.score)}</b> ${t("очков", "points")}</div></div>`;
}

function attemptFeedbackHTML() {
  const last = state.attempts.at(-1);
  return last ? `<div class="round-feedback ${last.status}" id="roundFeedback" role="status"><b>${artistMode() ? t('Другой исполнитель. Попробуйте ещё.', "Wrong artist. Try again.") : last.status === 'artist' ? `${t("Исполнитель тот самый —", "Right artist —")} +${ARTIST_BONUS} ${t("уже ваши. Угадаете песню — будет больше.", "is yours already. Guess the song to earn more.")}` : t('Не та песня. Попробуйте ещё.', "Wrong song. Try again.")}</b><span>${last.kind === 'artist' ? esc(last.name) : `${esc(last.artist)} — ${esc(last.title)}`}</span></div>` : `<p class="answer-hint">${t("Можно писать с опечатками и русскими буквами. Enter — выбрать", "Typos and transliteration work. Enter selects a")} ${artistMode() ? t('исполнителя', "artist") : t('песню', "song")}, ${t("ещё раз Enter — ответить. Пробел — играть/стоп.", "press Enter again to answer. Space plays or stops.")}</p>`;
}

function bindPlayer() {
  $('#playBtn').onclick = listen;
  $('#volume').oninput = e => { settings.volume = Number(e.target.value); player.setVolume(settings.volume); persistSettings(); };
  $('#retryAudio').onclick = () => prepareAudio(trackById(state.queue[state.index]), screenVersion);
  $('#replaceTrack')?.addEventListener('click', () => { if (multiplayer.active) return; toast(t('Песня заменена без штрафа.', "Song replaced without penalty."), 3000); apply(replaceBroken(state)); });
}

function renderRound() {
  stage.innerHTML = `<section class="game-shell" data-answer-mode="${state.answerMode}">${roundHeader()}<div class="round-layout"><div class="round-main">${playerHTML()}
    <form class="guess-form" id="guessForm" autocomplete="off"><label for="answerInput">${artistMode() ? t('Группа или исполнитель', "Band or artist") : t('Название песни или исполнитель', "Song title or artist")}</label><div class="answer-row"><div class="search-wrap"><input class="field" id="answerInput" placeholder="${artistMode() ? t('Например, Металлика…', "For example, Metallica…") : t('Кажется, я знаю…', "I think I know this…")}" role="combobox" aria-autocomplete="list" aria-controls="suggestions" aria-expanded="false" spellcheck="false" maxlength="180" disabled><ul class="suggestions" id="suggestions" role="listbox" aria-label="${artistMode() ? t('Исполнители', "Artists") : t('Песни', "Songs")}" hidden></ul></div><button type="button" class="mini-play" id="miniPlay" disabled>▶</button><button class="btn primary" id="guessBtn" type="submit" disabled>${t("Ответить", "Answer")}</button></div>${coachHTML(3, artistMode() ? t('Узнал — пиши имя артиста или группы и выбери исполнителя из списка. Название песни не нужно.', "Know it? Type the artist or band and select them from the list. No song title needed.") : t('Узнал — пиши название или исполнителя и выбери песню из списка.', "Know it? Type the title or artist and select the song from the list."))}<button class="give-up" id="surrenderBtn" type="button" disabled>${t("Сдаться и посмотреть ответ", "Give up and reveal answer")}</button></form>${attemptFeedbackHTML()}</div>${historyHTML()}</div></section>`;
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
  // ▶ у поля ответа (на телефоне): переслушать, не листая к вертушке и не закрывая клавиатуру
  $('#miniPlay').onmousedown = e => e.preventDefault();
  $('#miniPlay').onclick = () => $('#playBtn').click();
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
  play.setAttribute('aria-label', playing ? t('Остановить отрывок', "Stop snippet") : `${t("Слушать отрывок", "Play snippet")}: ${length(state.phase === 'reveal' ? 15 : LENGTHS[state.step])} ${t("с", "s")}`);
  if (state.phase !== 'round') return;
  const mini = $('#miniPlay'); mini.disabled = play.disabled; mini.textContent = playing ? '■' : '▶'; mini.setAttribute('aria-label', play.getAttribute('aria-label'));
  $('#answerInput').disabled = busy || !ready || multiplayer.loading; $('#guessBtn').disabled = busy || !ready || !heard || !selectedTrack || multiplayer.loading;
  $('#skipBtn').disabled = busy || !ready || multiplayer.loading; $('#surrenderBtn').disabled = multiplayer.loading || (!multiplayer.active && (busy || !ready));
}

async function prepareAudio(track, version, focusAnswer = false) {
  audioController?.abort();
  const controller = audioController = new AbortController(), request = ++audioVersion;
  busy = true; ready = false; $('#audioError').hidden = true; $('#playStatus').textContent = t('Получаем ссылку на песню из Deezer…', "Fetching the track from Deezer…"); updateControls();
  try {
    if (player.track?.id !== track.id || !player.buffer) {
      const pre = preloaded.get(track.id);
      preloaded.delete(track.id);
      let full, buffer;
      if (pre) { $('#playStatus').textContent = t('Ожидаем загрузку следующей песни…', "Waiting for the next track to load…"); try { ({ full, buffer } = await pre); } catch { /* не догрузилась — грузим как обычно */ } }
      if (!full) full = await service.track(track.deezerId, { signal: controller.signal });
      if (version !== screenVersion || request !== audioVersion) return;
      // Refresh the audio URL only; answers stay pinned to the party snapshot.
      if (buffer) player.useBuffer(full, buffer);
      else {
        const loaded = await player.load(full, { onStatus: status => { if (version === screenVersion && request === audioVersion) $('#playStatus').textContent = status; } });
        if (!loaded || version !== screenVersion || request !== audioVersion) return;
      }
    }
    ready = true; preload(trackById(state.queue[state.index + 1])); $('#playStatus').textContent = state.phase === 'reveal' ? t('Нажми на пластинку — сыграют 15 секунд.', "Press the record to hear 15 seconds.") : t('Жми ▶ и прислушайся.', "Press ▶ and listen closely.");
  } catch (error) {
    if (version !== screenVersion || request !== audioVersion) return;
    $('#audioErrorText').textContent = error.message; $('#audioError').hidden = false; $('#playStatus').textContent = t('Не удалось получить превью.', "Could not load the preview.");
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
  $('#playStatus').textContent = t('Включаем звук в браузере…', "Starting audio…");
  if (state.phase === 'round' && matchMedia('(pointer: fine)').matches) $('#answerInput').focus({ preventScroll: true });
  try {
    const complete = await player.play(seconds, { onStart: () => {
      if (version !== screenVersion) return;
      heard = true; updateControls(); $('#listenCard').classList.add('is-playing'); document.body.classList.add('music-on');
      $('#playStatus').textContent = state.phase === 'round' ? t('Слушаем… Можно сразу писать ответ.', "Playing… You can type your answer now.") : t('Слушаем…', "Playing…");
      runProgress(seconds, version);
    } }); if (version !== screenVersion) return;
    if (!complete) resetProgress();
    $('#playStatus').textContent = complete ? artistMode() ? t('Выберите исполнителя. Повтор отрывка — бесплатно.', "Choose the artist. Replaying is free.") : t('Выберите песню. Повтор отрывка — бесплатно.', "Choose the song. Replaying is free.") : t('Остановлено. Можно включить ещё раз.', "Stopped. You can replay it.");
  } catch (error) { if (version === screenVersion) { $('#playStatus').textContent = t('Звук не запустился.', "Audio could not start."); $('#audioErrorText').textContent = error.message; $('#audioError').hidden = false; } }
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
  list.innerHTML = matches.length ? matches.map((track, i) => `<li id="answer-option-${i}" role="option" aria-selected="${i === highlighted}" data-option="${i}">${track.kind !== 'artist' && /^https:\/\/cdn-images\.dzcdn\.net\//.test(track.cover || '') ? `<img class="suggestion-cover" src="${esc(track.cover)}" alt="" loading="lazy">` : ''}<b>${esc(track.kind === 'artist' ? track.name : track.title)}</b>${track.kind === 'artist' ? '' : `<small>${esc(track.artist)}</small>`}</li>`).join('') : `<li class="search-empty" role="presentation">${esc(emptyMessage)}</li>`;
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
  showSuggestions(combine(local, [], query, tried), query.length < 2 ? t('Введи хотя бы две буквы.', "Type at least two letters.") : artistsOnly ? t('Ищем исполнителей…', "Searching for artists…") : t('Ищем песни в Deezer…', "Searching Deezer…"));
  if (query.length < 2) return;
  searchTimer = setTimeout(async () => {
    const controller = searchController = new AbortController();
    try {
      const remote = artistsOnly ? (await service.searchArtists(query, { signal: controller.signal })).map(a => ({ kind: 'artist', id: `artist-${a.id}`, artistId: String(a.id), name: a.name })) : await service.searchTracks(query, { signal: controller.signal });
      if (token !== searchVersion || selectedTrack || !state || state.phase !== 'round') return;
      showSuggestions(combine(local, remote, query, tried), artistsOnly ? t('Исполнитель не найден. Попробуй написать имя иначе.', "Artist not found. Try another spelling.") : t('Песня не найдена. Попробуй другое название или исполнителя.', "Song not found. Try another title or artist."));
    } catch (error) { if (token === searchVersion && error.name !== 'AbortError') showSuggestions(combine(local, [], query, tried), t('Онлайн-поиск недоступен. Попробуй ещё раз.', "Online search is unavailable. Try again.")); }
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
    <div class="result-head ${feedback.tier}" id="resultHead" role="status"><div class="result-verdict"><span class="result-icon" aria-hidden="true">${result.won ? '✓' : '♫'}</span><strong>${feedback.label}</strong><b class="result-points">${result.points ? `+${number(result.points)}` : t('0 очков', "0 points")}</b></div>
    <div class="track-reveal"><div class="cover-art"><span aria-hidden="true">♫</span>${track.cover ? `<img id="coverArt" src="${esc(track.cover)}" alt="${t("Обложка альбома", "Album cover")}" width="112" height="112">` : ''}</div><div class="track-info"><h2 id="trackTitle">${esc(track.title)}</h2><p class="artist">${esc(track.artist)}</p><p class="result-detail">${result.won ? `${t("Угадали за", "Guessed in")} ${length(LENGTHS[result.step])} ${t("с", "s")}${result.attempts?.at(-1)?.title && !sameArtist(track, result.attempts.at(-1)) ? t('. Засчитано: та же песня в другом исполнении', ". Accepted: the same song by another artist") : ''}` : result.points ? `+${ARTIST_BONUS} ${t("за исполнителя. Послушайте песню целиком", "for the artist. Listen to the full song")}` : t('Послушайте и запомните на следующий раз', "Listen and remember it for next time")}</p></div></div></div>
    <div class="reveal-actions"><span>${result.won ? t('Точный ответ. Очки ваши!', "Correct. The points are yours!") : t('Ответ раскрыт. Играем дальше?', "Answer revealed. Ready for the next one?")}</span><button class="btn primary" id="nextBtn">${state.results.length >= state.queue.length ? t('Результаты', "Results") : t('Следующий трек', "Next track")}</button></div>
    ${playerHTML(true)}<nav class="external-links" aria-label="${t("Послушать песню", "Listen to the song")}"><a href="https://www.deezer.com/track/${track.deezerId}" target="_blank" rel="noopener noreferrer">Deezer</a><a href="https://music.yandex.ru/search?text=${query}" target="_blank" rel="noopener noreferrer">${t("Яндекс Музыка", "Yandex Music")}</a><a href="https://open.spotify.com/search/${query}" target="_blank" rel="noopener noreferrer">Spotify</a></nav>${evidenceHTML(track)}</div>${historyHTML()}</div></section>`;
  $('#coverArt')?.addEventListener('error', event => { event.target.hidden = true; });
  bindPlayer(); $('#nextBtn').onclick = () => apply(nextRound(state));
}

function evidenceHTML(track) {
  const safe = (track.evidence || []).filter(e => { try { const u = new URL(e.url); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } });
  if (!safe.length) return '';
  const sourceTitle = e => t(e.title, {
    'apple-chart': `Apple Music — Top 100${e.url.includes('/ru/') ? ' Russia' : e.url.includes('/us/') ? ' USA' : ''}`,
    'apple-playlist': 'Apple Music — editorial playlist',
    'deezer-artist-top': 'Deezer — artist’s most popular songs',
    'verified-tracks': 'Half a Second — editorial hits',
  }[e.kind] || 'Music source');
  const sourcePeriod = period => period.startsWith('популярное у ') ? t(period, `popular tracks by ${period.slice('популярное у '.length)}`) : {
    'Похожие знакомые песни': t('Похожие знакомые песни', 'Similar familiar songs'),
    'Школьная ностальгия': t('Школьная ностальгия', 'School nostalgia'),
    'Из списка мамы': t('Из списка мамы', 'From mom’s playlist'),
  }[period] || period;
  return `<details class="track-evidence"><summary>${t("Откуда эта песня в подборке?", "Why is this song in the collection?")}</summary><ul>${safe.map(e => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(sourceTitle(e))}</a>${e.kind !== 'apple-playlist' && Number.isInteger(e.position) ? ` · №${e.position}` : ''}${e.period ? ` · ${esc(sourcePeriod(e.period))}` : ''}<small>${{ 'apple-playlist': t('Редакторская подборка', "Editorial collection"), 'apple-chart': t('Чарт', "Chart"), 'deezer-artist-top': t('Популярное у исполнителя на Deezer', "Artist’s top tracks on Deezer"), 'verified-tracks': t('Редакторская подборка', 'Editorial collection') }[e.kind] || t('Рейтинг', "Ranking")}${e.date ? ` · ${t("проверено", "checked")} ${new Date(e.date).toLocaleDateString(locale)}` : ''}${e.stale ? t(' · сохранённая версия', " · saved version") : ''}</small></li>`).join('')}</ul></details>`;
}

function renderSummary() {
  const won = state.results.filter(r => r.won), instant = won.filter(r => r.step === 0);
  rememberPlayed();
  stage.innerHTML = `<section class="game-shell"><div class="summary-head"><span class="kicker">${esc(gamePackTitle(state))}</span><h1>${won.length === state.results.length && won.length ? t('Все песни ваши!', "You got every song!") : t('Вот это послушали', "That was a good listen")}</h1><div class="final-score">${number(state.score)}</div><p class="sub">${t("очков на вашу компанию", "points for your group")}</p><div class="summary-stats"><span>${t("Угадали", "Guessed")} <b>${won.length} ${t("из", "of")} ${state.results.length}</b></span><span>${t("С полсекунды", "In half a second")} <b>${instant.length}</b></span></div></div><div class="result-list">${state.results.map((r, i) => { const track = trackById(r.id); return `<div class="result-row ${r.won ? 'won' : ''}"><span class="result-no">${i + 1}</span><div><b>${esc(track.title)}</b><small>${esc(track.artist)}</small></div><div class="result-value">${r.points ? `+${r.points}` : '—'}<small>${r.won ? `${length(LENGTHS[r.step])} ${t("с", "s")}` : r.points ? t('Исполнитель', "Artist") : t('Не угадали', "Missed")}</small></div></div>`; }).join('') || t('<p class="sub">Превью оказались недоступны. Выбери другую подборку.</p>', "<p class=\"sub\">The previews were unavailable. Choose another collection.</p>")}</div><div class="summary-buttons"><button class="btn primary" id="againBtn">${t("Новая партия", "New game")}</button></div></section>`;
  $('#againBtn').onclick = leave;
}

$('#artistInput').oninput = () => {
  clearTimeout(artistTimer); artistController?.abort();
  const query = $('#artistInput').value.trim(); $('#artistResults').innerHTML = '';
  if (query.length < 2) return;
  $('#artistResults').textContent = t('Ищем исполнителей…', "Searching for artists…");
  artistTimer = setTimeout(async () => {
    const controller = artistController = new AbortController();
    try {
      const artists = await service.searchArtists(query, { signal: controller.signal });
      if (controller.signal.aborted || !$('#artistDialog').open || $('#artistInput').value.trim() !== query) return;
      $('#artistResults').innerHTML = artists.length ? artists.map((a, i) => `<button class="artist-result" data-artist="${i}"><b>${esc(a.name)}</b><small>${t("Топ треков исполнителя", "Artist’s top tracks")}</small></button>`).join('') : t('<p class="sub">Не найдено. Попробуй точное написание имени.</p>', "<p class=\"sub\">No results. Try the exact artist name.</p>");
      $('#artistResults').querySelectorAll('[data-artist]').forEach(button => button.onclick = () => { const a = artists[Number(button.dataset.artist)]; customPack = { id: `artist-${a.id}`, title: a.name, icon: '♫', description: t('10 верхних треков исполнителя', "Artist’s top 10 tracks"), topLimit: 10, artists: [a] }; $('#artistDialog').close(); selectPack(customPack); });
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
  getSettings: () => ({ packId: settings.pack, packTitle: currentPack().title, catalogMode: settings.mode, rounds: settings.rounds, answerMode: settings.answerMode }),
  verifyTrack: id => service.track(id),
  showGame: game => { const focusAnswer = state?.phase === 'round' && game.phase === 'round' && state.attempts.length !== game.attempts.length; state = game; renderGame(focusAnswer); },
  stopGame: () => { screenVersion++; audioController?.abort(); player.stop(); closeSuggestions(); autoPlay = false; state = null; renderedRoundKey = null; },
  showHome: renderSetup,
});
renderSetup(); enter(stage); selectPack(currentPack());
