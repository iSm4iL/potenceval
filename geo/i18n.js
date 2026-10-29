import { lang, t } from '../shared/i18n.js?v=ui-20261029';
import { COUNTRIES as DOSSIERS, PACKS as REGIONS } from './countries.js';
import { FACTS, PEOPLE, OMIT_PEOPLE, MONEY } from './content.js';
import { PROFILES_EN, FACTS_EN } from './content-en.js';

export { lang, t };
export const MONEY_EN = {
  'Рубль':'Ruble', 'Гривна':'Hryvnia', 'Лей':'Leu', 'Злотый':'Złoty', 'Крона':'Krone',
  'Евро':'Euro', 'Форинт':'Forint', 'Динар':'Dinar', 'Конвертируемая марка':'Convertible mark',
  'Денар':'Denar', 'Лек':'Lek', 'Франк':'Franc', 'Фунт стерлингов':'Pound sterling',
  'Тенге':'Tenge', 'Сум':'Sum', 'Сом':'Som', '100 дирамов = 1 денежная единица':'100 dirams = 1 monetary unit',
  'Манат':'Manat', 'Лари':'Lari', 'Драм':'Dram', 'Лира':'Lira', 'Риал':'Rial', 'Риял':'Riyal',
  'Новый шекель':'New shekel', 'Фунт':'Pound', 'Дирхам':'Dirham', 'Рупия':'Rupee', 'Юань':'Yuan',
  'Тугрик':'Tögrög', 'Иена':'Yen', 'Вона':'Won', 'Донг':'Đồng', 'Бат':'Baht', 'Риель':'Riel',
  'Ринггит':'Ringgit', 'Доллар':'Dollar', 'Песо':'Peso', 'Франк КФА':'CFA franc', 'Седи':'Cedi',
  'Найра':'Naira', 'Быр':'Birr', 'Шиллинг':'Shilling', 'Рэнд':'Rand', 'Ариари':'Ariary',
  'Колон':'Colón', 'Бальбоа и доллар':'Balboa and dollar', 'Боливар':'Bolívar', 'Доллар США':'US dollar',
  'Соль':'Sol', '100 сентаво = 1 денежная единица':'100 centavos = 1 monetary unit',
  'Реал':'Real', 'Кина':'Kina', 'Тала':'Tala',
};

export const PHRASE_TRANSLATIONS = {
  'К чёрту!':'“Break a leg!” — “To the devil!” (a traditional good-luck exchange)',
  'Спасибо!':'Thank you!', 'Добрый день! Спасибо!':'Good afternoon! Thank you!',
  'Спасибо! Привет!':'Thank you! Hello!', 'Большое спасибо!':'Thank you very much!',
  'Спасибо! Добрый день!':'Thank you! Good afternoon!', 'Спасибо! Доброе утро!':'Thank you! Good morning!',
  'Спасибо! Пока!':'Thank you! Bye!', 'Привет! Спасибо!':'Hello! Thank you!',
  'Спасибо! Здравствуйте!':'Thank you! Hello!', 'Спасибо! (на двух языках)':'Thank you! (in two languages)',
  'Здравствуйте! Большое спасибо!':'Hello! Thank you very much!', 'Здравствуйте! Спасибо!':'Hello! Thank you!',
  'Спасибо, дружище! Чайку?':'Thanks, mate! Would you like some tea?',
  'Здравствуйте! Будем здоровы!':'Hello! Cheers!', 'Здравствуйте!':'Hello!',
  'Спасибо! Давай!':'Thank you! Let’s go!', 'Спасибо, ну!':'Thank you! (with a colloquial particle)',
  'Спасибо! Здоровья!':'Thank you! Good health!', 'Добро пожаловать! Спасибо!':'Welcome! Thank you!',
  'Спасибо! (на йоруба и игбо)':'Thank you! (in Yoruba and Igbo)',
  'Спасибо! (два официальных языка)':'Thank you! (in two official languages)',
  'Привет! Большое спасибо!':'Hello! Thank you very much!', 'Здорово, народ!':'Hello, everyone!',
  'Извините! Спасибо!':'Sorry! Thank you!', 'Давай! Спасибо, чувак!':'Come on! Thanks, dude!',
  'Как дела, братан!':'How’s it going, mate?', 'Как оно?':'What’s up?',
  '«Чистая жизнь» — и «привет», и «всё отлично»':'“Pure life” — used for both “hello” and “all is well”',
  'Спасибо! Ничего себе!':'Thank you! Wow!', 'Как круто! Спасибо!':'How cool! Thank you!',
  'Круто, друг!':'Cool, friend!', 'Брр, холодно!':'Brr, it’s cold!', 'Здорово, братан!':'Hey, mate!',
  'Да здравствует!':'Long live! (a celebratory greeting)', 'Понял, чувак?':'Got it, dude?',
  'Эй, приятель!':'Hey, mate!', 'Эй, ладно!':'Hey, alright!', 'Привет, дружище!':'Hello, mate!',
  'Привет! (на маори)':'Hello! (in Māori)',
};

