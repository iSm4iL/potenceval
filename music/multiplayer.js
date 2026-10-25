import { $, LS, me, esc, toast } from '../shared/kit.js?v=kick-1';
import { createNet } from '../shared/net.js?v=own-1';
import { createGame } from './game.js';
import { createRoom, reduceRoom, roomView } from './multiplayer-game.js';

const fmt = n => n.toLocaleString('ru-RU');
const factor = n => `×${String(n).replace('.', ',')}`;
let mqttLoad;
function loadTransport() {
  if (globalThis.mqtt) return Promise.resolve();
  return mqttLoad ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../shared/vendor/mqtt.min.js', import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => { script.remove(); mqttLoad = null; reject(new Error('Не удалось загрузить связь. Попробуй ещё раз.')); };
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
  dialog.innerHTML = `<div class="dialog-head"><div><h2 id="friendTitle">Своя компания</h2><p class="sub">Каждый играет со своего телефона или компьютера.</p></div><button class="dialog-close" id="friendClose" aria-label="Закрыть">×</button></div><label class="setting-label" for="friendName">Как тебя зовут?<input class="field" id="friendName" maxlength="20" autocomplete="nickname" placeholder="Твоё имя"></label><button class="btn primary big" id="friendCreate">Создать лобби</button><div class="friend-divider">или по приглашению друга</div><form id="friendJoin"><label class="setting-label" for="friendCode">Код лобби<input class="field" id="friendCode" maxlength="5" pattern="[A-Za-z2-9]{5}" placeholder="ABCDE" autocomplete="off" autocapitalize="characters" spellcheck="false"></label><button class="btn gold" type="submit">Присоединиться</button></form><button class="btn ghost big" id="friendResume" hidden>Вернуться в своё лобби</button><p class="friend-error" id="friendError" role="status"></p><p class="sub">До 8 игроков. Без таймера. Ведущий выбирает пластинку перед созданием лобби.</p>`;
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
          }).catch(() => { toast('Не удалось проверить ответ в Deezer. Попробуйте ещё раз.', 4000); }).finally(() => resolving.delete(key));
        }
        return s;
      }
      const next = reduceRoom(s, a, from); hostBase = next.base; return next;
    },
    publicView: roomView,
    onState: update,
    onLeave: () => {
      generation++; resolving.clear();
      if (dialog.open) $('#friendError').textContent = 'Не удалось войти в лобби. Проверь код и подключение.';
      room = null; hostBase = null; renderKey = ''; panel.hidden = true; panel.replaceChildren();
      document.body.classList.remove('music-multiplayer');
      const url = new URL(location.href); url.searchParams.delete('c'); history.replaceState(null, '', url);
      $('#exitBtn').textContent = 'К подборкам';
      stopGame(); showHome();
    },
  });

  function send(type, extra = {}) {
    if (room) net.send({ type, round: room.round, step: room.game?.step, ...extra });
  }
  function match() {
    if (!hostBase) return getMatch();
    return { ...createGame(hostBase.tracks, { rounds: hostBase.queue.length, answerMode: hostBase.answerMode, maxPerArtist: hostBase.maxPerArtist ?? Infinity }), packId: hostBase.packId, packTitle: hostBase.packTitle };
  }
  function start() {
    try { net.send({ type: 'start', game: match() }); } catch (error) { toast(error.message, 5000); }
  }
  function standings() {
    const players = [...room.players].sort((a, b) => b.score - a.score);
    const host = room.hostId === me.pid;
    return `<ol class="friend-players">${players.map((p, i) => `<li class="${p.id === me.pid ? 'is-me' : ''}${!p.online ? ' is-offline' : ''}"><span class="friend-place">${i + 1}</span><span class="friend-person"><b>${esc(p.name)}${p.id === me.pid ? ' <small>вы</small>' : ''}</b><small>${!p.online ? 'Нет связи' : room.phase === 'lobby' ? p.id === room.hostId ? 'Ведущий' : 'В лобби' : !p.participating ? 'Следующая партия' : p.audioError ? 'Не загрузился звук' : room.phase === 'loading' ? p.ready ? 'Звук готов ✓' : 'Загружает звук…' : p.done ? p.won ? `${p.rank}-й ответ · ${factor(p.multiplier)} · +${fmt(p.points)}` : 'Закончил раунд' : room.phase === 'summary' ? 'Финиш' : 'Угадывает…'}</small></span><strong>${fmt(p.score)}</strong>${host && p.id !== me.pid ? `<button class="friend-kick" data-kick="${esc(p.id)}" aria-label="Убрать ${esc(p.name)} из лобби" title="Убрать из лобби">×</button>` : ''}</li>`).join('')}</ol>`;
  }
  function bindStandings() {
    panel.querySelectorAll('[data-kick]').forEach(button => button.onclick = () => send('kick', { id: button.dataset.kick }));
    $('#friendCopy').onclick = async () => {
      const url = new URL(location.href); url.searchParams.set('c', room.code);
      try { await navigator.clipboard.writeText(url.href); toast('Ссылка скопирована. Отправь её друзьям.', 3000); }
      catch { toast(`Код лобби: ${room.code}`, 5000); }
    };
  }
  function update(next) {
    room = next; pending = false;
    if (dialog.open) dialog.close();
    document.body.classList.add('music-multiplayer');
    $('#exitBtn').hidden = false; $('#exitBtn').textContent = 'Выйти из лобби';
    const url = new URL(location.href); url.searchParams.set('c', room.code); history.replaceState(null, '', url);
    panel.hidden = false;
    const host = room.hostId === me.pid;
    panel.innerHTML = `<div class="friend-room-heading"><div><span class="kicker">${room.phase === 'summary' ? 'Финальная таблица' : 'Игра с друзьями'}</span><h2>${room.phase === 'summary' ? 'На вершине — ' + esc([...room.players].sort((a, b) => b.score - a.score).filter(p => p.score === Math.max(...room.players.map(p => p.score))).map(p => p.name).join(', ')) : `Лобби <span class="friend-room-code">${esc(room.code)}</span>`}</h2></div><button class="btn ghost" id="friendCopy">Пригласить друзей ↗</button></div>${standings()}<p class="friend-scoring">Очки за длину отрывка × место среди правильных ответов: <b>×1,5 · ×1,25 · ×1 · ×0,75 · ×0,5</b>. С пятого места — ×0,5. За одного исполнителя — 100 очков. Без таймера.</p>`;
    if (host && room.phase === 'loading' && room.canReplace) {
      const replacement = document.createElement('button'); replacement.className = 'btn ghost friend-loading-replace'; replacement.textContent = 'Не грузится звук? Заменить песню для всех'; replacement.onclick = () => send('replace'); panel.append(replacement);
    }
    if (room.phase === 'round') {
      const race = document.createElement('p'); race.className = 'friend-race-line'; race.textContent = `Следующий точный ответ: ${factor(room.nextMultiplier)} к очкам за отрывок`; panel.append(race);
    }
    bindStandings();
    const key = `${room.round}:${room.phase}:${room.game?.phase}:${room.game?.step}:${room.game?.attempts.length}:${room.spectator}:${['lobby', 'summary'].includes(room.phase) ? room.players.filter(p => p.online).length : ''}`;
    if (key === renderKey) return;
    renderKey = key;
    if (room.phase === 'lobby') {
      stopGame();
      stage.innerHTML = `<section class="friend-lobby"><span class="kicker">Пластинка на сегодня</span><h1>${esc(room.settings.packTitle || 'Музыка')}</h1><p>${room.settings.rounds || 10} треков · ${room.settings.answerMode === 'artist' ? 'Угадываем исполнителя' : 'Угадываем песню'} · до 8 игроков</p><p class="sub">Разошли ссылку друзьям. Все получат одни и те же песни, а длину отрывка каждый выбирает у себя.</p>${host ? `<button class="btn primary big" id="friendStart" ${room.players.filter(p => p.online).length < 2 ? 'disabled' : ''}>Начать вместе</button><p class="sub">Нужно хотя бы два игрока. Ты переключаешь общие раунды.</p>` : '<p class="friend-wait-message">Пластинка ждёт. Ведущий скоро начнёт игру.</p>'}</section>`;
      $('#friendStart')?.addEventListener('click', start);
    } else if (!room.game) {
      stopGame();
      const self = room.players.find(p => p.id === me.pid);
      stage.innerHTML = room.phase === 'summary' ? '<section class="friend-lobby"><h1>Партия завершена</h1><p>Результаты — в общей таблице. Ведущий скоро запустит следующую партию, и ты тоже сыграешь.</p></section>' : `<section class="friend-lobby friend-waiting"><span class="kicker">Раунд ${room.index + 1} из ${room.total}</span><div class="friend-wait-disc" aria-hidden="true"></div><h1>${room.spectator ? 'Ты в компании' : self?.won ? `Есть попадание! ${factor(self.multiplier)}` : 'Раунд завершён'}</h1><p>${room.spectator ? 'Эта партия уже началась. Посмотри игру и присоединяйся к следующей.' : `За раунд: +${fmt(self?.points || 0)}. Ждём остальных игроков.`}</p><p class="sub">Название песни появится, когда все закончат. Время не ограничено.</p></section>`;
    } else {
      showGame(room.game, room);
    }
  }

  function decorate() {
    if (!room?.game) return;
    const host = room.hostId === me.pid;
    $('.friend-load-note')?.remove();
    if (room.phase === 'loading') {
      const note = document.createElement('p'); note.className = 'friend-load-note'; note.textContent = 'Готовим звук у всех игроков. Отрывок станет доступен, когда все будут готовы.';
      $('.round-top')?.after(note);
    }
    const nextButton = $('#nextBtn');
    if (nextButton) { nextButton.disabled = !host; nextButton.textContent = host ? room.index + 1 >= room.total ? 'Итоги партии' : 'Следующая пластинка →' : 'Ждём ведущего'; nextButton.onclick = () => send('next'); }
    const again = $('#againBtn');
    if (again) { again.disabled = !host || room.players.filter(p => p.online).length < 2; again.textContent = host ? 'Ещё одну партию' : 'Ведущий запустит новую партию'; again.onclick = start; }
    if (room.phase === 'summary') {
      const title = $('.summary-head h1'), subtitle = $('.summary-head .sub');
      if (title) title.textContent = 'Вот это сыграли'; if (subtitle) subtitle.textContent = 'ваш личный счёт';
    }
    const replace = $('#replaceTrack');
    if (replace) { replace.hidden = !host || !room.canReplace; replace.textContent = 'Заменить песню для всех'; replace.onclick = () => send('replace'); }
    if (room.phase === 'round') {
      const giveUp = $('#surrenderBtn'); if (giveUp) giveUp.textContent = 'Пас — дождаться ответа';
    }
  }

  async function connect(kind) {
    if (pending) return;
    const name = $('#friendName').value.replace(/\s+/g, ' ').trim().slice(0, 20);
    const code = $('#friendCode').value.trim().toUpperCase();
    if (!name) { $('#friendName').focus(); return; }
    if (kind === 'join' && !/^[A-Z2-9]{5}$/.test(code)) { $('#friendError').textContent = 'Введи код из пяти букв и цифр.'; return; }
    me.name = name; LS.set('me', me); pending = true;
    $('#friendError').textContent = 'Подключаемся…';
    dialog.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      if (kind === 'host') getMatch();
      await loadTransport();
      generation++;
      const saved = LS.get('music-friends.session');
      if (kind === 'resume' || kind === 'join' && saved?.host && saved.code === code) { if (!net.resume()) $('#friendError').textContent = 'Сохранённое лобби не найдено.'; }
      else if (kind === 'host') { hostBase = null; await net.host(); }
      else await net.join(code);
    } catch (error) { $('#friendError').textContent = error.message; }
    finally { pending = false; dialog.querySelectorAll('button').forEach(b => b.disabled = false); if (!room && $('#friendError').textContent === 'Подключаемся…') $('#friendError').textContent = kind === 'host' ? 'Не удалось создать лобби. Попробуй ещё раз.' : 'Ожидаем ответ лобби…'; }
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
