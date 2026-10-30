import { artistKey, artistGroups, selectionFor, setArtistChoice, setTrackChoice, validateReview } from './review-model.js';

const data = JSON.parse(document.getElementById('review-catalog').textContent);
let state = validateReview(JSON.parse(document.getElementById('review-state').textContent));
const storageKey = 'music-editorial-review-v2';
let storageWorks = true;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (saved && saved.catalogGeneratedAt === state.catalogGeneratedAt && saved.updatedAt > state.updatedAt) state = validateReview(saved);
} catch { storageWorks = false; }
let collection = data.collections[0].id, expanded = new Set(), toastTimer;
const element = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const activeCollection = () => data.collections.find(c => c.id === collection);

function toast(message) {
  element('toast').textContent = message; element('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { element('toast').hidden = true; }, 3500);
}
function save() {
  for (const group of artistGroups(activeCollection().tracks)) {
    const choice = state.artists[collection]?.[group.key];
    if (choice && 'status' in choice) choice.status = groupChoice(group).status;
  }
  try { localStorage.setItem(storageKey, JSON.stringify(state)); storageWorks = true; } catch { storageWorks = false; }
  element('saveStatus').textContent = storageWorks
    ? 'Выбор сохранён в этом браузере. Чтобы передать решения или иметь копию, скачайте файл с выбором.'
    : 'Браузер не сохраняет выбор автоматически. Скачайте HTML-файл с выбором перед закрытием страницы.';
}
function buttons(choice, scope, key) {
  return `<div class="actions" data-scope="${scope}" data-key="${escapeHtml(key)}">${[
    ['keep', '✓ Оставить', choice.status === 'keep', 'keep'],
    ['remove', '× Удалить', choice.status === 'remove', 'remove'],
    ['more', '+ Больше', choice.more, 'flag'], ['similar', '≈ Похожие', choice.similar, 'flag'],
  ].map(([action, label, pressed, css]) => `<button class="${css}" data-action="${action}" aria-pressed="${!!pressed}">${label}</button>`).join('')}</div>`;
}
function groupChoice(group) {
  const selections = group.tracks.map(t => selectionFor(state, collection, t.id));
  return { status: selections.every(s => s.status === 'keep') ? 'keep' : selections.every(s => s.status === 'remove') ? 'remove' : 'unreviewed',
    more: !!state.artists[collection]?.[group.key]?.more, similar: !!state.artists[collection]?.[group.key]?.similar };
}
function renderNav() {
  element('collections').innerHTML = data.collections.map(c => {
    const done = c.tracks.filter(t => selectionFor(state, c.id, t.id).status !== 'unreviewed').length;
    return `<button data-collection="${c.id}" aria-current="${collection === c.id}"><span>${escapeHtml(c.title)}</span><small>${done}/${c.tracks.length}</small></button>`;
  }).join('');
}
function render() {
  const current = activeCollection(), query = artistKey(element('search').value), filter = element('filter').value;
  const groups = artistGroups(current.tracks), selections = current.tracks.map(t => selectionFor(state, collection, t.id));
  renderNav();
  element('collectionTitle').textContent = current.title;
  element('collectionMeta').textContent = `${groups.length} исполнителей · ${current.tracks.length} треков · включая совместные записи`;
  element('notice').textContent = current.notice || '';
  element('counts').innerHTML = [['Оставить', selections.filter(s => s.status === 'keep').length], ['Удалить', selections.filter(s => s.status === 'remove').length],
    ['Не разобраны', selections.filter(s => s.status === 'unreviewed').length], ['Больше', selections.filter(s => s.more).length], ['Похожие', selections.filter(s => s.similar).length]]
    .map(([label, count]) => `<span>${label}: <b>${count}</b></span>`).join('');
  const visible = track => {
    const choice = selectionFor(state, collection, track.id);
    return (!query || artistKey(track.title + ' ' + track.artistNames.join(' ')).includes(query)) &&
      (filter === 'all' || (['more', 'similar'].includes(filter) ? choice[filter] : choice.status === filter));
  };
  element('artists').innerHTML = groups.map(group => {
    const tracks = group.tracks.filter(visible);
    if (!tracks.length) return '';
    const choice = groupChoice(group), open = expanded.has(group.key) || !!query;
    return `<details class="artist" data-artist="${escapeHtml(group.key)}" data-status="${choice.status}" ${open ? 'open' : ''}>
      <summary><div class="artist-name"><b>${escapeHtml(group.name)}</b><small>${group.tracks.length} тр.</small></div>${buttons(choice, 'artist', group.key)}</summary>
      <div class="tracks">${tracks.map(track => {
        const c = selectionFor(state, collection, track.id);
        return `<div class="track" data-status="${c.status}"><div class="track-title">${escapeHtml(track.title)}<a href="https://www.deezer.com/track/${track.deezerId}" target="_blank" rel="noopener noreferrer">Послушать ↗</a><small>${escapeHtml(track.artistNames.join(', '))}</small></div>
          ${buttons(c, 'track', track.id)}<input class="note" data-note="${track.id}" value="${escapeHtml(c.note || '')}" maxlength="2000" aria-label="Комментарий к ${escapeHtml(track.title)}" placeholder="Что искать похожее или почему убрать…"></div>`;
      }).join('')}</div></details>`;
  }).join('') || '<p class="empty">По этому запросу ничего нет. Попробуйте другое имя или снимите фильтр.</p>';
}
element('collections').addEventListener('click', event => {
  const button = event.target.closest('[data-collection]'); if (!button) return;
  collection = button.dataset.collection; expanded.clear(); element('search').value = ''; element('filter').value = 'all'; render();
});
element('artists').addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  event.preventDefault();
  const container = button.closest('[data-scope]'), key = container.dataset.key, scope = container.dataset.scope;
  const field = ['keep', 'remove'].includes(button.dataset.action) ? 'status' : button.dataset.action;
  const choice = scope === 'artist' ? groupChoice(artistGroups(activeCollection().tracks).find(g => g.key === key)) : selectionFor(state, collection, key);
  const value = field === 'status' ? (choice.status === button.dataset.action ? 'unreviewed' : button.dataset.action) : !choice[field];
  if (scope === 'artist') setArtistChoice(state, collection, key, activeCollection().tracks, field, value);
  else setTrackChoice(state, collection, key, field, value);
  const scroll = window.scrollY;
  save(); render();
  const replacement = [...element('artists').querySelectorAll('[data-scope]')].find(n => n.dataset.scope === scope && n.dataset.key === key);
  replacement?.querySelector(`[data-action="${button.dataset.action}"]`)?.focus({ preventScroll: true });
  window.scrollTo(0, scroll);
});
element('artists').addEventListener('toggle', event => {
  const key = event.target.dataset.artist;
  if (key) { if (event.target.open) expanded.add(key); else expanded.delete(key); }
}, true);
element('artists').addEventListener('input', event => {
  if (event.target.dataset.note) { setTrackChoice(state, collection, event.target.dataset.note, 'note', event.target.value); save(); }
});
element('search').addEventListener('input', render);
element('filter').addEventListener('change', render);
element('expandAll').onclick = () => { expanded = new Set(artistGroups(activeCollection().tracks).map(g => g.key)); render(); };
element('collapseAll').onclick = () => { expanded.clear(); element('search').value = ''; render(); };

