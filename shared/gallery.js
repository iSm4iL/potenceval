import { GAMES } from './menu.js?v=ui-20261029';
import { t } from './i18n.js?v=ui-20261029';
const root = new URL('../', import.meta.url);
const details = {
  music:[t('Узнай песню с полсекунды или открой отрывок подлиннее.','Name a song in half a second, or reveal a longer clip.'),t('Один экран или онлайн','One screen or online')],
  geo:[t('Покупай улики и раскрой страну на доске следователя.','Buy clues and uncover the country on your detective board.'),t('1–4 игрока, один экран','1–4 players, one screen')],
  opening:[t('Узнавай аниме, кино, сериалы и мультфильмы по музыке.','Recognize anime, movies, series and cartoons from music.'),t('Один экран, любая компания','One screen, any crowd')],
  where:[t('Осмотрись на незнакомой улице и найди её на карте.','Explore an unfamiliar street and find it on the map.'),t('Один или до 8 онлайн','Solo or up to 8 online')],
  screen:[t('Узнай историю по размытому постеру и подсказкам.','Recognize a story from a blurred poster and clues.'),t('За одним экраном','On one screen')],
  genie:[t('Получи суперсилу. Друзья придумают подвох.','Get a superpower. Your friends invent the catch.'),t('2–8 игроков онлайн','2–8 players online')],
  dice:[t('Собирай комбинации и выбивай кости соперника.','Build combinations and knock out your rival’s dice.'),t('Один или двое онлайн','Solo or two online')],
  aura:[t('Четыре школы магии. Волны врагов. Один выживший.','Four schools of magic. Waves of enemies. One survivor.'),t('Один игрок','Single player')],
};
const esc = value => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.querySelector('#games').innerHTML = `<div class="table-surface"><div class="table-grain" aria-hidden="true"></div><div class="table-layout">${GAMES.map((game,k)=>{
 const id=game.path.replace('/',''),[description,mode]=details[id];
 return `<a class="table-game table-${id} ${k<3?'table-main':''}" href="${new URL(game.path,root)}" aria-describedby="hint-${id}"><img class="table-object" src="${new URL(`shared/assets/home/table-${id}.webp`,root)}" alt="" ${k<3?'fetchpriority="high"':'loading="lazy"'}><span class="game-note"><strong>${esc(game.name)}</strong><small>${esc(mode)}</small></span><span class="game-hint" id="hint-${id}">${esc(description)}</span></a>`;
}).join('')}</div><span class="table-corner" aria-hidden="true">potenceval</span></div>`;
