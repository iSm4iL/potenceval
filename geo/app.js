import { $, esc, LS, toast, confetti, A, SPRING, nudge } from '../shared/kit.js';
import { PACKS, COUNTRIES } from './countries.js?v=atlas-20261028b';
import { WORLD, SHAPES, PHOTOS } from './atlas.js?v=clues-20261025';
import { banknoteHTML, banknoteFor } from './banknotes.js?v=notes-20261028';
import { WALKS } from './walks.js?v=atlas-20261028b';
import { FACTS, PEOPLE, OMIT_PEOPLE, MONEY } from './content.js?v=atlas-20261028b';
import { CLUES, START, WRONG, norm, nameIndex, matchCountry, canOpen, cluePrice, currencyPrice, openClue, refundWalk, guess, guidance, surrender, createGame, award, nextRound, selectFacts } from './game.js?v=atlas-20261028b';

const stage = $('#stage'), byId = new Map(COUNTRIES.map(c => [c.id, c]));
const world = new Map(WORLD.map(w => [w[0], w])), names = nameIndex(WORLD, COUNTRIES);
const at = id => world.get(id).slice(2), nameOf = id => byId.get(id)?.name || world.get(id)?.[1] || id;
const num = n => n.toLocaleString('ru-RU');
const countryCount = n => `${n} ${{one:'страна',few:'страны',many:'стран',other:'стран'}[new Intl.PluralRules('ru').select(n)]}`;
const allNames = [...new Set([...COUNTRIES.flatMap(c => [c.name, ...c.aliases]), ...WORLD.map(w => w[1])])];
const directions = { '↑':'На север', '↗':'На северо-восток', '→':'На восток', '↘':'На юго-восток', '↓':'На юг', '↙':'На юго-запад', '←':'На запад', '↖':'На северо-запад' };
const icons = { fact1:'✦', fact2:'✦', phrase:'Aa', food:'◒', money:'¤', person:'☺', walk:'↟', shape:'◈', compass:'↗' };
const descriptions = { fact1:'Первый факт уже открыт', fact2:'Другой факт об этой стране', phrase:'Фраза и её перевод', food:'Блюдо и его название', money:'Фрагмент банкноты и денежная единица', person:'Человек и его достижение', walk:'Осмотреться на улицах', shape:'Сильная подсказка: силуэт на карте', compass:'Направления от всех ошибочных ответов' };
const saved = LS.get('geo.setup') || {};
const settings = { pack: PACKS.some(p => p.id === saved.pack) ? saved.pack : 'europe', rounds:[5,10,15].includes(saved.rounds) ? saved.rounds : 5, mode:saved.mode === 'team' ? 'team' : 'solo', players:Array.isArray(saved.players) ? saved.players.filter(p=>typeof p==='string').slice(0,4) : [] };
const persist = () => LS.set('geo.setup', settings);
const poolOf = pack => COUNTRIES.filter(c => pack === 'all' || c.area === pack).map(c => c.id);
const spotsOf = id => byId.get(id)?.walk && WALKS[id]?.length ? WALKS[id] : null;
const personOf = c => OMIT_PEOPLE.includes(c.id) ? null : PEOPLE[c.id] || c.person;
const shape = id => `<svg viewBox="-20 -20 1040 1040" aria-label="Контур страны"><path d="${SHAPES[id]}"/></svg>`;
const exitBtn=$('#exitBtn'), AVATARS=['🕵️','🦊','🐱','🦉'], shapeSvg=shape;
const roundChoices=pack=>{const max=poolOf(pack).length;return [5,10,15].filter(n=>n<=max);};
let freshClue=null;
let game = null, active = 'fact1', roundFacts = [], settled = false;

