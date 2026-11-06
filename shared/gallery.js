import { GAMES } from './menu.js?v=ui-20261029';
import { t } from './i18n.js?v=ui-20261029';
const root = new URL('../', import.meta.url);
const details = {
  music:[t('Узнай песню с полсекунды или открой отрывок подлиннее.','Name a song in half a second, or reveal a longer clip.'),t('Один экран или онлайн','One screen or online')],
  geo:[t('Покупай улики и раскрой страну на доске следователя.','Buy clues and uncover the country on your detective board.'),t('1–4 игрока, один экран','1–4 players, one screen')],
  opening:[t('Узнавай аниме, кино, сериалы и мультфильмы по музыке.','Recognize anime, movies, series and cartoons from music.'),t('Один экран, любая компания','One screen, any crowd')],
};
const esc = value => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.querySelector('#games').innerHTML = `<div class="table-surface"><span class="billiard-ball ball-red" aria-hidden="true"></span><span class="billiard-ball ball-ivory" aria-hidden="true"></span><span class="billiard-ball ball-blue" aria-hidden="true"></span>${GAMES.slice(0,3).map(game=>{
 const id=game.path.replace('/',''),[description,mode]=details[id];
 return `<a class="table-game table-${id}" href="${new URL(game.path,root)}" title="${esc(description)}"><img class="table-object" src="${new URL(`shared/assets/home/billiards-${id}.webp`,root)}" alt=""><span class="game-note"><strong>${esc(game.name)}</strong><small>${esc(mode)}</small></span></a>`;
}).join('')}</div><details class="more-games"><summary>${t("Другие игры", "More games")} <span aria-hidden="true">+</span></summary><div class="more-list">${GAMES.slice(3).map(game => `<a href="${new URL(game.path,root)}"><span>${esc(game.icon)}</span><strong>${esc(game.name)}</strong><small>${esc(game.desc)}</small></a>`).join('')}</div></details>`;

