// Английская версия карточек: id → [название, режиссёр/автор, актёры, о чём история].
// Страна, жанры и длительность переводятся словарями ниже.
const EN = {
  'movie-299536': ['Avengers: Infinity War', 'Anthony Russo, Joe Russo', 'Robert Downey Jr., Chris Hemsworth, Mark Ruffalo', 'Heroes from across the universe team up against a being who is collecting powerful artifacts.'],
  'tv-1396': ['Breaking Bad', 'Vince Gilligan', 'Bryan Cranston, Aaron Paul, Anna Gunn', 'After a grim diagnosis, a school teacher starts a dangerous illegal business.'],
  'tv-1429': ['Attack on Titan', '', 'Yuki Kaji, Yui Ishikawa, Marina Inoue', 'People live behind huge walls and try to survive attacks by gigantic creatures.'],
  'movie-8587': ['The Lion King', 'Roger Allers, Rob Minkoff', 'Matthew Broderick, James Earl Jones, Jeremy Irons', 'After a family tragedy, a young heir must return home and take his place.'],
  'movie-603': ['The Matrix', 'Lana Wachowski, Lilly Wachowski', 'Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss', 'A programmer learns that the world he knows may be an elaborate digital illusion.'],
  'movie-27205': ['Inception', 'Christopher Nolan', 'Leonardo DiCaprio, Joseph Gordon-Levitt, Ken Watanabe', 'A team of specialists breaks into other people’s dreams for a job once thought impossible.'],
  'movie-329': ['Jurassic Park', 'Steven Spielberg', 'Sam Neill, Laura Dern, Jeff Goldblum', 'Scientists are invited to an island where genetic engineering has turned ancient animals into an attraction.'],
  'movie-19995': ['Avatar', 'James Cameron', 'Sam Worthington, Zoe Saldaña, Sigourney Weaver', 'A former marine takes a mission on a distant planet and ends up caught between two worlds.'],
  'tv-1399': ['Game of Thrones', 'David Benioff, D. B. Weiss', 'Peter Dinklage, Kit Harington, Nikolaj Coster-Waldau', 'Noble families fight for power while an ancient threat awakens in the north.'],
  'tv-66732': ['Stranger Things', 'Matt Duffer, Ross Duffer', 'Millie Bobby Brown, Finn Wolfhard, Gaten Matarazzo', 'A boy’s disappearance leads his friends to secret experiments and strange powers.'],
  'tv-100088': ['The Last of Us', 'Craig Mazin, Neil Druckmann', 'Bella Ramsey, Pedro Pascal, Gabriel Luna', 'A smuggler is tasked with escorting a teenager across a country that survived a catastrophe.'],
  'tv-119051': ['Wednesday', 'Alfred Gough, Miles Millar', 'Jenna Ortega, Emma Myers, Joy Sunday', 'A girl arrives at an unusual academy and starts investigating a string of mysterious events.'],
  'tv-31911': ['Fullmetal Alchemist: Brotherhood', '', 'Rie Kugimiya, Romi Park, Shinichiro Miki', 'Two brothers search for a way to undo the consequences of a forbidden alchemy experiment.'],
  'tv-85937': ['Demon Slayer: Kimetsu no Yaiba', '', 'Natsuki Hanae, Akari Kito, Hiro Shimono', 'A young man joins a corps of hunters, hoping to save his sister after a demon attack.'],
  'tv-120089': ['SPY x FAMILY', '', 'Takuya Eguchi, Atsumi Tanezaki, Saori Hayami', 'A secret agent builds a fake family, unaware of the secrets its new members are keeping.'],
  'tv-95479': ['Jujutsu Kaisen', '', 'Junya Enoki, Yuichi Nakamura, Yuma Uchida', 'A schoolboy is dragged into the fight against curses and enrolls in a school for sorcerers.'],
  'movie-862': ['Toy Story', 'John Lasseter', 'Tom Hanks, Tim Allen, Don Rickles', 'Toys come alive when their owner leaves the room; a new favorite shakes up their order.'],
  'movie-808': ['Shrek', 'Andrew Adamson, Vicky Jenson', 'Mike Myers, Eddie Murphy, Cameron Diaz', 'An unsociable swamp dweller sets out to rescue a princess with a chatty companion.'],
  'movie-12': ['Finding Nemo', 'Andrew Stanton', 'Albert Brooks, Ellen DeGeneres, Alexander Gould', 'A father crosses the ocean to find his son and meets a forgetful travel buddy.'],
  'movie-150540': ['Inside Out', 'Pete Docter', 'Amy Poehler, Phyllis Smith, Richard Kind', 'Emotions argue inside a girl’s head when her family has to move to another city.'],
  'tv-105': ['Sex and the City', 'Darren Star', 'Sarah Jessica Parker, Kim Cattrall, Kristin Davis', 'Four friends in New York build careers, look for love and talk through their lives.'],
  'tv-1668': ['Friends', 'David Crane, Marta Kauffman', 'Jennifer Aniston, Courteney Cox, Lisa Kudrow', 'Six friends support each other through work, relationships and everyday troubles.'],
  'tv-14853': ['O Clone', 'Glória Perez', 'Murilo Benício, Giovanna Antonelli, Juca de Oliveira', 'A love story between people from different cultures intertwines with a scientific experiment.'],
  'tv-104877': ['Love Is in the Air', 'Ayşe Üner Kutlu', 'Hande Erçel, Kerem Bürsin, Evrim Doğan', 'After losing her scholarship, a girl agrees to pose as the fiancée of the man she blames for it.'],
  'movie-114': ['Pretty Woman', 'Garry Marshall', 'Julia Roberts, Richard Gere, Héctor Elizondo', 'A chance meeting between a businessman and a young woman in Los Angeles changes both their plans.'],
  'movie-597': ['Titanic', 'James Cameron', 'Leonardo DiCaprio, Kate Winslet, Billy Zane', 'People from different walks of life meet aboard an ocean liner.'],
  'movie-280': ['Terminator 2: Judgment Day', 'James Cameron', 'Arnold Schwarzenegger, Linda Hamilton, Edward Furlong', 'A machine from the future protects a teenager on whom humanity’s fate depends.'],
  'movie-11': ['Star Wars: A New Hope', 'George Lucas', 'Mark Hamill, Harrison Ford, Carrie Fisher', 'A young man from a distant planet joins the fight against a galactic empire.'],
  'movie-105': ['Back to the Future', 'Robert Zemeckis', 'Michael J. Fox, Christopher Lloyd, Lea Thompson', 'A teenager accidentally travels to the past and risks changing his own family’s life.'],
  'movie-20992': ['Brother', 'Aleksei Balabanov', 'Sergei Bodrov Jr., Viktor Sukhorukov, Yuri Kuznetsov', 'After the army, a young man comes to St. Petersburg to see his older brother and ends up in the criminal world.'],
  'local-film-harry-potter-1': ['Harry Potter and the Philosopher’s Stone', 'Chris Columbus', 'Daniel Radcliffe, Rupert Grint, Emma Watson', 'A boy discovers the world of magic and goes off to study at a school of wizardry.'],
  'local-series-the-office-us': ['The Office', 'Greg Daniels', 'Steve Carell, Rainn Wilson, John Krasinski', 'A film crew follows the daily lives of employees at a paper company.'],
  'local-anime-naruto': ['Naruto', '', 'Junko Takeuchi, Noriaki Sugiyama, Chie Nakamura', 'A young ninja dreams of becoming the leader of his village and earning recognition.'],
  'local-cartoon-frozen': ['Frozen', 'Chris Buck, Jennifer Lee', 'Kristen Bell, Idina Menzel, Jonathan Groff', 'A princess sets out to find her sister, whose magic has plunged the kingdom into endless winter.'],
};
// Варианты-обманки в подсказках к вводу (как OPTIONS в catalog.js).
export const OPTIONS_EN = {
  film: ['The Matrix', 'Inception', 'Interstellar', 'Avatar', 'Spider-Man: No Way Home', 'Avengers: Endgame'],
  series: ['Game of Thrones', 'Better Call Saul', 'Stranger Things', 'Sherlock', 'The Last of Us', 'Peaky Blinders'],
  anime: ['Death Note', 'Naruto', 'Fullmetal Alchemist', 'One Piece', 'Jujutsu Kaisen', 'Demon Slayer: Kimetsu no Yaiba'],
  cartoon: ['Inside Out', 'Toy Story', 'Frozen', 'Shrek', 'Zootopia', 'Finding Nemo']
};
const COUNTRY = { 'США': 'USA', 'Япония': 'Japan', 'Великобритания': 'United Kingdom', 'Бразилия': 'Brazil', 'Россия': 'Russia', 'Турция': 'Turkey' };
const GENRE = { фантастика: 'sci-fi', приключения: 'adventure', анимация: 'animation', комедия: 'comedy', драма: 'drama', боевик: 'action',
  семейный: 'family', мелодрама: 'romance', фэнтези: 'fantasy', триллер: 'thriller', криминал: 'crime', детектив: 'mystery' };
const runtime = r => r.replace(/^Серии около (\d+) минут.*/, 'Episodes about $1 min').replace(/^Серии$/, 'Episodes').replace(/^(\d+) минут.*/, '$1 min');

// Карточка на английском; русское название остаётся в aliases, чтобы его тоже принимали как ответ.
export function toEnglish(t) {
  const en = EN[t.id];
  if (!en) return t;
  const [title, director, cast, premise] = en;
  return { ...t, title, aliases: [t.title, ...(t.aliases || []).filter(a => a !== title)],
    director: t.director ? director : t.director, cast, premise,
    country: t.country.split(', ').map(c => COUNTRY[c] || c).join(', '),
    runtime: runtime(t.runtime), genres: t.genres.map(g => GENRE[g] || g) };
}
