import { $, esc, LS, toast, confetti, A, SPRING, nudge } from '../shared/kit.js';
import { PACKS, COUNTRIES, t, lang, countryCount, localizeWorld } from './i18n.js?v=clues-20261107';
import { WORLD as WORLD_RU, SHAPES } from './atlas.js?v=clues-20261025';
import { PHOTOS, PERSON_PHOTOS, PERSON_DEPICTIONS } from './photos.js?v=brand-photos-20261107';
import { banknoteHTML, banknoteFor, banknoteKind } from './banknotes.js?v=media-20261107';
import { WALKS } from './walks.js?v=urban-20261107';
import { streetViewUrl, streetViewLink } from './maps.js?v=walks-20261107';
import { BRANDS } from './brands.js';
import { BRAND_MEDIA } from './brand-media.js?v=logos-20261108';
import { PHOTO_CREDITS } from './media-credits.js?v=media-20261107';
import { MONEY } from './content.js?v=atlas-20261028b';
import { CLUES, START, WRONG, DIRECTION_COST, buyDirection, norm, nameIndex, matchCountry, canOpen, cluePrice, currencyPrice, openClue, refundWalk, guess, guidance, surrender, createGame, award, nextRound, selectFacts } from './game.js?v=clues-20261107';

const WORLD = localizeWorld(WORLD_RU);
const stage = $('#stage'), byId = new Map(COUNTRIES.map(c => [c.id, c]));
const world = new Map(WORLD.map(w => [w[0], w])), names = nameIndex([...WORLD_RU, ...WORLD], COUNTRIES);
const at = id => world.get(id).slice(2), nameOf = id => byId.get(id)?.name || world.get(id)?.[1] || id;
const num = n => n.toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU');
const searchCountries = WORLD.map(([id, name]) => ({id, name:nameOf(id), aliases:[name, WORLD_RU.find(w => w[0] === id)[1], ...(byId.get(id)?.aliases || [])]}));
const directions = { '↑':t('На север','North'), '↗':t('На северо-восток','Northeast'), '→':t('На восток','East'), '↘':t('На юго-восток','Southeast'), '↓':t('На юг','South'), '↙':t('На юго-запад','Southwest'), '←':t('На запад','West'), '↖':t('На северо-запад','Northwest') };
const iconPaths = {
 fact1:'M6 3h9l3 3v15H6z M9 10h6 M9 14h6 M9 18h4',
 fact2:'M6 3h9l3 3v15H6z M9 10h6 M9 14h6 M9 18h4',
 phrase:'M3 5h12 M9 3v2 M5 8c2 4 5 7 9 8 M12 5c0 5-4 10-9 12 M14 21l4-11 4 11 M16 17h4',
 food:'M5 3v7 M2 3v5c0 3 6 3 6 0V3 M5 11v10 M18 3c-4 3-4 9 0 9h2V3z M20 12v9',
 money:'M3 6h18v12H3z M7 6v3H3 M17 18v-3h4 M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6',
 person:'M12 3a4 4 0 1 0 0 8 4 4 0 1 0 0-8 M4 21v-3c0-6 16-6 16 0v3z',
 walk:'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16',
 brand:'M3 4h8l10 10-7 7L3 10z M7 8h.01',
};
const clueIcon = key => `<svg class="clue-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[key]}"/></svg>`;
const saved = LS.get('geo.setup') || {};
const settings = { pack: PACKS.some(p => p.id === saved.pack) ? saved.pack : 'europe', rounds:[5,10,15].includes(saved.rounds) ? saved.rounds : 5, mode:saved.mode === 'team' ? 'team' : 'solo', players:Array.isArray(saved.players) ? saved.players.filter(p=>typeof p==='string').slice(0,4) : [] };
const persist = () => LS.set('geo.setup', settings);
const poolOf = pack => COUNTRIES.filter(c => pack === 'all' || c.area === pack).map(c => c.id);
const mapsKey = document.querySelector('meta[name="google-maps-embed-key"]')?.content?.trim() || '';
const spotsOf = id => WALKS[id]?.length ? WALKS[id] : null;
const personOf = c => c.person;
// Recipe-based illustrations for clues with no verified photograph.
const FOOD_ART = {
  TM:'assets/food-art/dograma.webp',
  PA:'assets/food-art/sancocho.webp',
  WS:'assets/food-art/palusami.webp',
};
const shape = id => `<svg viewBox="-20 -20 1040 1040" aria-label="${t("Контур страны","Country outline")}"><path d="${SHAPES[id]}"/></svg>`;
const exitBtn=$('#exitBtn'), AVATARS=['🕵️','🦊','🐱','🦉'];
const roundChoices=pack=>{const max=poolOf(pack).length;return [5,10,15].filter(n=>n<=max);};
let freshClue=null;
let game = null, active = 'fact1', roundFacts = [], settled = false;

