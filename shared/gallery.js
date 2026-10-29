import { GAMES } from './menu.js?v=ui-20261029';
import { t } from './i18n.js?v=ui-20261029';
const root = new URL('../', import.meta.url);
const details = {
  music:[t('Узнай песню с полсекунды. Не получилось? Открой отрывок подлиннее.','Name a song in half a second. Need more? Make the clip longer.'),t('Один экран или онлайн','One screen or online'),'shared/assets/club/music.webp'],
  geo:[t('Покупай улики, соединяй факты и раскрой страну на доске следователя.','Buy clues, connect the facts and uncover the country on your detective board.'),t('1–4 игрока за одним экраном','1–4 players on one screen'),'shared/assets/home/board.webp'],
  opening:[t('Аниме, кино, сериалы и мультфильмы. Узнай историю по музыке.','Anime, movies, series and cartoons. Hear the theme and pick a poster.'),t('Один экран, любая компания','One screen, any crowd'),'shared/assets/club/screen.webp'],
  where:[t('Осмотрись на незнакомой улице и найди её на карте.','Explore an unfamiliar street and find it on the map.'),t('Один или до 8 игроков онлайн','Solo or up to 8 online'),'shared/assets/club/geo.webp'],
  screen:[t('Узнай историю по размытому постеру и подсказкам.','Recognize a story from a blurred poster and clues.'),t('За одним экраном','On one screen'),'shared/assets/gallery-v2/screen.webp'],
  genie:[t('Получи суперсилу. Друзья придумают подвох.','Get a superpower. Your friends invent the catch.'),t('2–8 игроков онлайн','2–8 players online'),'shared/assets/home/genie.webp'],
  dice:[t('Собирай комбинации и выбивай кости соперника.','Build combinations and knock out your rival’s dice.'),t('Один или вдвоём онлайн','Solo or two online'),'shared/assets/gallery-v2/dice.webp'],
  aura:[t('Четыре школы магии. Волны врагов. Один выживший.','Four schools of magic. Waves of enemies. One survivor.'),t('Один игрок','Single player'),'shared/assets/home/aura.webp'],
};
const url = path => new URL(path, root).href;
const art = id => {
  if(id === 'music') return `<img class="game-scene" src="${url(details[id][2])}" alt=""><img class="home-turntable" src="${url('shared/assets/home/player.webp')}" alt=""><span class="home-vinyl"></span>`;
  if(id === 'geo') return `<img class="game-scene" src="${url(details[id][2])}" alt=""><svg class="case-threads" viewBox="0 0 400 200" aria-hidden="true"><path d="M90 65L210 115L320 55M210 115L95 165M210 115L310 165"/></svg><span class="case-note case-note-one">${t('Факты','Facts')}</span><span class="case-note case-note-two">${t('Язык','Language')}</span><span class="case-note case-note-three">?</span>`;
  return `<img class="game-scene" src="${url(details[id][2])}" alt=""><span class="soundtrack-disc"></span><span class="soundtrack-caption">${t('Ты точно это слышал','You know this theme')}</span>`;
};
const feature = game => {
  const id=game.path.replace('/',''),[description,mode]=details[id];
  return `<a class="feature-game game-${id}" href="${url(game.path)}"><div class="game-art" aria-hidden="true">${art(id)}</div><div class="feature-copy"><h2>${game.name}</h2><p>${description}</p><div class="game-entry"><span>${mode}</span><b>${t('Играть','Play')} <span aria-hidden="true">→</span></b></div></div></a>`;
};
const small = game => {
  const id=game.path.replace('/',''),[description,mode,image]=details[id];
  return `<a class="library-game game-${id}" href="${url(game.path)}"><div class="library-art"><img src="${url(image)}" alt="" loading="lazy"></div><div><h3>${game.name}</h3><p>${description}</p><small>${mode}</small></div><span class="library-arrow" aria-hidden="true">↗</span></a>`;
};
const aura=GAMES.find(g=>g.path==='aura/');
document.querySelector('#games').innerHTML = `<div class="featured-games">${GAMES.slice(0,3).map(feature).join('')}</div><div class="library-bottom"><section class="more-games"><h2>${t('Ещё игры','More to play')}</h2><div class="library-list">${GAMES.slice(3).filter(g=>g!==aura).map(small).join('')}</div></section><a class="aura-entry" href="${url(aura.path)}"><img src="${url(details.aura[2])}" alt="" loading="lazy"><div><span>${details.aura[1]}</span><h2>Sorcery &amp; Aura</h2><p>${details.aura[0]}</p><b>${t('Начать забег','Start a run')} <span aria-hidden="true">→</span></b></div></a></div>`;
