// Новые проверенные карточки добавляем сюда. Это наша подборка, без платного API.
export const EXTRA_TITLES = [
  {
    id: 'local-film-harry-potter-1', type: 'movie', category: 'film',
    title: 'Гарри Поттер и философский камень', aliases: ['Harry Potter and the Philosopher\'s Stone', 'Harry Potter and the Sorcerer\'s Stone'],
    year: 2001, country: 'Великобритания, США', runtime: '152 минуты',
    genres: ['фэнтези', 'приключения', 'семейный'], director: 'Крис Коламбус',
    cast: 'Дэниел Рэдклифф, Руперт Гринт, Эмма Уотсон',
    premise: 'Мальчик узнаёт о магическом мире и отправляется учиться в школу волшебства.',
    reference: 'https://www.harrypotter.com/discover/films/harry-potter-and-the-philosophers-stone'
  },
  {
    id: 'local-series-the-office-us', type: 'tv', category: 'series',
    title: 'Офис', aliases: ['The Office', 'The Office (US)'],
    year: 2005, country: 'США', runtime: 'Серии около 22 минут',
    genres: ['комедия'], director: 'Грег Дэниелс',
    cast: 'Стив Карелл, Рейн Уилсон, Джон Красински',
    premise: 'Съёмочная группа наблюдает за буднями сотрудников бумажной компании.',
    reference: 'https://tv.apple.com/us/show/the-office/umc.cmc.455js879szmdywutf3qjewagm'
  },
  {
    id: 'local-anime-naruto', type: 'tv', category: 'anime',
    title: 'Наруто', aliases: ['Naruto'],
    year: 2002, country: 'Япония', runtime: 'Серии около 23 минут',
    genres: ['анимация', 'боевик', 'приключения'],
    cast: 'Дзюнко Такэути, Нориаки Сугияма, Тиэ Накамура',
    premise: 'Юный ниндзя мечтает стать лидером своей деревни и добиться признания.',
    reference: 'https://naruto-official.com/en/anime/naruto1'
  },
  {
    id: 'local-cartoon-frozen', type: 'movie', category: 'cartoon',
    title: 'Холодное сердце', aliases: ['Frozen'],
    year: 2013, country: 'США', runtime: '102 минуты',
    genres: ['анимация', 'семейный', 'фэнтези'], director: 'Крис Бак, Дженнифер Ли',
    cast: 'Кристен Белл, Идина Мензел, Джонатан Грофф',
    premise: 'Принцесса отправляется искать сестру, чья магия погрузила королевство в вечную зиму.',
    reference: 'https://movies.disney.com/frozen/'
  }
];
