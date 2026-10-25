// Only images whose reuse terms were checked on their individual file pages.
// Every other title uses an original, locally rendered clue illustration.
const freeImages = {
  'movie-597': {
    file: 'RMS Titanic 3.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:RMS_Titanic_3.jpg',
    license: 'Общественное достояние',
    credit: 'Фрэнсис Г. О. Стюарт'
  },
  'movie-329': {
    file: 'Tyrannosaurus skeletal diagram.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Tyrannosaurus_skeletal_diagram.jpg',
    license: 'Общественное достояние',
    credit: 'Генри Ф. Осборн'
  }
};

const art = {
  'movie-299536': ['◆', '#6d2b67', '#e0993e'],
  'movie-603': ['⌘', '#123d34', '#52b590'],
  'movie-27205': ['◎', '#243a5d', '#b2c4d9'],
  'movie-19995': ['✧', '#163f56', '#5cbcc5'],
  'movie-114': ['♥', '#733d55', '#f1afaf'],
  'movie-280': ['◉', '#443846', '#df6b57'],
  'movie-11': ['✦', '#1b2f55', '#f0d578'],
  'movie-105': ['◷', '#664738', '#e2b370'],
  'movie-20992': ['♬', '#343c45', '#ae8a6d'],
  'tv-1396': ['⚗', '#375235', '#c5a466'],
  'tv-1399': ['♛', '#4b3846', '#c5a885'],
  'tv-66732': ['✺', '#4b243a', '#dc6570'],
  'tv-100088': ['❀', '#34463f', '#c4ad81'],
  'tv-119051': ['✳', '#292a40', '#bba8ca'],
  'tv-105': ['♥', '#6d3d62', '#dda5b9'],
  'tv-1668': ['☕', '#69503d', '#d7ad75'],
  'tv-14853': ['⌬', '#545071', '#d4adbd'],
  'tv-104877': ['✿', '#5d566e', '#deb7aa'],
  'tv-1429': ['▥', '#445047', '#c7a67b'],
  'tv-31911': ['⚙', '#545060', '#c0b1a0'],
  'tv-85937': ['⚔', '#4b3643', '#e1a27b'],
  'tv-120089': ['✦', '#40535b', '#ddc38e'],
  'tv-95479': ['✳', '#3f3a61', '#a7a1d5'],
  'movie-8587': ['☼', '#80503a', '#e0b66d'],
  'movie-862': ['★', '#426378', '#f0b778'],
  'movie-808': ['♣', '#3e623a', '#b3c07b'],
  'movie-12': ['≈', '#225c75', '#e6b06e'],
  'movie-150540': ['●', '#49527d', '#e7ad69'],
  'local-film-harry-potter-1': ['✧', '#30435e', '#d7ba78'],
  'local-series-the-office-us': ['▦', '#4c5160', '#c9c5b2'],
  'local-anime-naruto': ['✶', '#7b4b34', '#e1b96e'],
  'local-cartoon-frozen': ['❄', '#3b6884', '#b9e4ec']
};

const defaults = {
  film: ['✦', '#473d58', '#c6a16f'],
  series: ['▤', '#3a4a60', '#b3b8c8'],
  anime: ['✿', '#5a3b62', '#caa8ce'],
  cartoon: ['☼', '#40645a', '#d9c77d']
};

export function visualFor(title) {
  const [glyph, dark, light] = art[title.id] || defaults[title.category] || defaults.film;
  const image = freeImages[title.id];
  return {
    glyph, dark, light,
    ...(image && {
      image: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(image.file)}?width=500`,
      source: image.source, license: image.license, credit: image.credit
    })
  };
}
