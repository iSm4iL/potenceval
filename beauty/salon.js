export const salon = {
  name: 'Форма',
  descriptor: 'Студия красоты',
  headline: 'Красота в деталях.',
  intro: 'Стрижки, ногти и брови в студии на Патриарших.',
  area: 'Москва, Патриаршие',
  address: 'Большой Патриарший переулок, 8',
  hours: 'Ежедневно с 10:00 до 20:00',
  zone: 'Europe/Moscow',
  accent: '#c4d3b1',
  hero: './assets/hero.webp',
  logo: '',
};

export const masters = [
  { id: 'maria', name: 'Мария Белова', role: 'Стилист по волосам', level: 'Мастер', photo: './assets/maria.webp',
    bio: 'Работает с короткими стрижками и укладками на брашинг.' },
  { id: 'anna', name: 'Анна Ким', role: 'Стилист по волосам', level: 'Топ-мастер', photo: './assets/anna.webp',
    bio: 'Подбирает форму стрижки под текстуру волос и привычный способ укладки. Работает с мягкими слоями, бобами и естественными волнами.' },
  { id: 'lena', name: 'Елена Власова', role: 'Мастер маникюра', photo: './assets/lena.webp',
    bio: 'Любит аккуратные короткие формы, сложные оттенки и тонкое покрытие. Поможет выбрать цвет и расскажет, как ухаживать за руками дома.' },
  { id: 'sonya', name: 'Соня Миронова', role: 'Бровист', photo: './assets/sonya.webp',
    bio: 'Подбирает форму и оттенок бровей с учётом роста волосков и привычного макияжа. Обсуждает желаемый результат перед процедурой.' },
];

export const categories = [
  { id: 'hair', title: 'Волосы' },
  { id: 'nails', title: 'Ногти' },
  { id: 'brows', title: 'Брови' },
];

export function workingHours(masterId, day, master) {
  const weekday = new Date(day + 'T12:00:00Z').getUTCDay();
  if (master?.schedule) {
    return master.exceptions?.[day] ?? master.schedule[weekday];
  }
  const daysOff = { anna: [1], maria: [3], lena: [2], sonya: [0] };
  return daysOff[masterId]?.includes(weekday) ? [] : [[600, 840], [870, 1200]];
}

export const services = [
  { id: 'cut', category: 'hair', masterId: 'anna', photo: './assets/cut.webp', title: 'Стрижка и укладка', duration: 75, price: 4200 },
  { id: 'style', category: 'hair', masterId: 'anna', masterIds: ['anna', 'maria'], title: 'Укладка', duration: 45, price: 2700, prices: { anna: 3200 } },
  { id: 'nails', category: 'nails', masterId: 'lena', title: 'Маникюр с покрытием', duration: 90, price: 3100 },
  { id: 'bare', category: 'nails', masterId: 'lena', title: 'Маникюр без покрытия', duration: 45, price: 2000 },
  { id: 'brows', category: 'brows', masterId: 'sonya', title: 'Архитектура бровей', duration: 45, price: 2300 },
  { id: 'tint', category: 'brows', masterId: 'sonya', title: 'Окрашивание бровей', duration: 30, price: 1500 },
  { id: 'blowout', category: 'hair', masterIds: ['anna', 'maria'], title: 'Укладка на брашинг', duration: 60, price: 3200 },
  { id: 'fringe', category: 'hair', masterId: 'maria', photo: './assets/cut.webp', title: 'Стрижка чёлки', duration: 30, price: 1400 },
  { id: 'hair-care', category: 'hair', masterId: 'anna', title: 'Уход за волосами', duration: 60, price: 3500 },
  { id: 'french', category: 'nails', masterId: 'lena', title: 'Френч с маникюром', duration: 105, price: 3800 },
  { id: 'removal', category: 'nails', masterId: 'lena', title: 'Снятие покрытия', duration: 30, price: 900 },
  { id: 'brow-lamination', category: 'brows', masterId: 'sonya', title: 'Ламинирование бровей', duration: 60, price: 3100 },
];

export const serviceMasters = (service) => service.masterIds ?? [service.masterId];
export const serviceDuration = (service, masterId) => service.durations?.[masterId] ?? service.duration;
export const servicePrice = (service, masterId) =>
  service.prices && Object.hasOwn(service.prices, masterId) ? service.prices[masterId] : service.price;

export const news = [
  { id: 'waves', type: 'Событие', date: '28 ноября, 12:00', title: 'Как уложить волосы дома',
    poster: './assets/poster-waves.webp', until: '2026-11-28',
    photo: './assets/hair.webp', detail: 'Анна покажет, как создать мягкие волны феном и круглой щёткой, а затем разберёт вопросы по домашней укладке. Встреча пройдёт в студии.' },
  { id: 'palette', type: 'Новость', date: 'В студии', title: 'Новая палитра покрытий',
    poster: './assets/poster-palette.webp',
    photo: './assets/nails.webp', detail: 'В палитре появились дымчатый оливковый, сливовый и тёплый молочный. Елена покажет оттенки при дневном свете перед маникюром.' },
  { id: 'care', type: 'Акция', date: 'До 30 ноября', title: 'Уход в подарок к укладке',
    poster: './assets/poster-care.webp',
    photo: './assets/hair.webp', serviceId: 'style', masterId: 'anna', until: '2026-11-30',
    detail: 'Анна подберёт уход для ваших волос и сделает укладку. Уход входит в стоимость визита по акции.' },
];
