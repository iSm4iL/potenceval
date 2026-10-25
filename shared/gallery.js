import { GAMES } from './menu.js?v=club-20261025';
const root = new URL('../', import.meta.url);
const details = {
  genie:['Суперсила, о которой пожалеешь. Друзья придумают подвох.','2–8 игроков · лобби'],
  dice:['Собирай кости в столбцы и разрушай планы соперника.','Один или вдвоём'],
  music:['Пластинка, полсекунды звука и знакомая песня. Кто узнает первым?','Один экран или лобби'],
  screen:['Выбирай кассету. Узнавай кино, сериалы и аниме по зацепкам.','Один экран · любая компания'],
  geo:['Открывай улики на доске следователя и находи загаданную страну.','1–4 игрока · один экран'],
  rap:['Выбирай настроение, слушай и сохраняй собственные биты.','Звуковая мастерская'],
};
document.querySelector('#games').innerHTML = GAMES.map(game => {
  const id = game.path.replaceAll('/',''), [description, players] = details[id];
  const art = `shared/assets/club/${id}.webp`;
  return `<a class="club-card" href="${new URL(game.path,root)}"><figure><img src="${new URL(art,root)}" alt="" width="768" height="448" ${id === 'genie' || id === 'dice' ? 'fetchpriority="high"' : 'loading="lazy"'}></figure><div class="club-card-copy"><h2>${game.name}</h2><p>${description}</p><div class="club-card-bottom"><small>${players}</small><b>${id === 'rap' ? 'Послушать' : 'Играть'} ↗</b></div></div></a>`;
}).join('');