function download(content, name, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime })), link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const dateSuffix = () => new Date().toISOString().slice(0, 10);
element('saveHtml').onclick = () => {
  const copy = document.documentElement.cloneNode(true);
  copy.querySelector('#review-state').textContent = JSON.stringify(state).replace(/</g, '\\u003c');
  copy.querySelector('#toast').hidden = true;
  download('<!doctype html>\n' + copy.outerHTML, `music-review-${dateSuffix()}.html`, 'text/html;charset=utf-8');
  toast('Скачан HTML с вашими отметками. Его можно открыть снова или прислать в чат.');
};
element('saveJson').onclick = () => download(JSON.stringify({ ...state, collections: data.collections.map(c => ({ id: c.id, title: c.title,
  tracks: c.tracks.filter(t => state.tracks[c.id]?.[t.id]).map(t => ({ ...t, ...selectionFor(state, c.id, t.id) })) })) }, null, 2), `music-decisions-${dateSuffix()}.json`, 'application/json');
element('importJson').onclick = () => element('importFile').click();
element('importFile').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('Слишком большой файл.');
    const imported = validateReview(JSON.parse(await file.text()));
    if (imported.intentVersion !== 2) throw new Error('Старый файл смешивает артистов и гостей. Пришлите его в чат для безопасного применения.');
    if (imported.catalogGeneratedAt !== state.catalogGeneratedAt) throw new Error('Это решения для другой версии каталога. Откройте HTML, сохранённый вместе с ними.');
    state = imported; state.updatedAt = Date.now(); save(); render(); toast('Решения загружены.');
  } catch (error) { toast(error.message || 'Не удалось прочитать файл.'); }
  event.target.value = '';
};
render(); save();
