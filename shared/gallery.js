import { GAMES } from './menu.js?v=merge-20261026';
const root = new URL('../', import.meta.url);
const details = {
  genie:['Суперсила, о которой пожалеешь. Друзья придумают подвох.','2–8 игроков · лобби'],
  dice:['Собирай кости в столбцы и разрушай планы соперника.','Один или вдвоём'],
  music:['Пластинка, полсекунды звука и знакомая песня. Кто узнает первым?','Один экран или лобби'],
  opening:['Узнавай аниме, фильмы, сериалы и мультфильмы по знакомой музыке.','4 подборки · 30 секунд','opening.svg'],
  screen:['Выбирай кассету. Узнавай кино, сериалы и аниме по зацепкам.','Один экран · любая компания'],
  geo:['Открывай улики на доске следователя и находи загаданную страну.','1–4 игрока · один экран'],
  where:['Случайная улица где-то в мире. Осмотрись и поставь точку на карте.','Один или до 8 друзей · лобби','where.svg'],
  rap:['Выбирай настроение, слушай и сохраняй собственные биты.','Звуковая мастерская'],
};
document.querySelector('#games').innerHTML = GAMES.map((game, k) => {
  const id = game.path.replaceAll('/',''), [description, players] = details[id];
  const art = `shared/assets/gallery-v2/${details[id][2] || id + '.webp'}`;
  return `<a class="club-card club-card-${id}" href="${new URL(game.path,root)}"><figure><img src="${new URL(art,root)}" alt="" width="900" height="900" ${k < 3 ? 'fetchpriority="high"' : 'loading="lazy"'}></figure><div class="club-card-copy"><h2>${game.name}</h2><p>${description}</p><div class="club-card-bottom"><small>${players}</small><b>${id === 'rap' ? 'Послушать' : 'Играть'} ↗</b></div></div></a>`;
}).join('');
