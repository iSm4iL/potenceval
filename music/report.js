import { t } from '../shared/i18n.js?v=ui-20261029';
import { $ } from '../shared/kit.js';

const SUPPORT_EMAIL = 'sorcery.aura.game@gmail.com';
const REASONS = { silent: t('Не играет / тишина', "Won’t play / no sound"), wrong: t('Не подходит к подборке', "Doesn’t fit this collection"), answer: t('Правильный ответ не засчитало', "Correct answer was rejected"), other: t('Другое', "Other") };
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
  const song = track(); if (!song) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'report-dialog';
  dialog.innerHTML = `<form method="dialog"><h2>${t("Что не так с треком?", "What’s wrong with this track?")}</h2><p>${t("Откроется черновик письма. Проверьте его и отправьте сами. Если почта не настроена, напишите на", "Your mail app opens a draft for you to review and send. If no mail app is set up, write to")} <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
    ${Object.entries(REASONS).map(([k, v], i) => `<label><input type="radio" name="reason" value="${k}" ${i ? '' : 'checked'}>${v}</label>`).join('')}
    <textarea name="note" maxlength="300" placeholder="${t("Можно пояснить (необязательно)", "Add details (optional)")}"></textarea>
    <div class="row"><button class="btn ghost" value="cancel">${t("Отмена", "Cancel")}</button><button class="btn primary" value="send">${t("Открыть письмо", "Open email")}</button></div></form>`;
  document.body.append(dialog);
  dialog.addEventListener('close', () => { if (dialog.returnValue === 'send') send(song, new FormData(dialog.querySelector('form'))); dialog.remove(); });
  dialog.showModal();
}

function send(song, form) {
  const reason = REASONS[form.get('reason')] || REASONS.other, note = String(form.get('note') || '').trim().slice(0, 300);
  const body = `${reason}\n${song.artist} — ${song.title}\n${t('Подборка:', 'Collection:')} ${song.pack}\nhttps://www.deezer.com/track/${song.id}${note ? `\n\n«${note}»` : ''}`;
  const subject = `${t("Полсекунды", "Half a Second")}: ${reason}`;
  location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replaceAll('\n', '\r\n'))}`;
}

function decorate() {
  const head = stage.querySelector('.game-shell .round-top');
  if (!head || !track()) return;
  // рядом с очками и звуком, если магазин пластинок уже собрал эту строку
  const host = head.querySelector('.round-controls') || head, old = head.querySelector('.report-flag');
  if (old) { if (old.parentElement !== host) host.append(old); return; }
  const flag = document.createElement('button');
  flag.type = 'button'; flag.className = 'report-flag'; flag.textContent = t('⚑ Проблема с треком', "⚑ Report a track");
  flag.title = t('Не играет или не подходит к подборке — сообщите нам', "Can’t play it or doesn’t fit the collection? Let us know");
  flag.onclick = open;
  host.append(flag);
}

new MutationObserver(decorate).observe(stage, { childList: true, subtree: true });
decorate();