function home() {
  game = null; resetWalk(); document.body.classList.remove('is-investigating');
  exitBtn.hidden = true; $('#progress').hidden = true;
  const teaser = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
  stage.innerHTML = `<section class="desk">
    <div class="folder">
      <div class="folder-tab">Дело № ${String(Math.floor(Math.random() * 900) + 100)}</div>
      <span class="coffee-ring" aria-hidden="true"></span>
      <div class="folder-page folder-left">
        <span class="stamp-secret">Совершенно секретно</span>
        <h1>Угадай страну</h1>
        <p class="lead">На доске следователя — загаданная страна. Открывай улики: факты из истории, язык, кухню, прогулку по настоящим улицам. Чем меньше улик понадобилось, тем больше очков.</p>
        <figure class="detective-scene"><img src="../shared/assets/club/geo.webp" alt="" width="768" height="512"><figcaption>Каждая страна оставляет следы</figcaption></figure>
        <figure class="teaser" hidden><span class="clip" aria-hidden="true"></span>${shapeSvg(teaser.id)}<b aria-hidden="true">?</b><figcaption>Улика № 1</figcaption></figure>
      </div>
      <div class="folder-page folder-right">
        <h2>Картотека</h2>
        <div class="packs" role="radiogroup" aria-label="Картотека">${PACKS.map(p => `<button class="pack${p.id === settings.pack ? ' on' : ''}" role="radio" aria-checked="${p.id === settings.pack}" data-pack="${p.id}"><span class="pack-ic">${p.icon}</span><b>${p.name}</b><small>${countryCount(poolOf(p.id).length)}</small></button>`).join('')}</div>
        <h2>Сколько дел</h2>
        <div class="rounds" id="rounds"></div>
        <h2>Кто расследует</h2>
        <div class="modes" role="radiogroup" aria-label="Режим">
          <button data-mode="solo" role="radio">🕵️ Я один</button>
          <button data-mode="team" role="radio">👥 С друзьями</button>
        </div>
        <div class="team" id="team"></div>
        <button class="btn primary big" id="startBtn">Открыть дело</button>
      </div>
    </div>
  </section>`;
  const drawRounds = () => {
    const list = roundChoices(settings.pack);
    if (!list.includes(settings.rounds)) settings.rounds = list[0];
    $('#rounds').innerHTML = list.map(n => `<button class="${n === settings.rounds ? 'on' : ''}" data-rounds="${n}">${n}</button>`).join('');
  };
  const drawTeam = () => {
    stage.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === settings.mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    const team = $('#team');
    team.hidden = settings.mode !== 'team';
    team.innerHTML = settings.players.map((p, i) => `<span class="agent">${AVATARS[i]} ${esc(p)}<button data-drop="${i}" aria-label="Убрать ${esc(p)}">×</button></span>`).join('')
      + (settings.players.length < 4 ? `<form class="agent-add" id="addForm"><input class="field" id="agentName" maxlength="16" placeholder="${settings.players.length < 2 ? `Имя ${settings.players.length + 1}-го следователя` : 'Ещё имя'}" autocomplete="off"><button class="btn ghost" aria-label="Добавить">+</button></form>` : '');
    $('#addForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#agentName').value.replace(/\s+/g, ' ').trim();
      if (!v) return nudge($('#agentName'));
      settings.players.push(v); persist(); drawTeam(); $('#agentName')?.focus();
    });
  };
  drawRounds(); drawTeam();
  stage.onclick = e => {
    const pack = e.target.closest('[data-pack]'), rounds = e.target.closest('[data-rounds]'), drop = e.target.closest('[data-drop]'), mode = e.target.closest('[data-mode]');
    if (pack) {
      settings.pack = pack.dataset.pack; persist();
      stage.querySelectorAll('[data-pack]').forEach(b => { b.classList.toggle('on', b === pack); b.setAttribute('aria-checked', b === pack); });
      drawRounds();
    }
    if (rounds) { settings.rounds = +rounds.dataset.rounds; persist(); drawRounds(); }
    if (drop) { settings.players.splice(+drop.dataset.drop, 1); persist(); drawTeam(); }
    if (mode) { settings.mode = mode.dataset.mode; persist(); drawTeam(); if (settings.mode === 'team') $('#agentName')?.focus(); }
  };
  $('#startBtn').onclick = start;
  A($('.teaser path'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 2600, delay: 400, easing: 'ease-in-out' });
  A($('.folder'), [{ opacity: 0, transform: 'translateY(40px) rotate(-1.5deg)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: SPRING });
}

function start() {
  const typed=$('#agentName')?.value.trim(); if(settings.mode==='team'&&typed&&settings.players.length<4){settings.players.push(typed.slice(0,20));persist();}
  if(settings.mode==='team' && settings.players.length<2) return toast('Впиши хотя бы два имени через запятую.',3000);
  stage.onclick=null;
  const recent = LS.get('geo.recent') || [];
  game = createGame(poolOf(settings.pack),settings.rounds,settings.mode==='team'?settings.players:['Ты'],{recent:Array.isArray(recent)?recent:[],pricesOf:id=>({money:currencyPrice(MONEY[id],Object.values(MONEY))}),unavailableOf:id=>[...(!spotsOf(id)?['walk']:[]),...(!personOf(byId.get(id))?['person']:[])]});
  beginRound();
}
function beginRound() {
  resetWalk(); active='fact1'; settled=false;
  const c=byId.get(game.round.id), history=LS.get('geo.facts.v2') || {};
  const facts=[...c.facts,...(FACTS[c.id] || [])], used=Array.isArray(history[c.id])?history[c.id]:[];
  roundFacts=selectFacts(facts,used);
  const unique=[...new Set(facts)];
  history[c.id]=[...new Set([...used,...roundFacts])];
  if(history[c.id].length>=unique.length) history[c.id]=roundFacts;
  LS.set('geo.facts.v2',history);
  const recent=LS.get('geo.recent');
  LS.set('geo.recent',[...(Array.isArray(recent)?recent:[]).filter(id=>id!==c.id),c.id].slice(-COUNTRIES.length));
  renderRound(); scrollTo({top:0,behavior:'instant'});
}
function renderRound() {
  const r=game.round;
  document.body.classList.add('is-investigating');
  $('#exitBtn').hidden=false; $('#progress').hidden=false;
  $('#progressText').textContent=`Дело ${game.index+1} из ${game.order.length}`;
  $('#progressBar').style.width=`${(game.index+1)/game.order.length*100}%`;
  stage.innerHTML=`<section class="case"><div class="scene"><div class="frame"><div class="plaque">Дело № ${String(game.index+1).padStart(3,'0')} · ${esc(PACKS.find(p=>p.id===settings.pack).name)}</div><div class="board" id="clueMenu" aria-label="Доска расследования"></div></div><p class="board-help">Нажми на открытую заметку, чтобы рассмотреть её крупнее.</p></div><aside class="notebook answer-panel" id="notebook"><h2>Что это за страна?</h2><form class="guess" id="guessForm" autocomplete="off"><label class="visually-hidden" for="guessIn">Название страны</label><div class="search-wrap"><input class="field" id="guessIn" role="combobox" aria-label="Название страны" aria-autocomplete="list" aria-controls="sugg" aria-expanded="false" placeholder="Название страны…"><div id="sugg" class="sugg" role="listbox" hidden></div></div><button class="btn primary" type="submit">Ответить</button></form><p class="answer-note">Ошибка −${WRONG}. Направление покупается отдельно.</p><div id="resultActions"></div><div class="round-score"><span>Очки за дело</span><strong id="score">${num(r.score)}</strong></div><div class="compass-panel" id="compassPanel"></div><div class="attempts"><h3>Проверенные версии</h3><ul id="misses"></ul></div><div id="totals">${ranks()}</div><button class="give-up" id="giveUp">Сдаться и узнать страну</button></aside></section>`;
  renderMenu(); renderMisses(); bindAnswer(); renderCompass();
  $('#clueMenu').onclick=e=>{
    if(e.target.closest('[data-walk]'))return openWalk();
    const photo=e.target.closest('[data-zoom]')?.querySelector('img');if(photo)return openViewer(photo.src);
    const opened=e.target.closest('.clue.open:not(.unavailable)');
    const b=e.target.closest('[data-clue]');if(!b){if(opened)openEvidence(opened.dataset.key);return;}
    const key=b.dataset.clue;
    if(r.open.includes(key)||r.done){openEvidence(key);return;}
    if(!canOpen(r,key))return;
    const price=cluePrice(r,key);openClue(r,key);freshClue=key;active=key;update();toast(`${CLUES.find(c=>c.key===key).label}: −${price} очков`,1800);
  };
  $('#giveUp').onclick=()=>{surrender(r);finishRound();};
}
function renderMenu() {
  const r=game.round,c=byId.get(r.id),focusKey=document.activeElement?.dataset?.clue;
  const tilt={fact1:-2,fact2:2,phrase:-3,food:2,walk:1,money:-2,person:3,shape:-1};
  $('#clueMenu').innerHTML='<svg class="threads" id="threads" aria-hidden="true"></svg>'+CLUES.filter(cl=>cl.key!=='compass').map(cl=>{
    const absent=r.unavailable.includes(cl.key),open=!absent&&(r.open.includes(cl.key)||r.done),price=cluePrice(r,cl.key);
    let detail=absent?'Недоступно':r.score<price&&!open?`Нужно ${price}`:open?'Рассмотреть':`Открыть за ${price}`;
    if(cl.key==='money'&&!open&&!banknoteFor(c.id,MONEY[c.id]))detail+=' · без фото';
    return `<div class="clue clue-${cl.key}${open?' open':''}${absent?' unavailable':''}${freshClue===cl.key?' just-opened':''}" data-key="${cl.key}" style="--tilt:${tilt[cl.key]}deg"><span class="pin" aria-hidden="true"></span><div class="clue-inner"><button class="side back" tabindex="${open?-1:0}" aria-hidden="${open}" data-clue="${cl.key}" ${absent||(!open&&!canOpen(r,cl.key))?'disabled':''} aria-label="${esc(cl.label)}, ${detail}"><span class="back-ic" aria-hidden="true">${icons[cl.key]}</span><b>${esc(cl.label)}</b><span class="price">${detail}</span></button><div class="side front" aria-hidden="${!open}">${open&&!absent?evidenceHTML(cl.key):'<div class="empty-note"></div>'}</div></div>${open&&!absent?`<button class="inspect-note" data-clue="${cl.key}" aria-label="Рассмотреть: ${esc(cl.label)}">↗</button>`:''}</div>`;
  }).join('')+`<div class="suspect${r.done?' open':''}" id="suspect"><span class="pin" aria-hidden="true"></span><div class="suspect-inner"><div class="side suspect-front" aria-hidden="${r.done}"><b>?</b><span>Страна № ${game.index+1}</span></div><div class="side suspect-back" aria-hidden="${!r.done}">${r.done?shape(c.id):''}<b>${r.done?esc(c.name):''}</b></div></div></div>`;
  $('#clueMenu').querySelectorAll('img').forEach(img=>img.onerror=()=>img.remove());
  if(focusKey){const note=$('#clueMenu').querySelector(`[data-key="${focusKey}"]`);(note?.querySelector('.inspect-note')||note?.querySelector('.back'))?.focus({preventScroll:true});}
  freshClue=null;
  boardObserver.disconnect(); boardObserver.observe($('#clueMenu'));
  $('#clueMenu').querySelectorAll('.clue,#suspect').forEach(el=>boardObserver.observe(el));
  requestAnimationFrame(drawThreads);
}
function drawThreads(){
  const board=$('#clueMenu'),svg=$('#threads'),sus=$('#suspect');if(!board||!svg||!sus)return;
  const rect=board.getBoundingClientRect();
  const pin=el=>{const r=el.querySelector('.pin').getBoundingClientRect();return [r.left+r.width/2-rect.left,r.top+r.height/2-rect.top];};
  const [sx,sy]=pin(sus);svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
  svg.innerHTML=[...board.querySelectorAll('.clue.open:not(.unavailable)')].map(el=>{const [x,y]=pin(el);return `<path pathLength="1" d="M${x} ${y} Q${(x+sx)/2} ${(y+sy)/2+20} ${sx} ${sy}"/>`;}).join('');
}
const boardObserver=new ResizeObserver(()=>requestAnimationFrame(drawThreads));
addEventListener('resize',()=>requestAnimationFrame(drawThreads));
function renderCompass(){
  const r=game.round,open=r.open.includes('compass');
  $('#compassPanel').innerHTML=`<button class="compass-buy" id="compassBuy" ${!open&&!canOpen(r,'compass')?'disabled':''}>↗ ${open?'Направление открыто':'Направление · −100'}</button><small>${!r.wrong.length?'Доступно после первой ошибки':open?'Действует на все версии этого дела':'Без покупки стрелок и расстояний нет'}</small>`;
  $('#compassBuy').onclick=()=>{if(open){openEvidence('compass');return;}if(openClue(r,'compass'))update();};
}
function openEvidence(key){active=key;$('#viewerBody').innerHTML=`<div class="evidence-zoom">${evidenceHTML(key)}</div>`;$('#viewerNote').textContent=CLUES.find(cl=>cl.key===key).label;$('#viewer').showModal();}
function evidenceHTML(key) {
  const r=game.round,c=byId.get(r.id),cl={...CLUES.find(cl=>cl.key===key),cost:cluePrice(r,key)};
  let body='';
  const picture=(article,alt)=>PHOTOS[article]?`<button type="button" class="photo-zoom" data-zoom aria-label="Увеличить фото: ${esc(alt)}"><img class="evidence-photo" src="${esc(PHOTOS[article])}" alt="${esc(alt)}" referrerpolicy="no-referrer"></button>`:'';
  switch(key){
    case 'fact1':case 'fact2':body=`<span class="fact-mark" aria-hidden="true">“</span><p class="fact-text">${esc(roundFacts[key==='fact1'?0:1])}</p><small class="evidence-note">Присмотрись к деталям: они связывают факт с одной страной.</small>`;break;
    case 'phrase':body=`<span class="language-symbol" aria-hidden="true">Aa</span><blockquote class="phrase" style="--long-word:${Math.max(...c.phrase[0].split(/\s+/).map(w=>[...w].length))}" dir="auto">${esc(c.phrase[0])}</blockquote><p class="translation">${esc(c.phrase[1])}</p><small class="evidence-note">Фраза — подсказка. Один язык может встречаться в нескольких странах.</small>`;break;
    case 'food':body=`${picture(c.food[1],c.food[0])}<h2>${esc(c.food[0])}</h2><p>Это блюдо встречается в местной кухне. Оно может быть знакомо и соседям.</p>`;break;
    case 'money':body=`${banknoteHTML(c.id,MONEY[c.id])||'<div class="currency-symbol" aria-hidden="true">¤</div>'}<h2>${esc(MONEY[c.id] || c.money[0].split(' · ')[0])}</h2><p>Денежная единица или её деление.</p><small class="evidence-note">Часто встречающиеся валюты дешевле, редкие — дороже.</small><small class="evidence-note">На фото оставлен фрагмент банкноты без названия страны. Если проверенного фото пока нет, показана текстовая подсказка.</small>`;break;
    case 'person':{const p=personOf(c),credit=!PEOPLE[c.id]&&c.personCredit;body=p?`${picture(p[2],p[0])}<h2>${esc(p[0])}</h2><p>${esc(p[1])}</p>${credit?`<small class="evidence-note">Фото: <a href="${esc(credit.source)}" target="_blank" rel="noopener noreferrer">${esc(credit.author)}</a>, <a href="${esc(credit.url)}" target="_blank" rel="noopener noreferrer">${esc(credit.license)}</a></small>`:''}`:'<h2>Без случайных имён</h2><p>Для этой страны пока нет достаточно узнаваемого человека в подборке.</p>';break;}
    case 'shape':body=`<div class="country-outline">${shape(c.id)}</div><p>Силуэт страны. Масштаб и положение на карте не показаны.</p>`;break;
    case 'compass':{const list=guidance(r,at);body=`<div class="compass-rose" aria-hidden="true">✥</div><h2>Куда двигаться</h2>${list.length?`<ul class="bearings">${list.map(m=>`<li><span>${esc(nameOf(m.id))}</span><b>${m.dir} ${directions[m.dir]}</b></li>`).join('')}</ul>`:'<p>Направления появятся здесь после ошибочных версий.</p>'}<small class="evidence-note">От условного центра названной страны к центру загаданной. Покупка действует на все попытки этого раунда.</small>`;break;}
    case 'walk':body=`<div class="street-symbol" aria-hidden="true">↟</div><h2>Осмотрись вокруг</h2><p>Дороги, здания и вывески могут многое рассказать.</p><button class="btn primary" data-walk>Открыть прогулку</button><small class="evidence-note">Если точка неудачная — выбери другое место. Повторно очки не списываются.</small>`;break;
  }
  return `<div class="evidence-content evidence-${key}">${body}</div>`;
}

function ranks(){return `<h3>Счёт за игру</h3><ul class="ranks">${game.players.map(p=>`<li><span>${esc(p.name)}</span><b>${num(p.score)}</b></li>`).join('')}</ul>`;}
function renderMisses(){const r=game.round,list=guidance(r,at);$('#misses').innerHTML=r.wrong.length?r.wrong.map(m=>{const d=list.find(d=>d.id===m.id);return `<li><span>${esc(nameOf(m.id))}</span><small>${d?`${d.dir} ${directions[d.dir]}`:'Мимо'}</small></li>`;}).reverse().join(''):'<li class="empty">Пока нет ошибок</li>';}
function update() { $('#score').textContent=num(game.round.score); renderMenu();renderCompass();renderMisses(); }
function bindAnswer(){
  const input=$('#guessIn'),box=$('#sugg');let list=[],hi=0,choosing=false;
  const close=()=>{box.hidden=true;input.setAttribute('aria-expanded','false');};
  input.oninput=()=>{const q=norm(input.value);list=q?allNames.filter(n=>norm(n).includes(q)).sort((a,b)=>Number(norm(b).startsWith(q))-Number(norm(a).startsWith(q))).slice(0,6):[];hi=0;choosing=false;box.innerHTML=list.map((n,i)=>`<button type="button" id="choice-${i}" role="option" aria-selected="${i===hi}" data-name="${esc(n)}">${esc(n)}</button>`).join('');box.hidden=!list.length;input.setAttribute('aria-expanded',String(!!list.length));input.setAttribute('aria-activedescendant',list.length?'choice-0':'');};
  input.onkeydown=e=>{if(e.key==='Escape'){choosing=false;close();return;}if(box.hidden||!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();choosing=true;hi=(hi+(e.key==='ArrowDown'?1:list.length-1))%list.length;[...box.children].forEach((b,i)=>b.setAttribute('aria-selected',i===hi));input.setAttribute('aria-activedescendant',`choice-${hi}`);box.children[hi].scrollIntoView({block:'nearest'});};
  box.onmousedown=e=>e.preventDefault();
  box.onclick=e=>{const b=e.target.closest('[data-name]');if(b){input.value=b.dataset.name;submit();close();}};
  input.onblur=close;
  $('#guessForm').onsubmit=e=>{e.preventDefault();if((choosing||!matchCountry(input.value,names))&&list[hi])input.value=list[hi];submit();close();};
}
function submit(){
  const input=$('#guessIn'),id=matchCountry(input.value,names);
  if(!id)return toast('Выбери страну из списка или напиши её полное название.',2500);
  const res=guess(game.round,id,at);input.value='';
  if(!res)return toast('Эту версию уже проверяли.',1800);
  if(res.correct)return finishRound();
  update();toast(`${nameOf(id)} — мимо. −${WRONG} очков.`,2200);
}
function finishRound(){
  const r=game.round,c=byId.get(r.id);resetWalk();update();
  $('#guessForm').hidden=true;$('#giveUp').hidden=true;$('.answer-note').hidden=true;
  $('.answer-panel h2').textContent=c.name;
  $('#resultActions').innerHTML=`<div class="verdict"><b>${r.solved?'Верно!':'Ответ раскрыт'}</b><span>+${num(r.score)} очков</span></div>${r.solved&&game.players.length>1?`<p>Кто угадал?</p><div class="who">${game.players.map((p,i)=>`<button class="btn" data-who="${i}">${esc(p.name)}</button>`).join('')}<button class="btn" data-who="">Никто</button></div>`:nextButton()}`;
  if(game.players.length===1||!r.solved)settle(r.solved?0:null);
  $('#resultActions').onclick=e=>{const b=e.target.closest('[data-who]');if(b){settle(b.dataset.who===''?null:+b.dataset.who);$('#resultActions').innerHTML=nextButton();}if(e.target.closest('#nextBtn')){if(nextRound(game))beginRound();else finish();}};
  if(r.solved)confetti($('.verdict'),35);
}
const nextButton=()=>`<button class="btn primary" id="nextBtn">${game.index+1<game.order.length?'Следующая страна':'Итоги игры'}</button>`;
function settle(who){if(settled)return;settled=true;award(game,who);$('#totals').innerHTML=ranks();}
function finish(){
  resetWalk();document.body.classList.remove('is-investigating');$('#progress').hidden=true;
  stage.innerHTML=`<section class="final"><h1>Кругосветка завершена</h1><p>Раскрыто ${game.log.filter(l=>l.solved).length} из ${game.log.length} стран</p><div class="final-ranks">${ranks()}</div><div class="files">${game.log.map(l=>`<article>${shape(l.id)}<b>${esc(nameOf(l.id))}</b><span>${l.solved?`+${num(l.pts)}`:'Не угадано'}</span></article>`).join('')}</div><button class="btn primary" id="againBtn">Ещё путешествие</button> <button class="btn" id="homeBtn">К подборкам</button></section>`;
  $('#againBtn').onclick=start;$('#homeBtn').onclick=home;scrollTo({top:0,behavior:'instant'});
}
const walkEl=$('#walk'),dockEl=$('#walkDock'),frameEl=$('#walkFrame');let spot=0;
function panoUrl([lat,lng]){return `https://www.google.com/maps/embed?pb=!6m7!1m6!2m2!1d${lat}!2d${lng}!3f0!4f0!5f0.8`;}
function openWalk(){const spots=spotsOf(game.round.id);if(!spots)return; if(!frameEl.getAttribute('src'))frameEl.src=panoUrl(spots[spot]);walkEl.hidden=false;if(!walkEl.open)walkEl.showModal();dockEl.hidden=true;$('#walkOther').hidden=spots.length<2;$('#walkRefund').hidden=game.round.done;}
function foldWalk(){if(walkEl.open)walkEl.close();walkEl.hidden=true;dockEl.hidden=!game||game.round.done;}
function resetWalk(){if(walkEl.open)walkEl.close();walkEl.hidden=true;dockEl.hidden=true;spot=0;frameEl.removeAttribute('src');}
walkEl.addEventListener('cancel',e=>{e.preventDefault();foldWalk();});
walkEl.addEventListener('close',()=>{if(!walkEl.open)walkEl.hidden=true;});
$('#walkFold').onclick=foldWalk;dockEl.onclick=openWalk;
$('#walkRefund').onclick=()=>{if(game&&refundWalk(game.round)){resetWalk();active='fact1';update();toast('150 очков возвращены. Прогулка отключена до следующего раунда.',3000);}};
$('#walkOther').onclick=()=>{const spots=spotsOf(game.round.id);if(spots){spot=(spot+1)%spots.length;frameEl.src=panoUrl(spots[spot]);}};
function openViewer(src){$('#viewerBody').innerHTML=`<img src="${esc(src)}" alt="Подсказка крупно">`;$('#viewerNote').textContent='';if(!$('#viewer').open)$('#viewer').showModal();}
$('#viewerBody').onclick=e=>{if(e.target.closest('[data-walk]')){$('#viewer').close();openWalk();}const img=e.target.closest('[data-zoom]')?.querySelector('img');if(img)openViewer(img.src);};
$('#viewer').onclose=()=>{$('#viewerBody').innerHTML='';};
document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))e.target.closest('dialog').close();});
document.querySelectorAll('dialog').forEach(d=>d.onclick=e=>{if(e.target===d){if(d===walkEl)foldWalk();else d.close();}});
$('#rulesBtn').onclick=()=>$('#rulesDialog').showModal();
$('#exitBtn').onclick=home;
addEventListener('keydown',e=>{if(e.key==='Escape'&&!walkEl.hidden)foldWalk();});
home();
