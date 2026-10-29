import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { COUNTRIES as RAW, PACKS } from './countries.js';
import { PEOPLE, MONEY } from './content.js';
import { WORLD, SHAPES, PHOTOS } from './atlas.js';
import { WALKS } from './walks.js';
import { localizeCountry, localizePack } from './i18n.js';
import { localizeWorld } from './i18n.js';

const source = file => readFileSync(new URL(file, import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const escapeHTML = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// A text/interaction harness, not a layout engine. The parent checks the actual browser layout.
function page(lang) {
  const t = (ru, en) => lang === 'en' ? en : ru;
  const rules = runInContext(source('game.js') + '\n({CLUES,START,WRONG,norm,nameIndex,matchCountry,canOpen,cluePrice,currencyPrice,openClue,refundWalk,guess,guidance,surrender,createGame,award,nextRound,selectFacts,newRound});', createContext({t}));
  const banknotes = runInContext(source('banknotes.js') + '\n({banknoteHTML,banknoteFor});', createContext({t}));
  const nodes = new Map(), storage = new Map(), notices = [];
  const element = key => {
    if (!nodes.has(key)) nodes.set(key, {
      innerHTML:'', textContent:'', value:'', hidden:false, open:false, dataset:{}, style:{}, attributes:{}, children:[],
      classList:{add(){},remove(){},toggle(){}},
      querySelectorAll:() => [], querySelector:s => element(s),
      setAttribute(k,v){this.attributes[k]=String(v);}, getAttribute(k){return this.attributes[k];}, removeAttribute(k){delete this.attributes[k];},
      addEventListener(){}, focus(){}, scrollIntoView(){}, showModal(){this.open=true;}, close(){this.open=false;},
    });
    return nodes.get(key);
  };
  const document = {querySelector:element,querySelectorAll:()=>[],body:element('body'),activeElement:null,addEventListener(){}};
  const context = createContext({
    ...rules, ...banknotes, PEOPLE, MONEY, WALKS, WORLD_RU:WORLD, SHAPES, PHOTOS,
    COUNTRIES:RAW.map(c=>localizeCountry(c,lang)), PACKS:PACKS.map(p=>localizePack(p,lang)),
    localizeWorld, lang, t, countryCount:n=>`${n} ${t('стран','countries')}`,
    $:element, esc:escapeHTML, LS:{get:k=>storage.get(k),set:(k,v)=>storage.set(k,v)},
    toast:message=>notices.push(message), confetti(){}, A(){}, SPRING:'', nudge(){}, document,
    ResizeObserver:class{observe(){} disconnect(){}}, addEventListener(){}, requestAnimationFrame(){}, scrollTo(){},
  });
  // localizeWorld has its real default locale; explicitly bind the selected interface language here.
  context.localizeWorld = world => localizeWorld(world, lang);
  runInContext(source('app.js'), context);
  return {context,element,storage,notices,run:code=>runInContext(code,context)};
}

for (const lang of ['ru','en']) {
  test(`${lang}: home, every country's clues, guesses, results and refund render without runtime errors`, () => {
    const ui = page(lang), {element,run,storage} = ui;
    assert.match(element('#stage').innerHTML, new RegExp(lang === 'en' ? 'Guess the country' : 'Угадай страну'));
    assert.ok(!element('#stage').innerHTML.includes('${t('), 'no unevaluated translations');
    assert.equal((element('#stage').innerHTML.match(/data-pack=/g) || []).length, 6);
    run('start()');
    assert.match(element('#stage').innerHTML, new RegExp(lang === 'en' ? 'Country name…' : 'Название страны…'));
    assert.ok(storage.has(lang === 'ru' ? 'geo.facts.v2' : 'geo.facts.v2.en'));
    for (const c of RAW) {
      ui.context.countryId = c.id;
      run('game.round=newRound(countryId,[],[],{money:currencyPrice(MONEY[countryId],Object.values(MONEY))});roundFacts=byId.get(countryId).facts.slice(0,2);renderRound()');
      for (const key of ['fact1','fact2','phrase','food','money','person','walk','shape','compass']) {
        ui.context.clueKey = key;
        const html = run('evidenceHTML(clueKey)');
        assert.doesNotMatch(html, /undefined|\$\{t\(/, `${c.id}/${key}`);
        // Source-language phrases are clues; their translation and all other visible text are English.
        const visible = html.replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/g, '').replace(/<[^>]*>/g, '');
        if (lang === 'en') assert.doesNotMatch(visible, /\p{Script=Cyrillic}/u, `${c.id}/${key}`);
      }
      const board = element('#clueMenu').innerHTML;
      assert.ok(!board.includes(`<b>${localizeCountry(c,lang).name}</b>`), `${c.id}: answer stays hidden`);
    }
    run("game.round=newRound('RU');roundFacts=byId.get('RU').facts.slice(0,2);renderRound();");
    element('#guessIn').value = 'Japan';
    run('submit()');
    assert.equal(run('game.round.score'), 950);
    assert.doesNotMatch(element('#misses').innerHTML, /North|South|East|West|На север|На юг/u);
    run("openClue(game.round,'compass');renderCompass();renderMisses()");
    assert.equal(run('game.round.score'), 850);
    assert.match(element('#misses').innerHTML, /[↑↗→↘↓↙←↖]/u);
    element('#guessIn').value = 'Россия';
    run('submit()');
    assert.equal(run('game.round.solved'), true);
    assert.match(element('#resultActions').innerHTML, new RegExp(lang === 'en' ? 'Correct!' : 'Верно!'));
    run("game.round=newRound('RU');openClue(game.round,'walk');$('#walkRefund').onclick()");
    assert.equal(run('game.round.score'), 1000);
    assert.ok(run("game.round.unavailable.includes('walk')"));
    run('game.log=[{id:"RU",solved:true,pts:850}];finish()');
    assert.match(element('#stage').innerHTML, new RegExp(lang === 'en' ? 'Journey complete' : 'Кругосветка завершена'));
  });

  test(`${lang}: country search matches both languages and returns one localized name per country`, () => {
    const ui = page(lang);
    ui.run('start()');
    for (const [query,id] of [['росс','RU'],['russ','RU'],['сша','US'],['united arab','AE'],['турц','TR'],['turk','TR']]) {
      ui.element('#guessIn').value = query;
      ui.element('#guessIn').oninput();
      assert.ok(ui.element('#sugg').innerHTML.includes(localizeCountry(RAW.find(c=>c.id===id),lang).name), query);
    }
    ui.element('#guessIn').value = 'Czech';
    ui.element('#guessIn').oninput();
    assert.equal((ui.element('#sugg').innerHTML.match(/role="option"/g) || []).length, 1);
    ui.element('#guessForm').onsubmit({preventDefault(){}});
    assert.equal(ui.run('game.round.wrong.at(-1)?.id || game.round.id'), 'CZ');
  });
}
