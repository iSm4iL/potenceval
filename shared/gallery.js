import { GAMES } from './menu.js?v=ui-20261029';
import { t } from './i18n.js?v=ui-20261029';
const root = new URL('../', import.meta.url);
const details = {
  genie:[t('Суперсила, о которой пожалеешь. Друзья придумают подвох.','A superpower you’ll regret. Your friends invent the catch.'),t('2–8 игроков · лобби','2–8 players · lobby')],
  dice:[t('Собирай кости в столбцы и разрушай планы соперника.','Stack dice in columns and wreck your rival’s plans.'),t('Один или вдвоём','Solo or two players')],
  music:[t('Пластинка, полсекунды звука и знакомая песня. Кто узнает первым?','A record, half a second of sound and a song you know. Who gets it first?'),t('Один экран или лобби','One screen or lobby')],
  opening:[t('Узнавай аниме, фильмы, сериалы и мультфильмы по знакомой музыке.','Recognize anime, movies, shows and cartoons by their music.'),t('4 подборки · 30 секунд','4 collections · 30 seconds'),'opening.svg'],
  screen:[t('Выбирай кассету. Узнавай кино, сериалы и аниме по зацепкам.','Pick a tape. Guess movies, shows and anime from the clues.'),t('Один экран · любая компания','One screen · any crowd')],
  geo:[t('Открывай улики на доске следователя и находи загаданную страну.','Reveal clues on the detective board and find the mystery country.'),t('1–4 игрока · один экран','1–4 players · one screen')],
  where:[t('Случайная улица где-то в мире. Осмотрись и поставь точку на карте.','A random street somewhere in the world. Look around and drop a pin.'),t('Один или до 8 друзей · лобби','Solo or up to 8 friends · lobby'),'where.svg'],
  aura:[t('Собирай заклинания, соединяй школы магии и переживи натиск тварей.','Collect spells, combine schools of magic and survive the onslaught.'),t('Один игрок · компьютер или телефон','One player · desktop or phone'),'aura.webp'],
};
document.querySelector('#games').innerHTML = GAMES.map((game, k) => {
  const id = game.path.replaceAll('/',''), [description, players] = details[id];
  const art = `shared/assets/gallery-v2/${details[id][2] || id + '.webp'}`;
  return `<a class="club-card club-card-${id}" href="${new URL(game.path,root)}"><figure><img src="${new URL(art,root)}" alt="" width="900" height="900" ${k < 3 ? 'fetchpriority="high"' : 'loading="lazy"'}></figure><div class="club-card-copy"><h2>${game.name}</h2><p>${description}</p><div class="club-card-bottom"><small>${players}</small><b>${id === 'rap' ? t('Послушать', 'Listen') : t('Играть', 'Play')} ↗</b></div></div></a>`;
}).join('');