// Keep genuine Cyrillic phrases; replace Russian phonetic spellings with Latin transliterations in EN.
const PHRASES_EN = {
  GE:'Gamarjoba!', AM:'Shnorhakalutyun!', IR:'Mersi! Salam!', IL:'Shalom! Toda!',
  JO:'Shukran!', LB:'Shukran! Merci!', SA:'Shukran! Yalla!', AE:'Shukran!', QA:'Shukran!', OM:'Shukran!',
  IN:'Namaste!', PK:'Shukriya!', NP:'Namaste! Dhanyabad!', LK:'Ayubowan!', CN:'Nǐ hǎo!',
  MN:'Bayarlalaa!', JP:'Arigatō!', KR:'Gamsahamnida!', KP:'Gomapseumnida!', TH:'Khop khun kha!',
  KH:'Or kun!', EG:'Shukran!', MA:'Shukran! Salam!', TN:'Shukran!', DZ:'Shukran! Saha!', ET:'Ameseginalehu!',
};
const CURRENCY_OVERRIDES_EN = { CZ:'Koruna', IS:'Króna', SE:'Krona', ID:'Rupiah' };
const EXTRA_ALIASES = { US:['United States of America','US'], AE:['United Arab Emirates'], GB:['Great Britain'], MK:['Macedonia'] };

export function localizeCountry(c, locale = lang) {
  const person = OMIT_PEOPLE.includes(c.id) ? null : PEOPLE[c.id] || c.person;
  const [name, food, personName, achievement] = PROFILES_EN[c.id];
  return {
    ...c,
    name: locale === 'en' ? name : c.name,
    aliases: [...new Set([c.name, name, ...c.aliases, ...(EXTRA_ALIASES[c.id] || [])])],
    facts: locale === 'en' ? FACTS_EN[c.id] : [...c.facts, ...FACTS[c.id]],
    phrase: locale === 'en' ? [PHRASES_EN[c.id] || c.phrase[0], PHRASE_TRANSLATIONS[c.phrase[1]]] : c.phrase,
    food: [locale === 'en' ? food : c.food[0], c.food[1]],
    person: person ? [locale === 'en' ? personName : person[0], locale === 'en' ? achievement : person[1], person[2]] : null,
    currency: locale === 'en' ? CURRENCY_OVERRIDES_EN[c.id] || MONEY_EN[MONEY[c.id]] : MONEY[c.id],
  };
}

const regionNames = { europe:'Europe', asia:'Asia', africa:'Africa', america:'Americas', oceania:'Oceania', all:'Worldwide' };
const regionDescriptions = { europe:'From Iceland to Cyprus', asia:'From Istanbul to Tokyo', africa:'Deserts, savannahs and islands', america:'North, Central and South America', oceania:'Australia and the Pacific islands', all:'Every country in the case files' };
export function localizePack(p, locale = lang) {
  return {...p, name:locale === 'en' ? regionNames[p.id] : p.name, desc:locale === 'en' ? regionDescriptions[p.id] : p.desc};
}
export const PACKS = REGIONS.map(p => localizePack(p));
export const COUNTRIES = DOSSIERS.map(c => localizeCountry(c));

export function countryCount(n) {
  return lang === 'en' ? `${n} ${n === 1 ? 'country' : 'countries'}`
    : `${n} ${{one:'страна',few:'страны',many:'стран',other:'стран'}[new Intl.PluralRules('ru').select(n)]}`;
}

// World-only guesses are accepted too. Their names are never used to construct clue text.
export function localizeWorld(world, locale = lang) {
  const display = new Intl.DisplayNames([locale], {type:'region'});
  return world.map(([id, name, ...coordinates]) => [id, locale === 'en' ? PROFILES_EN[id]?.[0] || display.of(id) : name, ...coordinates]);
}