function home() {
  game = null; resetWalk(); document.body.classList.remove('is-investigating');
  exitBtn.hidden = true; $('#progress').hidden = true;
  stage.innerHTML = `<section class="desk">
    <div class="folder">
      <div class="folder-page folder-left">
        <div class="folder-tab">${t('Досье №','File no.')} 001</div>
        <span class="stamp-secret">${t("Отдел расследований","Investigation bureau")}</span>
        <h1>${t("Угадай страну","Guess the country")}</h1>
        <p class="lead">${t("Выбери папку, открой улики и вычисли страну. Чем меньше улик понадобится, тем больше очков останется.","Pick a folder, follow the evidence and identify the country. Use fewer clues to keep more points.")}</p>
        <figure class="detective-scene"><img src="../shared/assets/club/geo.webp" alt="" width="768" height="512"></figure>
      </div>
      <div class="folder-page folder-right">
        <h2 id="caseFilesLabel">${t("Выбери папку дела","Choose a case file")}</h2>
        <div class="packs" id="caseFiles" role="radiogroup" aria-labelledby="caseFilesLabel">${PACKS.map((p,i) => `<label class="pack"><input type="radio" name="geo-pack" data-pack="${p.id}" ${p.id === settings.pack ? 'checked' : ''}><span class="file-tab" aria-hidden="true">0${i+1}</span><b>${p.name}</b><small>${countryCount(poolOf(p.id).length)}</small></label>`).join('')}</div>
        <div class="setup-row">
          <div><h2 id="roundsLabel">${t("Сколько дел","Number of cases")}</h2><div class="rounds" id="rounds" role="group" aria-labelledby="roundsLabel"></div></div>
          <div><h2>${t("Кто расследует","Investigators")}</h2><div class="modes" role="radiogroup" aria-label="${t("Режим","Mode")}">
            <button data-mode="solo" role="radio">${t("Я один","Solo")}</button>
            <button data-mode="team" role="radio">${t("С друзьями","With friends")}</button>
          </div></div>
        </div>
        <div class="team" id="team"></div>
        <button class="btn primary big" id="startBtn">${t("Открыть дело","Open case")}</button>
      </div>
    </div>
  </section>`;
  const drawRounds = () => {
    const list = roundChoices(settings.pack);
    if (!list.includes(settings.rounds)) settings.rounds = list[0];
    $('#rounds').innerHTML = list.map(n => `<button class="${n === settings.rounds ? 'on' : ''}" aria-pressed="${n === settings.rounds}" data-rounds="${n}">${n}</button>`).join('');
  };
  const drawTeam = () => {
    stage.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === settings.mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    const team = $('#team');
    team.hidden = settings.mode !== 'team';
    team.innerHTML = settings.players.map((p, i) => `<span class="agent">${AVATARS[i]} ${esc(p)}<button data-drop="${i}" aria-label="${t("Убрать ","Remove ")}${esc(p)}">×</button></span>`).join('')
      + (settings.players.length < 4 ? `<form class="agent-add" id="addForm"><input class="field" id="agentName" maxlength="16" placeholder="${settings.players.length < 2 ? t(`Имя ${settings.players.length + 1}-го следователя`, `Investigator ${settings.players.length + 1} name`) : t('Ещё имя','Another name')}" autocomplete="off"><button class="btn ghost" aria-label="${t("Добавить","Add")}">+</button></form>` : '');
    $('#addForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#agentName').value.replace(/\s+/g, ' ').trim();
      if (!v) return nudge($('#agentName'));
      settings.players.push(v); persist(); drawTeam(); $('#agentName')?.focus();
    });
  };
  drawRounds(); drawTeam();
  $('#caseFiles').onchange = e => {
    settings.pack = e.target.dataset.pack;
    drawRounds();
    persist();
  };
  stage.onclick = e => {
    const rounds = e.target.closest('[data-rounds]'), drop = e.target.closest('[data-drop]'), mode = e.target.closest('[data-mode]');
    if (rounds) { settings.rounds = +rounds.dataset.rounds; persist(); drawRounds(); }
    if (drop) { settings.players.splice(+drop.dataset.drop, 1); persist(); drawTeam(); }
    if (mode) { settings.mode = mode.dataset.mode; persist(); drawTeam(); if (settings.mode === 'team') $('#agentName')?.focus(); }
  };
  $('#startBtn').onclick = start;
  A($('.folder'), [{ opacity: 0, transform: 'translateY(40px) rotate(-1.5deg)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: SPRING });
}

function start() {
  const typed=$('#agentName')?.value.trim(); if(settings.mode==='team'&&typed&&settings.players.length<4){settings.players.push(typed.slice(0,20));persist();}
  if(settings.mode==='team' && settings.players.length<2) return toast(t('Добавь хотя бы двух следователей кнопкой +.','Add at least two investigators using the + button.'),3000);
  stage.onclick=null;
  const recent = LS.get('geo.recent') || [];
  game = createGame(poolOf(settings.pack),settings.rounds,settings.mode==='team'?settings.players:[t('Ты','You')],{recent:Array.isArray(recent)?recent:[],pricesOf:id=>({money:currencyPrice(MONEY[id],Object.values(MONEY))}),unavailableOf:id=>[...(!spotsOf(id)?['walk']:[]),...(!personOf(byId.get(id))?['person']:[])]});
  beginRound();
}
function beginRound() {
  resetWalk(); active='fact1'; settled=false;
  const c=byId.get(game.round.id), historyKey=lang==='ru'?'geo.facts.v3':'geo.facts.v3.en', history=LS.get(historyKey) || {};
  const facts=c.facts, used=Array.isArray(history[c.id])?history[c.id]:[];
  roundFacts=selectFacts(c.factEntries,used,Math.random,c.personSubjects);
  const unique=[...new Set(facts)];
  history[c.id]=[...new Set([...used,...roundFacts])];
  if(history[c.id].length>=unique.length) history[c.id]=roundFacts;
  LS.set(historyKey,history);
  const recent=LS.get('geo.recent');
  LS.set('geo.recent',[...(Array.isArray(recent)?recent:[]).filter(id=>id!==c.id),c.id].slice(-COUNTRIES.length));
  renderRound(); scrollTo({top:0,behavior:'instant'});
}
function renderRound() {
  const r=game.round;
  document.body.classList.add('is-investigating');
  $('#exitBtn').hidden=false; $('#progress').hidden=false;
  $('#progressText').textContent=t(`Дело ${game.index+1} из ${game.order.length}`, `Case ${game.index+1} of ${game.order.length}`);
  $('#progressBar').style.width=`${(game.index+1)/game.order.length*100}%`;
  stage.innerHTML=`<section class="case"><div class="scene"><div class="frame"><div class="plaque">${t('Дело №','Case no.')} ${String(game.index+1).padStart(3,'0')} · ${esc(PACKS.find(p=>p.id===settings.pack).name)}</div><div class="board" id="clueMenu" aria-label="${t("Доска расследования","Investigation board")}"></div></div><p class="board-help">${t("Нажми на открытую заметку, чтобы рассмотреть её крупнее.","Select an open note to inspect it more closely.")}</p></div><aside class="notebook answer-panel" id="notebook"><h2>${t("Что это за страна?","Which country is it?")}</h2><form class="guess" id="guessForm" autocomplete="off"><label class="visually-hidden" for="guessIn">${t("Название страны","Country name")}</label><div class="search-wrap"><input class="field" id="guessIn" role="combobox" aria-label="${t("Название страны","Country name")}" aria-autocomplete="list" aria-controls="sugg" aria-expanded="false" placeholder="${t("Название страны…","Country name…")}"><div id="sugg" class="sugg" role="listbox" hidden></div></div><button class="btn primary" type="submit">${t("Ответить","Submit guess")}</button></form><p class="answer-note">${t('Ошибка','Wrong guess')} −${WRONG}. ${t("Направление — для каждой версии. Расстояния округлены между центрами стран.","Buy a direction for each guess. Distances are rounded between country centres.")}</p><div id="resultActions"></div><div class="round-score"><span>${t("Очки за дело","Case points")}</span><strong id="score">${num(r.score)}</strong></div><div class="attempts"><h3>${t("Проверенные версии","Previous guesses")}</h3><div class="attempt-head" aria-hidden="true"><span>${t("Страна","Country")}</span><span>${t("Направление","Direction")}</span></div><ul id="misses" aria-live="polite"></ul></div><div id="totals">${ranks()}</div><button class="give-up" id="giveUp">${t("Сдаться и узнать страну","Give up and reveal country")}</button></aside></section>`;
  renderMenu(); renderMisses(); bindAnswer();
  $('#clueMenu').onclick=e=>{
    if(e.target.closest('.photo-credit'))return;
    if(e.target.closest('[data-walk]'))return openWalk();
    const photo=e.target.closest('[data-zoom]')?.querySelector('img');if(photo)return openViewer(photo.getAttribute('src'),photo.alt);
    const opened=e.target.closest('.clue.open:not(.unavailable)');
    const b=e.target.closest('[data-clue]');if(!b){if(opened)openEvidence(opened.dataset.key);return;}
    const key=b.dataset.clue;
    if(r.open.includes(key)||r.done){openEvidence(key);return;}
    if(!canOpen(r,key))return;
    const price=cluePrice(r,key);openClue(r,key);freshClue=key;active=key;update();toast(`${CLUES.find(c=>c.key===key).label}: −${price} ${t('очков','points')}`,1800);
  };
  $('#giveUp').onclick=()=>{surrender(r);finishRound();};
}
function renderMenu() {
  const r=game.round,c=byId.get(r.id),focusKey=document.activeElement?.dataset?.clue;
  const tilt={fact1:-.5,fact2:1,phrase:-1,food:1,walk:-1,money:-1,person:1,brand:.5};
  $('#clueMenu').innerHTML='<svg class="threads" id="threads" aria-hidden="true"></svg>'+CLUES.map((cl,index)=>{
    const absent=r.unavailable.includes(cl.key),open=!absent&&(r.open.includes(cl.key)||r.done),price=cluePrice(r,cl.key);
    let detail=absent?t('Недоступно','Unavailable'):r.score<price&&!open?t(`Нужно ${price}`, `${price} points needed`):open?t('Рассмотреть','Inspect'):t(`Открыть за ${price}`, `Open for ${price}`);
    const textOnly=cl.key==='food'&&!PHOTOS[c.food[1]]&&!FOOD_ART[c.id];
    if(textOnly&&!open)detail+=t(' · без фото',' · text only');
    return `<div class="clue clue-${cl.key}${open?' open':''}${absent?' unavailable':''}${freshClue===cl.key?' just-opened':''}" data-key="${cl.key}" style="--tilt:${tilt[cl.key]}deg"><span class="pin" aria-hidden="true"></span><div class="clue-inner"><button class="side back" tabindex="${open?-1:0}" aria-hidden="${open}" data-clue="${cl.key}" ${absent||(!open&&!canOpen(r,cl.key))?'disabled':''} aria-label="${esc(cl.label)}, ${detail}"><span class="back-ic">${clueIcon(cl.key)}</span><span class="clue-label"><b>${esc(cl.label)}</b><span class="price">${absent?t("Нет данных","Unavailable"):t(`−${price} очков`, `−${price} pts`)}${textOnly&&!absent?t(" · без фото"," · text only"):""}</span></span><span class="clue-index" aria-hidden="true">0${index+1}</span></button><div class="side front" aria-hidden="${!open}">${open&&!absent?`<div class="evidence-sheet"><div class="evidence-tab"><span>0${index+1} / ${esc(cl.label)}</span></div>${evidenceHTML(cl.key)}</div>`:'<div class="empty-note"></div>'}</div></div>${open&&!absent?`<button class="inspect-note" data-clue="${cl.key}" aria-label="${t('Рассмотреть','Inspect')}: ${esc(cl.label)}"></button>`:''}</div>`;
  }).join('')+`<div class="suspect${r.done?' open':''}" id="suspect"><span class="pin" aria-hidden="true"></span><div class="suspect-inner"><div class="side suspect-front" aria-hidden="${r.done}"><b>?</b><span>${t("Искомая страна","Unknown country")}</span></div><div class="side suspect-back" aria-hidden="${!r.done}">${r.done?shape(c.id):''}<b>${r.done?esc(c.name):''}</b></div></div></div>`;
  $('#clueMenu').querySelectorAll('img').forEach(img=>img.onerror=()=>img.remove());
  if(focusKey){const note=$('#clueMenu').querySelector(`[data-key="${focusKey}"]`);(note?.querySelector('.inspect-note')||note?.querySelector('.back'))?.focus({preventScroll:true});}
  freshClue=null;
  boardObserver.disconnect(); boardObserver.observe($('#clueMenu'));
  $('#clueMenu').querySelectorAll('.clue,#suspect').forEach(el=>boardObserver.observe(el));
  requestAnimationFrame(drawThreads);
}
function drawThreads(){
  const board=$('#clueMenu'),svg=$('#threads'),sus=$('#suspect');if(!board||!svg||!sus)return;
  const rect=svg.getBoundingClientRect();
  const pin=el=>{const r=el.querySelector('.pin').getBoundingClientRect();return [r.left+r.width/2-rect.left,r.top+r.height/2-rect.top];};
  const [sx,sy]=pin(sus);svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
  svg.innerHTML=[...board.querySelectorAll('.clue.open:not(.unavailable)')].map(el=>{const [x,y]=pin(el);return `<path pathLength="1" d="M${x} ${y} Q${(x+sx)/2} ${(y+sy)/2+20} ${sx} ${sy}"/>`;}).join('');
}
const boardObserver=new ResizeObserver(()=>requestAnimationFrame(drawThreads));
addEventListener('resize',()=>requestAnimationFrame(drawThreads));
function openEvidence(key){active=key;$('#viewerBody').innerHTML=`<div class="evidence-zoom">${evidenceHTML(key)}</div>`;$('#viewerNote').textContent=CLUES.find(cl=>cl.key===key).label;$('#viewer').showModal();}
function photoCredit(src){
  const brand=BRAND_MEDIA[game?.round?.id];
  const id=PHOTO_CREDITS[src]||{
    'assets/banknotes/EUR-ecb-72dpi.jpg':'ecb',
    'assets/banknotes/sterling-detail.webp':'sterling',
  }[src];
  const href=id?`credits.html#${id}`:src&&src===brand?.[0]?brand[1]:null;
  return href?`<a class="photo-credit" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="${t('Автор, источник и лицензия. Может раскрыть ответ.','Creator, source and licence. May reveal the answer.')}">${t('Источник · спойлер','Source · spoiler')}</a>`:'';
}
function evidenceHTML(key) {
  const r=game.round,c=byId.get(r.id),cl={...CLUES.find(cl=>cl.key===key),cost:cluePrice(r,key)};
  let body='';
  const picture=(src,alt)=>src?`<button type="button" class="photo-zoom" data-zoom aria-label="${t("Увеличить изображение: ","Enlarge image: ")}${esc(alt)}"><img class="evidence-photo" src="${esc(src)}" alt="${esc(alt)}" referrerpolicy="no-referrer"></button>${photoCredit(src)}`:'';
  switch(key){
    case 'fact1':case 'fact2':body=`<span class="fact-mark" aria-hidden="true">“</span><p class="fact-text">${esc(roundFacts[key==='fact1'?0:1])}</p><small class="evidence-note">${t("Присмотрись к деталям: они связывают факт с одной страной.","Look closely: the details connect this fact to a country.")}</small>`;break;
    case 'phrase':body=`<span class="language-symbol" aria-hidden="true">Aa</span><blockquote class="phrase" style="--long-word:${Math.max(...c.phrase[0].split(/\s+/).map(w=>[...w].length))}" dir="auto">${esc(c.phrase[0])}</blockquote><p class="translation">${esc(c.phrase[1])}</p><small class="evidence-note">${t("Фраза — подсказка. Один язык может встречаться в нескольких странах.","The phrase is a clue. A language may be spoken in several countries.")}</small>`;break;
    case 'food':{
      const photo=PHOTOS[c.food[1]],art=FOOD_ART[c.id];
      const caption=t('Иллюстрация блюда','Dish illustration');
      body=`${picture(photo||art,photo?c.food[0]:`${caption}: ${c.food[0]}`)}<h2>${esc(c.food[0])}</h2>${!photo&&art?`<small class="art-caption">${caption}</small>`:''}<p>${t("Это блюдо встречается в местной кухне. Оно может быть знакомо и соседям.","This dish is found in the local cuisine. Neighbours may know it too.")}</p>`;
      break;
    }
    case 'money':{
      const currency=MONEY[c.id],kind=banknoteKind(c.id,currency);
      const caption={
        specimen:t('Образец банкноты','Banknote specimen'),
        fragment:t('Фрагмент банкноты','Banknote fragment'),
        illustration:t('Игровая иллюстрация','Game illustration'),
      }[kind];
      body=`${banknoteHTML(c.id,currency)}${photoCredit(banknoteFor(c.id,currency))}<h2>${esc(c.currency)}</h2><small class="art-caption">${caption||''}</small><small class="evidence-note">${t("Часто встречающиеся валюты дешевле, редкие — дороже.","Common currencies cost less; rare ones cost more.")}</small>`;
      break;
    }
    case 'person':{
      const p=personOf(c),depiction=PERSON_DEPICTIONS[c.id];
      const caption=depiction==='sculpture'?t('Скульптурное изображение','Sculptural depiction'):depiction==='portrait'?t('Исторический портрет','Historical portrait'):'';
      body=p?`${picture(PERSON_PHOTOS[c.id],caption?`${p[0]} — ${caption}`:p[0])}<h2>${esc(p[0])}</h2><p>${esc(p[1])}</p>${caption?`<small class="art-caption">${caption}</small>`:''}`:`<h2>${t("Без случайных имён","No obscure names")}</h2><p>${t("Для этой страны пока нет достаточно узнаваемого человека в подборке.","No sufficiently recognisable person is available for this country yet.")}</p>`;
      break;
    }
    case 'brand': {
      const [name, ru, en] = BRANDS[c.id];
      const photo = BRAND_MEDIA[c.id][0];
      const background = BRAND_MEDIA[c.id][2] || '#ffffff';
      body = `<div class="brand-mark" style="--brand-mark-bg:${esc(background)}">${picture(photo,t('Логотип ','Logo ')+name)}</div><h2>${esc(name)}</h2><p>${esc(t(ru,en))}</p>`;
      break;
    }
    case 'walk':body=`<div class="street-symbol">${clueIcon("walk")}</div><h2>${t("Осмотрись вокруг","Look around")}</h2><p>${t("Дороги, здания и вывески могут многое рассказать.","Roads, buildings and signs can reveal a lot.")}</p><button class="btn primary" data-walk>${t("Открыть прогулку","Open street walk")}</button><small class="evidence-note">${t("Если точка неудачная — выбери другое место. Повторно очки не списываются.","If the spot is unhelpful, choose another place. There is no extra charge.")}</small>`;break;
  }
  return `<div class="evidence-content evidence-${key}">${body}</div>`;
}

function ranks(){return `<h3>${t("Счёт за игру","Game scores")}</h3><ul class="ranks">${game.players.map(p=>`<li><span>${esc(p.name)}</span><b>${num(p.score)}</b></li>`).join('')}</ul>`;}
function renderMisses(){
  const r=game.round,list=guidance(r,at);
  $('#misses').innerHTML=r.wrong.length?r.wrong.map(m=>{
    const d=list.find(d=>d.id===m.id);
    const label=t(`Купить направление от ${nameOf(m.id)} за ${DIRECTION_COST} очков`,`Buy direction from ${nameOf(m.id)} for ${DIRECTION_COST} points`);
    return `<li><span>${esc(nameOf(m.id))}</span>${d?`<span class="direction-result"><svg class="direction-arrow" viewBox="0 0 24 24" style="transform:rotate(${['↑','↗','→','↘','↓','↙','←','↖'].indexOf(d.dir)*45}deg)" aria-hidden="true"><path d="M12 21V3M5 10l7-7 7 7"/></svg><span><b>${directions[d.dir]}</b><small>≈ ${num(d.km)} ${t('км','km')}</small></span></span>`:`<button class="direction-price" data-direction="${esc(m.id)}" aria-label="${esc(label)}" ${r.done||r.score<DIRECTION_COST?'disabled':''}>−${DIRECTION_COST}</button>`}</li>`;
  }).reverse().join(''):`<li class="empty">${t("Пока нет ошибок","No incorrect guesses yet")}</li>`;
  $('#misses').onclick=e=>{const b=e.target.closest('[data-direction]');if(!b)return;if(buyDirection(r,b.dataset.direction)){update();}};
}
function update() { $('#score').textContent=num(game.round.score); renderMenu();renderMisses(); }
function bindAnswer(){
  const input=$('#guessIn'),box=$('#sugg');let list=[],hi=0,choosing=false;
  const close=()=>{box.hidden=true;input.setAttribute('aria-expanded','false');};
  input.oninput=()=>{const q=norm(input.value);list=q?searchCountries.filter(c=>c.aliases.some(n=>norm(n).includes(q))).sort((a,b)=>Number(b.aliases.some(n=>norm(n).startsWith(q)))-Number(a.aliases.some(n=>norm(n).startsWith(q)))).slice(0,6).map(c=>c.name):[];hi=0;choosing=false;box.innerHTML=list.map((n,i)=>`<button type="button" id="choice-${i}" role="option" aria-selected="${i===hi}" data-name="${esc(n)}">${esc(n)}</button>`).join('');box.hidden=!list.length;input.setAttribute('aria-expanded',String(!!list.length));input.setAttribute('aria-activedescendant',list.length?'choice-0':'');};
  input.onkeydown=e=>{if(e.key==='Escape'){choosing=false;close();return;}if(box.hidden||!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();choosing=true;hi=(hi+(e.key==='ArrowDown'?1:list.length-1))%list.length;[...box.children].forEach((b,i)=>b.setAttribute('aria-selected',i===hi));input.setAttribute('aria-activedescendant',`choice-${hi}`);box.children[hi].scrollIntoView({block:'nearest'});};
  box.onmousedown=e=>e.preventDefault();
  box.onclick=e=>{const b=e.target.closest('[data-name]');if(b){input.value=b.dataset.name;submit();close();}};
  input.onblur=close;
  $('#guessForm').onsubmit=e=>{e.preventDefault();if((choosing||!matchCountry(input.value,names))&&list[hi])input.value=list[hi];submit();close();};
}
function submit(){
  const input=$('#guessIn'),id=matchCountry(input.value,names);
  if(!id)return toast(t('Выбери страну из списка или напиши её полное название.','Choose a country from the list or enter its full name.'),2500);
  const res=guess(game.round,id,at);input.value='';
  if(!res)return toast(t('Эту версию уже проверяли.','You have already checked that guess.'),1800);
  if(res.correct)return finishRound();
  update();toast(`${nameOf(id)} — ${t('мимо','incorrect')}. −${WRONG} ${t('очков','points')}.`,2200);
}
function finishRound(){
  const r=game.round,c=byId.get(r.id);resetWalk();update();
  $('#guessForm').hidden=true;$('#giveUp').hidden=true;$('.answer-note').hidden=true;
  const heading=$('.answer-panel h2');
  heading.textContent=c.name;
  $('#resultActions').innerHTML=`<div class="verdict"><b>${r.solved?t('Верно!','Correct!'):t('Ответ раскрыт','Answer revealed')}</b><span>+${num(r.score)} ${t('очков','points')}</span></div>${r.solved&&game.players.length>1?`<p>${t("Кто угадал?","Who solved it?")}</p><div class="who">${game.players.map((p,i)=>`<button class="btn" data-who="${i}">${esc(p.name)}</button>`).join('')}<button class="btn" data-who="">${t("Никто","Nobody")}</button></div>`:nextButton()}`;
  if(game.players.length===1||!r.solved)settle(r.solved?0:null);
  $('#resultActions').onclick=e=>{const b=e.target.closest('[data-who]');if(b){settle(b.dataset.who===''?null:+b.dataset.who);$('#resultActions').innerHTML=nextButton();}if(e.target.closest('#nextBtn')){if(nextRound(game))beginRound();else finish();}};
  if(r.solved)confetti($('.verdict'),35);
  heading.tabIndex=-1;
  heading.focus();
}
const nextButton=()=>`<button class="btn primary" id="nextBtn">${game.index+1<game.order.length?t('Следующая страна','Next country'):t('Итоги игры','Game results')}</button>`;
function settle(who){if(settled)return;settled=true;award(game,who);$('#totals').innerHTML=ranks();}
function finish(){
  resetWalk();document.body.classList.remove('is-investigating');$('#progress').hidden=true;
  stage.innerHTML=`<section class="final"><h1>${t("Кругосветка завершена","Journey complete")}</h1><p>${t(`Раскрыто ${game.log.filter(l=>l.solved).length} из ${game.log.length} стран`, `Solved ${game.log.filter(l=>l.solved).length} of ${game.log.length} countries`)}</p><div class="final-ranks">${ranks()}</div><div class="files">${game.log.map(l=>`<article>${shape(l.id)}<b>${esc(nameOf(l.id))}</b><span>${l.solved?`+${num(l.pts)}`:t('Не угадано','Unsolved')}</span></article>`).join('')}</div><button class="btn primary" id="againBtn">${t("Ещё путешествие","Another journey")}</button> <button class="btn" id="homeBtn">${t("К подборкам","Back to case files")}</button></section>`;
  $('#againBtn').onclick=start;$('#homeBtn').onclick=home;scrollTo({top:0,behavior:'instant'});
}
const walkEl=$('#walk'),dockEl=$('#walkDock'),frameEl=$('#walkFrame');let spot=0;
function showWalkPoint(point) {
  const embed = streetViewUrl(point, mapsKey, lang);
  frameEl.hidden = !embed;
  $('#walkExternalPanel').hidden = Boolean(embed);
  if (embed) {
    if (frameEl.getAttribute('src') !== embed) frameEl.setAttribute('src', embed);
  } else {
    $('#walkExternal').href = streetViewLink(point);
  }
}
function openWalk(){const spots=spotsOf(game.round.id);if(!spots)return;showWalkPoint(spots[spot]);walkEl.hidden=false;if(!walkEl.open)walkEl.showModal();dockEl.hidden=true;$('#walkOther').hidden=spots.length<2;$('#walkRefund').hidden=game.round.done;}
function foldWalk(){if(walkEl.open)walkEl.close();walkEl.hidden=true;dockEl.hidden=!game||game.round.done;}
function resetWalk(){if(walkEl.open)walkEl.close();walkEl.hidden=true;dockEl.hidden=true;spot=0;frameEl.removeAttribute('src');}
walkEl.addEventListener('cancel',e=>{e.preventDefault();foldWalk();});
walkEl.addEventListener('close',()=>{if(!walkEl.open)walkEl.hidden=true;});
$('#walkFold').onclick=foldWalk;dockEl.onclick=openWalk;
$('#walkRefund').onclick=()=>{if(game&&refundWalk(game.round)){resetWalk();active='fact1';update();toast(t('150 очков возвращены. Прогулка отключена до следующего раунда.','150 points refunded. Street walk is disabled until the next round.'),3000);}};
$('#walkOther').onclick=()=>{const spots=spotsOf(game.round.id);if(spots){spot=(spot+1)%spots.length;showWalkPoint(spots[spot]);}};
function openViewer(src,alt){
  const brand=BRAND_MEDIA[game?.round?.id],background=src===brand?.[0]?(brand[2]||'#ffffff'):null;
  $('#viewerBody').innerHTML=`<img src="${esc(src)}" alt="${esc(alt||t("Подсказка крупно","Enlarged clue"))}" ${background?`style="background:${esc(background)};padding:16px"`:''}>${photoCredit(src)}`;
  $('#viewerNote').textContent='';if(!$('#viewer').open)$('#viewer').showModal();
}
$('#viewerBody').onclick=e=>{if(e.target.closest('[data-walk]')){$('#viewer').close();openWalk();}const img=e.target.closest('[data-zoom]')?.querySelector('img');if(img)openViewer(img.getAttribute('src'),img.alt);};
$('#viewer').onclose=()=>{$('#viewerBody').innerHTML='';};
document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))e.target.closest('dialog').close();});
document.querySelectorAll('dialog').forEach(d=>d.onclick=e=>{if(e.target===d){if(d===walkEl)foldWalk();else d.close();}});
$('#rulesBtn').onclick=()=>$('#rulesDialog').showModal();
$('#exitBtn').onclick=home;
addEventListener('keydown',e=>{if(e.key==='Escape'&&!walkEl.hidden)foldWalk();});
if(lang==='en') for(const attr of ['aria-label','title','content']) document.querySelectorAll(`[data-en-${attr}]`).forEach(el=>el.setAttribute(attr,el.getAttribute(`data-en-${attr}`)));
home();
