import { t } from '../shared/i18n.js?v=ui-20261029';
import { $, LS, me, esc, toast } from '../shared/kit.js?v=kick-1';
import { createNet } from '../shared/net.js?v=own-1';
import { localizedPackTitle } from './catalog.js?v=music-fixes-20261030';
import { createGame } from './game.js?v=locale-20261029';
import { createRoom, reduceRoom, roomView } from './multiplayer-game.js?v=locale-20261029';

const fmt = n => n.toLocaleString(t('ru-RU', 'en-US'));
const factor = n => `×${String(n).replace('.', t(',', '.'))}`;
let mqttLoad;
function loadTransport() {
  if (globalThis.mqtt) return Promise.resolve();
  return mqttLoad ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../shared/vendor/mqtt.min.js?v=5.10.1', import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => { script.remove(); mqttLoad = null; reject(new Error(t('Не удалось загрузить связь. Попробуй ещё раз.', "Could not load the connection. Try again."))); };
    document.head.append(script);
  });
}

export function createMultiplayer({ getMatch, getSettings, showGame, stopGame, showHome, verifyTrack }) {
  const stage = $('#stage'), panel = $('#musicRoom');
  let room = null, hostBase = null, renderKey = '', pending = false, generation = 0;
  const resolving = new Set();
  const dialog = document.createElement('dialog');
  dialog.className = 'music-dialog friend-dialog';
  dialog.setAttribute('aria-labelledby', 'friendTitle');
  dialog.innerHTML = `<div class="dialog-head"><div><h2 id="friendTitle">${t("Своя компания", "Your own party")}</h2><p class="sub">${t("Каждый играет со своего телефона или компьютера.", "Everyone plays on their own phone or computer.")}</p></div><button class="dialog-close" id="friendClose" aria-label="${t("Закрыть", "Close")}">×</button></div><label class="setting-label" for="friendName">${t("Как тебя зовут?", "What’s your name?")}<input class="field" id="friendName" maxlength="20" autocomplete="nickname" placeholder="${t("Твоё имя", "Your name")}"></label><button class="btn primary big" id="friendCreate">${t("Создать лобби", "Create lobby")}</button><div class="friend-divider">${t("или по приглашению друга", "or join a friend’s invitation")}</div><form id="friendJoin"><label class="setting-label" for="friendCode">${t("Код лобби", "Lobby code")}<input class="field" id="friendCode" maxlength="5" pattern="[A-Za-z2-9]{5}" placeholder="ABCDE" autocomplete="off" autocapitalize="characters" spellcheck="false"></label><button class="btn gold" type="submit">${t("Присоединиться", "Join")}</button></form><button class="btn ghost big" id="friendResume" hidden>${t("Вернуться в своё лобби", "Return to your lobby")}</button><p class="friend-error" id="friendError" role="status"></p><p class="sub">${t("До 8 игроков. Без таймера. Ведущий выбирает пластинку перед созданием лобби.", "Up to 8 players. No timer. The host picks a record before creating the lobby.")}</p>`;
  document.body.append(dialog);
  const net = createNet({
    game: 'music-friends',
    createState: (id, code) => createRoom(id, code, getSettings()),
    reduce: (s, a, from) => {
      hostBase = s.base;
      if (a?.type === 'guess' && a.answer?.kind !== 'artist' && s.phase === 'round' && a.round === s.round && s.games[from]?.phase === 'round' && a.step === s.games[from].step && !s.base.tracks.some(t => t.id === a.answer?.id)) {
        const id = a.answer?.deezerId, currentGeneration = generation, key = `${generation}:${from}:${a.round}:${a.step}`;
        if (Number.isSafeInteger(id) && id > 0 && !resolving.has(key)) {
          resolving.add(key);
          verifyTrack(id).then(answer => {
            if (generation === currentGeneration && room?.round === a.round) net.send({ type: 'verifiedGuess', by: from, round: a.round, step: a.step, answer });
          }).catch(() => { toast(t('Не удалось проверить ответ в Deezer. Попробуйте ещё раз.', "Could not verify your answer with Deezer. Try again."), 4000); }).finally(() => resolving.delete(key));
        }
        return s;
      }
      const next = reduceRoom(s, a, from); hostBase = next.base; return next;
    },
    publicView: roomView,
    onState: update,
    onLeave: () => {
      generation++; resolving.clear();
      if (dialog.open) $('#friendError').textContent = t('Не удалось войти в лобби. Проверь код и подключение.', "Could not join the lobby. Check the code and your connection.");
      room = null; hostBase = null; renderKey = ''; panel.hidden = true; panel.replaceChildren();
      document.body.classList.remove('music-multiplayer');
      const url = new URL(location.href); url.searchParams.delete('c'); history.replaceState(null, '', url);
      $('#exitBtn').textContent = t('К подборкам', "Back to collections");
      stopGame(); showHome();
    },
  });

  function send(type, extra = {}) {
    if (room) net.send({ type, round: room.round, step: room.game?.step, ...extra });
  }
  function match() {
    if (!hostBase) return getMatch();
    return { ...createGame(hostBase.tracks, { rounds: hostBase.queue.length, answerMode: hostBase.answerMode, maxPerArtist: hostBase.maxPerArtist ?? Infinity }), packId: hostBase.packId, packTitle: hostBase.packTitle, catalogMode: hostBase.catalogMode };
  }
  function start() {
    try { net.send({ type: 'start', game: match() }); } catch (error) { toast(error.message, 5000); }
  }
  function standings() {
    const players = [...room.players].sort((a, b) => b.score - a.score);
    const host = room.hostId === me.pid;
    return `<ol class="friend-players">${players.map((p, i) => `<li class="${p.id === me.pid ? 'is-me' : ''}${!p.online ? ' is-offline' : ''}"><span class="friend-place">${i + 1}</span><span class="friend-person"><b>${esc(p.name)}${p.id === me.pid ? t(' <small>вы</small>', " <small>you</small>") : ''}</b><small>${!p.online ? t('Нет связи', "Offline") : room.phase === 'lobby' ? p.id === room.hostId ? t('Ведущий', "Host") : t('В лобби', "In the lobby") : !p.participating ? t('Следующая партия', "Next game") : p.audioError ? t('Не загрузился звук', "Audio failed to load") : room.phase === 'loading' ? p.ready ? t('Звук готов ✓', "Audio ready ✓") : t('Загружает звук…', "Loading audio…") : p.done ? p.won ? `${t(`${p.rank}-й ответ`, `Answer #${p.rank}`)} · ${factor(p.multiplier)} · +${fmt(p.points)}` : t('Закончил раунд', "Finished the round") : room.phase === 'summary' ? t('Финиш', "Finished") : t('Угадывает…', "Guessing…")}</small></span><strong>${fmt(p.score)}</strong>${host && p.id !== me.pid ? `<button class="friend-kick" data-kick="${esc(p.id)}" aria-label="${t("Убрать", "Remove")} ${esc(p.name)} ${t("из лобби", "from the lobby")}" title="${t("Убрать из лобби", "Remove from lobby")}">×</button>` : ''}</li>`).join('')}</ol>`;
  }
  function bindStandings() {
    panel.querySelectorAll('[data-kick]').forEach(button => button.onclick = () => send('kick', { id: button.dataset.kick }));
    $('#friendCopy').onclick = async () => {
      const url = new URL(location.href); url.searchParams.set('c', room.code);
      try { await navigator.clipboard.writeText(url.href); toast(t('Ссылка скопирована. Отправь её друзьям.', "Link copied. Send it to your friends."), 3000); }
      catch { toast(`${t("Код лобби", "Lobby code")}: ${room.code}`, 5000); }
    };
  }
  function update(next) {
    room = next; pending = false;
    if (dialog.open) dialog.close();
    document.body.classList.add('music-multiplayer');
    $('#exitBtn').hidden = false; $('#exitBtn').textContent = t('Выйти из лобби', "Leave lobby");
    const url = new URL(location.href); url.searchParams.set('c', room.code); history.replaceState(null, '', url);
    panel.hidden = false;
    const host = room.hostId === me.pid;
    panel.innerHTML = `<div class="friend-room-heading"><div><span class="kicker">${room.phase === 'summary' ? t('Финальная таблица', "Final standings") : t('Игра с друзьями', "Play with friends")}</span><h2>${room.phase === 'summary' ? t('На вершине — ', "At the top — ") + esc([...room.players].sort((a, b) => b.score - a.score).filter(p => p.score === Math.max(...room.players.map(p => p.score))).map(p => p.name).join(', ')) : `${t("Лобби", "Lobby")} <span class="friend-room-code">${esc(room.code)}</span>`}</h2></div><button class="btn ghost" id="friendCopy">${t("Пригласить друзей ↗", "Invite friends ↗")}</button></div>${standings()}<p class="friend-scoring">${t("Очки за длину отрывка × место среди правильных ответов:", "Snippet points × correct-answer rank:")} <b>${[1.5, 1.25, 1, 0.75, 0.5].map(factor).join(" · ")}</b>. ${t("С пятого места — ×0,5. За одного исполнителя — 100 очков. Без таймера.", "Fifth place onward: ×0.5. Artist only: 100 points. No timer.")}</p>`;
    if (host && room.phase === 'loading' && room.canReplace) {
      const replacement = document.createElement('button'); replacement.className = 'btn ghost friend-loading-replace'; replacement.textContent = t('Не грузится звук? Заменить песню для всех', "Audio stuck? Replace the song for everyone"); replacement.onclick = () => send('replace'); panel.append(replacement);
    }
    if (room.phase === 'round') {
      const race = document.createElement('p'); race.className = 'friend-race-line'; race.textContent = `${t("Следующий точный ответ:", "Next correct answer:")} ${factor(room.nextMultiplier)} ${t("к очкам за отрывок", "snippet points")}`; panel.append(race);
    }
    bindStandings();
    const key = `${room.round}:${room.phase}:${room.game?.phase}:${room.game?.step}:${room.game?.attempts.length}:${room.spectator}:${['lobby', 'summary'].includes(room.phase) ? room.players.filter(p => p.online).length : ''}`;
    if (key === renderKey) return;
    renderKey = key;
    if (room.phase === 'lobby') {
      stopGame();
      stage.innerHTML = `<section class="friend-lobby"><span class="kicker">${t("Пластинка на сегодня", "Today’s record")}</span><h1>${esc(localizedPackTitle(room.settings.packId, room.settings.packTitle, room.settings.catalogMode))}</h1><p>${room.settings.rounds || 10} ${t("треков", "tracks")} · ${room.settings.answerMode === 'artist' ? t('Угадываем исполнителя', "Guess the artist") : t('Угадываем песню', "Guess the song")} · ${t("до 8 игроков", "up to 8 players")}</p><p class="sub">${t("Разошли ссылку друзьям. Все получат одни и те же песни, а длину отрывка каждый выбирает у себя.", "Share the link with friends. Everyone gets the same songs and chooses their own snippet length.")}</p>${host ? `<button class="btn primary big" id="friendStart" ${room.players.filter(p => p.online).length < 2 ? 'disabled' : ''}>${t("Начать вместе", "Start together")}</button><p class="sub">${t("Нужно хотя бы два игрока. Ты переключаешь общие раунды.", "At least two players needed. You control the shared rounds.")}</p>` : t('<p class="friend-wait-message">Пластинка ждёт. Ведущий скоро начнёт игру.</p>', "<p class=\"friend-wait-message\">The record is ready. Waiting for the host to start.</p>")}</section>`;
      $('#friendStart')?.addEventListener('click', start);
    } else if (!room.game) {
      stopGame();
      const self = room.players.find(p => p.id === me.pid);
      stage.innerHTML = room.phase === 'summary' ? t('<section class="friend-lobby"><h1>Партия завершена</h1><p>Результаты — в общей таблице. Ведущий скоро запустит следующую партию, и ты тоже сыграешь.</p></section>', "<section class=\"friend-lobby\"><h1>Game finished</h1><p>See the shared standings. Join in when the host starts the next game.</p></section>") : `<section class="friend-lobby friend-waiting"><span class="kicker">${t("Раунд", "Round")} ${room.index + 1} ${t("из", "of")} ${room.total}</span><div class="friend-wait-disc" aria-hidden="true"></div><h1>${room.spectator ? t('Ты в компании', "You’re in") : self?.won ? `${t("Есть попадание!", "Got it!")} ${factor(self.multiplier)}` : t('Раунд завершён', "Round finished")}</h1><p>${room.spectator ? t('Эта партия уже началась. Посмотри игру и присоединяйся к следующей.', "This game has already started. Watch and join the next one.") : `${t("За раунд:", "This round:")} +${fmt(self?.points || 0)}. ${t("Ждём остальных игроков.", "Waiting for the other players.")}`}</p><p class="sub">${t("Название песни появится, когда все закончат. Время не ограничено.", "The song is revealed when everyone finishes. Take your time.")}</p></section>`;
    } else {
      showGame(room.game, room);
    }
  }

  function decorate() {
    if (!room?.game) return;
    const host = room.hostId === me.pid;
    $('.friend-load-note')?.remove();
    if (room.phase === 'loading') {
      const note = document.createElement('p'); note.className = 'friend-load-note'; note.textContent = t('Готовим звук у всех игроков. Отрывок станет доступен, когда все будут готовы.', "Loading everyone’s audio. The snippet unlocks when all players are ready.");
      $('.round-top')?.after(note);
    }
    const nextButton = $('#nextBtn');
    if (nextButton) { nextButton.disabled = !host; nextButton.textContent = host ? room.index + 1 >= room.total ? t('Итоги партии', "Game results") : t('Следующая пластинка →', "Next record →") : t('Ждём ведущего', "Waiting for the host"); nextButton.onclick = () => send('next'); }
    const again = $('#againBtn');
    if (again) { again.disabled = !host || room.players.filter(p => p.online).length < 2; again.textContent = host ? t('Ещё одну партию', "Play again") : t('Ведущий запустит новую партию', "The host will start a new game"); again.onclick = start; }
    if (room.phase === 'summary') {
      const title = $('.summary-head h1'), subtitle = $('.summary-head .sub');
      if (title) title.textContent = t('Вот это сыграли', "That was a good game"); if (subtitle) subtitle.textContent = t('ваш личный счёт', "your personal score");
    }
    const replace = $('#replaceTrack');
    if (replace) { replace.hidden = !host || !room.canReplace; replace.textContent = t('Заменить песню для всех', "Replace the song for everyone"); replace.onclick = () => send('replace'); }
    if (room.phase === 'round') {
      const giveUp = $('#surrenderBtn'); if (giveUp) giveUp.textContent = t('Пас — дождаться ответа', "Pass and wait for the answer");
    }
  }

  async function connect(kind) {
    if (pending) return;
    const name = $('#friendName').value.replace(/\s+/g, ' ').trim().slice(0, 20);
    const code = $('#friendCode').value.trim().toUpperCase();
    if (!name) { $('#friendName').focus(); return; }
    if (kind === 'join' && !/^[A-Z2-9]{5}$/.test(code)) { $('#friendError').textContent = t('Введи код из пяти букв и цифр.', "Enter the five-character lobby code."); return; }
    me.name = name; LS.set('me', me); pending = true;
    $('#friendError').textContent = t('Подключаемся…', "Connecting…");
    dialog.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      if (kind === 'host') getMatch();
      await loadTransport();
      generation++;
      const saved = LS.get('music-friends.session');
      if (kind === 'resume' || kind === 'join' && saved?.host && saved.code === code) { if (!net.resume()) $('#friendError').textContent = t('Сохранённое лобби не найдено.', "Saved lobby not found."); }
      else if (kind === 'host') { hostBase = null; await net.host(); }
      else await net.join(code);
    } catch (error) { $('#friendError').textContent = error.message; }
    finally { pending = false; dialog.querySelectorAll('button').forEach(b => b.disabled = false); if (!room && $('#friendError').textContent === t('Подключаемся…', "Connecting…")) $('#friendError').textContent = kind === 'host' ? t('Не удалось создать лобби. Попробуй ещё раз.', "Could not create the lobby. Try again.") : t('Ожидаем ответ лобби…', "Waiting for the lobby…"); }
  }
  function open() {
    $('#friendName').value = me.name;
    $('#friendCode').value = new URL(location.href).searchParams.get('c')?.toUpperCase() || '';
    $('#friendResume').hidden = !LS.get('music-friends.session'); $('#friendError').textContent = '';
    dialog.showModal(); ($('#friendName').value ? $('#friendCode') : $('#friendName')).focus();
  }
  $('#friendClose').onclick = () => dialog.close();
  $('#friendCreate').onclick = () => connect('host');
  $('#friendJoin').onsubmit = e => { e.preventDefault(); connect('join'); };
  $('#friendResume').onclick = () => connect('resume');
  if (/^[A-Z2-9]{5}$/i.test(new URL(location.href).searchParams.get('c') || '')) queueMicrotask(open);
  return {
    open, send, decorate, leave: () => net.leave(),
    ready: () => send('ready'),
    audioError: () => send('audio-error'),
    get active() { return !!room; },
    get loading() { return room?.phase === 'loading'; },
    get view() { return room; },
  };
}
