// Флажок «Проблема с треком»: жалоба уходит push-уведомлением в ntfy.sh (без регистрации).
// Читать жалобы: приложение ntfy → подписка на тему ниже, или https://ntfy.sh/<тема> в браузере.
import { $, LS, toast } from '../shared/kit.js';
import { reportPlaybackError } from '../shared/diagnostics.js';

export const REPORT_TOPIC = 'potenceval-halfsec-reports-b28430b1bd8c';
const REASONS = { silent: 'Не играет / тишина', wrong: 'Не подходит к подборке', answer: 'Правильный ответ не засчитало', other: 'Другое' };
const stage = $('#stage');

document.head.insertAdjacentHTML('beforeend', `<style>
.report-flag{margin-left:auto;align-self:center;padding:7px 11px;border-radius:99px;border:1px solid var(--line);background:none;color:var(--muted);font-size:12px;cursor:pointer}
.report-flag:hover{color:var(--text);border-color:var(--pink)}
.report-dialog{max-width:420px;width:calc(100% - 32px);padding:22px;border-radius:18px;border:1px solid var(--line);background:var(--surface,#1a1825);color:var(--text)}
.report-dialog::backdrop{background:#0009}
.report-dialog h2{font-size:18px;margin:0 0 4px}.report-dialog p{margin:0 0 14px;color:var(--muted);font-size:13px}
.report-dialog label{display:flex;gap:9px;align-items:center;padding:9px 0;font-size:14px;cursor:pointer}
.report-dialog textarea{width:100%;margin-top:8px;min-height:64px;resize:vertical;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit;font-size:13px}
.report-dialog .row{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
</style>`);

function track() {
  try { return JSON.parse(stage.dataset.reportTrack || 'null'); } catch { return null; }
}

function open() {
  const t = track(); if (!t) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'report-dialog';
  dialog.innerHTML = `<form method="dialog"><h2>Что не так с треком?</h2><p>Сообщение уйдёт автору сайта. Ответ не подсказываем: название увидит только он.</p>
    ${Object.entries(REASONS).map(([k, v], i) => `<label><input type="radio" name="reason" value="${k}" ${i ? '' : 'checked'}>${v}</label>`).join('')}
    <textarea name="note" maxlength="300" placeholder="Можно пояснить (необязательно)"></textarea>
    <div class="row"><button class="btn ghost" value="cancel">Отмена</button><button class="btn primary" value="send">Отправить</button></div></form>`;
  document.body.append(dialog);
  dialog.addEventListener('close', () => { if (dialog.returnValue === 'send') send(t, new FormData(dialog.querySelector('form'))); dialog.remove(); });
  dialog.showModal();
}

async function send(t, form) {
  const reason = REASONS[form.get('reason')] || REASONS.other, note = String(form.get('note') || '').trim().slice(0, 300);
  const body = `${reason}\n${t.artist} — ${t.title}\nПодборка: ${t.pack}\nhttps://www.deezer.com/track/${t.id}${note ? `\n\n«${note}»` : ''}`;
  try {
    // заголовок — параметром: в HTTP-заголовках кириллица запрещена
    const url = `https://ntfy.sh/${REPORT_TOPIC}?${new URLSearchParams({ title: `Полсекунды: ${reason}`, tags: 'warning' })}`;
    const response = await fetch(url, { method: 'POST', body });
    if (!response.ok) throw new Error(response.status);
    LS.set('music.reported', [...new Set([...(LS.get('music.reported') || []), t.id])].slice(-200));
    toast('Спасибо! Жалоба отправлена, разберёмся с треком.', 3000);
  } catch { toast('Не получилось отправить жалобу. Проверьте интернет и попробуйте ещё раз.', 3500); }
}

function decorate() {
  const head = stage.querySelector('.game-shell .round-top');
  if (!head || !track()) return;
  // рядом с очками и звуком, если магазин пластинок уже собрал эту строку
  const host = head.querySelector('.round-controls') || head, old = head.querySelector('.report-flag');
  if (old) { if (old.parentElement !== host) host.append(old); return; }
  const flag = document.createElement('button');
  flag.type = 'button'; flag.className = 'report-flag'; flag.textContent = '⚑ Проблема с треком';
  flag.title = 'Не играет или не подходит к подборке — сообщите нам';
  flag.onclick = open;
  host.append(flag);
}

// Окно ошибки звука показалось — сообщаем сами, с текстом ошибки, устройством и сетью.
function watchAudioError() {
  const box = stage.querySelector('#audioError');
  if (box && !box.hidden && !box.dataset.reported) {
    box.dataset.reported = '1';
    reportPlaybackError('Полсекунды', track(), stage.querySelector('#audioErrorText')?.textContent || 'ошибка звука');
  }
}

new MutationObserver(() => { decorate(); watchAudioError(); }).observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
decorate();
