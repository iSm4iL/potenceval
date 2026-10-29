// Рэп-биты: в основном современный трэп (как «ДИНАСТИЯ»), плюс бум-бэп и фонк про запас.
// Мелодии и аккорды — живые сэмплы инструментов, 808 и барабаны — синтез, как у продюсеров.
// Бит целиком задаётся сидом и стилем: у всех игроков он одинаковый, по сети передаём только их.
import { t, lang } from '../shared/i18n.js';
const SR = 44100;
const SF = 'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@044fab8e1456bfafc5776e86dfd6bb8697149aef/FluidR3_GM/';
export const CREDITS = t('Сэмплы инструментов: FluidR3 GM (Frank Wen), CC BY 3.0, через gleitz/midi-js-soundfonts', 'Instrument samples: FluidR3 GM (Frank Wen), CC BY 3.0, via gleitz/midi-js-soundfonts');

// ring — щипковые/ударные: звучат, пока сами не затухнут; иначе нота держится, сколько нужно
const SAMPLED = {
  piano: { gm: 'acoustic_grand_piano', label: t('пианино', 'piano'), ring: 1 },
  epiano: { gm: 'electric_piano_1', label: t('родес', 'Rhodes'), ring: 1 },
  musicbox: { gm: 'music_box', label: t('шкатулка', 'music box'), ring: 1 },
  bells: { gm: 'tubular_bells', label: t('колокола', 'bells'), ring: 1, vol: .8 },
  glock: { gm: 'glockenspiel', label: t('колокольчики', 'glockenspiel'), ring: 1, vol: .7 },
  celesta: { gm: 'celesta', label: t('челеста', 'celesta'), ring: 1 },
  kalimba: { gm: 'kalimba', label: t('калимба', 'kalimba'), ring: 1 },
  harp: { gm: 'orchestral_harp', label: t('арфа', 'harp'), ring: 1 },
  guitar: { gm: 'acoustic_guitar_nylon', label: t('гитара', 'guitar'), ring: 1 },
  eguitar: { gm: 'electric_guitar_clean', label: t('электрогитара', 'electric guitar'), ring: 1 },
  pizz: { gm: 'pizzicato_strings', label: t('пиццикато', 'pizzicato'), ring: 1 },
  sitar: { gm: 'sitar', label: t('ситар', 'sitar'), ring: 1 },
  koto: { gm: 'koto', label: t('кото', 'koto'), ring: 1 },
  harpsichord: { gm: 'harpsichord', label: t('клавесин', 'harpsichord'), ring: 1, vol: .8 },
  upright: { gm: 'acoustic_bass', label: t('контрабас', 'double bass'), ring: 1, vol: 1.6 },
  strings: { gm: 'string_ensemble_1', label: t('струнные', 'strings'), vol: .7 },
  violin: { gm: 'violin', label: t('скрипка', 'violin') },
  cello: { gm: 'cello', label: t('виолончель', 'cello') },
  choir: { gm: 'choir_aahs', label: t('хор', 'choir'), vol: .7 },
  voice: { gm: 'voice_oohs', label: t('голоса', 'voices'), vol: .7 },
  flute: { gm: 'flute', label: t('флейта', 'flute') },
  panflute: { gm: 'pan_flute', label: t('пан-флейта', 'pan flute') },
  brass: { gm: 'brass_section', label: t('духовые', 'brass'), vol: .8 },
  organ: { gm: 'church_organ', label: t('орган', 'organ'), vol: .6 },
};
const LABEL = { '808': '808', sub: t('саб-бас', 'sub bass'), cowbell: t('ковбелл', 'cowbell') };
const labelOf = k => SAMPLED[k]?.label ?? LABEL[k];

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
};
const PROGS = { // ступени лада, по аккорду на такт
  minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 5, 3, 4], [0, 6, 5, 6], [0, 3, 5, 4], [0, 0, 5, 5], [0, 5, 0, 5], [0, 3, 0, 3], [0, 0, 3, 4]],
  dorian: [[0, 3, 0, 3], [0, 3, 4, 3], [0, 6, 3, 0], [0, 0, 3, 3]],
  phrygian: [[0, 1, 0, 1], [0, 1, 6, 1], [0, 5, 1, 0], [0, 0, 1, 1]],
  harmonic: [[0, 5, 4, 4], [0, 3, 4, 0], [0, 5, 3, 4], [0, 0, 4, 4], [0, 5, 0, 4]],
};
// 808 «прыгает»: шаги из шестнадцати (снято с хард-трэпа: удары на 1-й доле и в конце такта)
const BOUNCE = [[0, 12, 14], [0, 10, 12], [0, 7, 12], [0, 3, 12, 14], [0, 10, 13], [0, 6, 10, 12, 14], [0, 3, 10, 12], [0, 7, 10, 12, 14]];
const TRAP = {
  half: 1, snares: [[8]], clap: 1, duck: 1, bass: ['808'],
  kit: { kick: [170, 230], kickDecay: [.15, .3], snare: [1700, 2600] },
};
export const STYLES = {
  hard: {
    ...TRAP, label: t('Хард', 'Hard'), bpm: [148, 162], scales: ['minor', 'harmonic', 'phrygian'], intro: ['melody', 'filtered', 'cold', 'build'],
    kicks: BOUNCE, hats: ['trap', 'trap', '8ths'], perc: ['none', 'snap', 'rim'], bassPat: ['bounce', 'bounce', 'kick'], drive: 5, bassGain: .82,
    chords: [['choir', 'pad'], ['strings', 'pad'], ['voice', 'pad'], ['none', 'none'], ['none', 'none']],
    lead: [['piano', 'motif'], ['bells', 'motif'], ['musicbox', 'motif'], ['guitar', 'motif'], ['harpsichord', 'motif'], ['glock', 'arp'], ['piano', 'arp'], ['pizz', 'motif']],
    counter: ['choir', 'strings', 'bells', 'violin', 'glock'], seventh: 0, verb: .2, loud: 1,
  },
  dark: {
    ...TRAP, label: t('Дарк', 'Dark'), bpm: [128, 145], clap: .6, scales: ['minor', 'harmonic', 'phrygian'], intro: ['melody', 'filtered', 'cold'],
    kicks: [[0, 10], [0, 11], [0, 7, 10], [0, 12], [0, 12, 14]], hats: ['8ths', 'trap', 'triplet'], perc: ['rim', 'none'], bassPat: ['kick', 'sustain'], drive: 3, bassGain: .9,
    chords: [['choir', 'pad'], ['strings', 'pad'], ['organ', 'pad'], ['voice', 'pad']],
    lead: [['piano', 'motif'], ['musicbox', 'motif'], ['bells', 'long'], ['celesta', 'motif'], ['harpsichord', 'motif'], ['violin', 'long'], ['piano', 'call']],
    counter: ['bells', 'glock', 'violin', 'cello', 'celesta'], seventh: .2, verb: .32,
  },
  drill: {
    ...TRAP, label: t('Дрилл', 'Drill'), bpm: [138, 146], clap: .5, scales: ['harmonic', 'phrygian', 'minor'], intro: ['melody', 'build', 'filtered'],
    kicks: [[0, 10], [0, 11], [0, 3, 10], [0, 7]], snares: [[8], [8, 11], [8, 14], [3, 8]], hats: ['triplet', 'drill'], perc: ['rim', 'none'],
    bassPat: ['slide'], drive: 3.5, bassGain: .8,
    chords: [['choir', 'pad'], ['strings', 'pad'], ['none', 'none']],
    lead: [['piano', 'motif'], ['strings', 'long'], ['bells', 'call'], ['violin', 'motif'], ['pizz', 'motif'], ['flute', 'motif']],
    counter: ['choir', 'violin', 'bells', 'cello'], seventh: 0, verb: .28, loud: 1,
  },
  melodic: {
    ...TRAP, label: t('Мелодик', 'Melodic'), bpm: [140, 160], scales: ['minor', 'dorian'], intro: ['melody', 'cold', 'filtered'],
    kicks: [[0, 10], [0, 7, 10], [0, 12, 14], [0, 3, 10], [0, 10, 12]], hats: ['trap', '16ths'], perc: ['snap', 'none'], bassPat: ['bounce', 'kick'], drive: 2.5, bassGain: .85,
    chords: [['guitar', 'arp'], ['harp', 'arp'], ['epiano', 'pad'], ['none', 'none']],
    lead: [['guitar', 'motif'], ['kalimba', 'motif'], ['musicbox', 'arp'], ['eguitar', 'motif'], ['flute', 'motif'], ['celesta', 'arp'], ['epiano', 'motif']],
    counter: ['flute', 'glock', 'strings', 'voice'], seventh: .5, verb: .3,
  },
  trap: {
    ...TRAP, label: t('Трэп', 'Trap'), bpm: [132, 150], clap: .7, scales: ['minor', 'harmonic'], intro: ['melody', 'filtered', 'build', 'drums'],
    kicks: [[0, 10], [0, 7, 10], [0, 3, 10], [0, 6, 11], [0, 10, 13], [0, 11]], hats: ['trap', '16ths', 'triplet'], perc: ['snap', 'rim', 'none'],
    bassPat: ['kick', 'slide', 'bounce'], drive: 3, bassGain: .9,
    chords: [['strings', 'pad'], ['choir', 'pad'], ['pizz', 'arp'], ['none', 'none']],
    lead: [['bells', 'motif'], ['flute', 'motif'], ['piano', 'motif'], ['glock', 'arp'], ['brass', 'call'], ['guitar', 'motif'], ['pizz', 'motif']],
    counter: ['strings', 'choir', 'flute', 'glock', 'brass'], seventh: .2, verb: .22,
  },
  east: {
    ...TRAP, label: t('Восточный', 'Eastern'), bpm: [136, 150], scales: ['harmonic', 'phrygian'], intro: ['melody', 'cold', 'filtered'],
    kicks: [[0, 10], [0, 7, 10], [0, 12, 14], [0, 3, 10]], hats: ['trap', '8ths'], perc: ['rim', 'snap'], bassPat: ['bounce', 'kick', 'slide'], drive: 3.5, bassGain: .8,
    chords: [['strings', 'pad'], ['none', 'none'], ['voice', 'pad']],
    lead: [['sitar', 'motif'], ['koto', 'motif'], ['panflute', 'motif'], ['flute', 'call'], ['violin', 'motif'], ['harp', 'arp']],
    counter: ['strings', 'flute', 'violin', 'koto'], seventh: 0, verb: .3, loud: 1,
  },
  boombap: {
    label: t('Бум-бэп', 'Boom bap'), bpm: [84, 96], swing: [.1, .2], scales: ['minor', 'dorian'], intro: ['melody', 'drums', 'filtered', 'cold'],
    kicks: [[0, 10], [0, 7, 10], [0, 6, 10], [0, 9, 10], [0, 3, 10], [0, 7, 9]], snares: [[4, 12]], ghost: .45,
    hats: ['8ths', '16ths-skip', 'shaker'], perc: ['rim', 'tamb', 'none'], bass: ['upright', 'sub'], bassPat: ['kick', 'walk'],
    kit: { kick: [120, 170], kickDecay: [.3, .55], snare: [1400, 2200] },
    chords: [['piano', 'stab'], ['epiano', 'stab'], ['piano', 'pad'], ['strings', 'pad'], ['organ', 'stab'], ['guitar', 'stab'], ['harpsichord', 'stab']],
    lead: [['brass', 'call'], ['piano', 'motif'], ['bells', 'motif'], ['flute', 'call'], ['violin', 'call'], [null]],
    counter: ['strings', 'flute', 'brass'], seventh: .6, sat: 1.6, verb: .25, vinyl: 1,
  },
  phonk: {
    ...TRAP, label: t('Фонк', 'Phonk'), bpm: [128, 140], swing: [0, .05], scales: ['phrygian', 'minor'], intro: ['melody', 'cold', 'filtered'],
    kicks: [[0, 3, 6, 10], [0, 7, 10, 13], [0, 6, 10]], hats: ['8ths', '16ths'], perc: ['none'], bassPat: ['kick'], drive: 4, bassGain: .68,
    chords: [['none', 'none'], ['choir', 'pad']], lead: [['cowbell', 'riff'], ['cowbell', 'motif']], counter: ['choir', 'voice'], seventh: 0, sat: 1.5, verb: .18, loud: 1,
  },
};
export const MAIN_STYLES = ['hard', 'dark', 'drill', 'melodic', 'trap', 'east'];

const NAMES_RU = ['Холодный подъезд', 'Ночная маршрутка', 'Ржавая девятка', 'Бетонный рассвет', 'Последняя электричка', 'Спальный район',
  'Гаражный кооператив', 'Дым над ТЭЦ', 'Пятничная шаурма', 'Двор без фонарей', 'Сломанный домофон', 'Зимний гараж', 'Тёплый асфальт',
  'Девятый этаж', 'Неон над ларьком', 'Пустая остановка', 'Мокрый кроссовок', 'Шумные соседи', 'Кассета в бардачке', 'Звонок в три ночи',
  'Лифт не работает', 'Северный ветер', 'Дача в октябре', 'Сигнал с района', 'Чёрная Приора', 'Магнитола деда', 'Дождь на крыше',
  'Полночный перрон', 'Последний урок', 'Старый плеер', 'Кеды на проводах', 'Подвальная студия', 'Автобус на конечную', 'Ржавые качели',
  'Голуби на крыше', 'Батя на гараже', 'Сдача без чека', 'Холодный чай', 'Микрофон за сотку', 'Район спит', 'Синий троллейбус',
  'Пустой стадион', 'Курилка за школой', 'Бит из подвала', 'Тонированная пятёрка', 'Мартовский лёд', 'Свет в окне напротив', 'Три аккорда',
  'Фары в тумане', 'Блок на окраине', 'Династия', 'Корона из фольги', 'Золото на районе', 'Чёрный мерс', 'Тихий час'];
// Те же названия по-английски, в том же порядке: бит с одним сидом зовётся одинаково.
const NAMES = lang === 'en' ? ['Cold Stairwell', 'Night Minibus', 'Rusty Lada', 'Concrete Dawn', 'Last Train', 'Commuter Suburb', 'Garage Co-op', 'Smoke over the Plant', 'Friday Shawarma', 'Yard Without Lights', 'Broken Intercom', 'Winter Garage', 'Warm Asphalt', 'Ninth Floor', 'Neon over the Kiosk', 'Empty Bus Stop', 'Wet Sneaker', 'Noisy Neighbors', 'Tape in the Glovebox', '3 AM Call', 'Elevator Out of Order', 'North Wind', 'Dacha in October', 'Signal from the Block', 'Black Priora', 'Grandpa’s Radio', 'Rain on the Roof', 'Midnight Platform', 'Last Lesson', 'Old Player', 'Sneakers on the Wires', 'Basement Studio', 'Bus to the Last Stop', 'Rusty Swings', 'Pigeons on the Roof', 'Dad on the Garage', 'Change Without a Receipt', 'Cold Tea', 'Hundred-Ruble Mic', 'The Block Is Asleep', 'Blue Trolleybus', 'Empty Stadium', 'Smoking Spot Behind School', 'Beat from the Basement', 'Tinted Five', 'March Ice', 'Light in the Window Across', 'Three Chords', 'Headlights in the Fog', 'Block on the Outskirts', 'Dynasty', 'Tinfoil Crown', 'Gold on the Block', 'Black Merc', 'Quiet Hour'] : NAMES_RU;
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FILE_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MOTIFS = ['x..x..x...x.x...', 'x..x..x.x..x.x..', 'x...x..x..x.x...', 'x.x...x.x...x.x.', 'x..x..x.........', 'x...x...x..x..x.',
  '..x..x..x..x.x..', 'x.xx..x..x.x....', 'x......x..x.x...', 'x..x...xx.x.....', 'x.x.x...x.x.x...', 'x...x.x...x.x...'];
const RIFFS = ['x.x.xx.x.x.xx.x.', 'x..xx..xx..xx.x.', 'xxx.x.x.xxx.x.x.', 'x.x.x.x.x.x.x.x.', 'x..x.xx..x.xx.x.'];
const STABS = ['x.....x...x.....', 'x..x..x.........', 'x.......x.......', 'x...x...x...x...', '..x...x...x...x.', 'x..x....x..x....'];
const DRILL_HATS = ['x.xx.xx.xxx.', 'x.x.xx.x.xx.', 'xx.x.xx.x.x.'];

export function rng(seed) { // mulberry32; сид сначала перемешиваем, чтобы соседние сиды давали разные биты
  let a = seed >>> 0;
  a ^= a >>> 16; a = Math.imul(a, 0x85ebca6b); a ^= a >>> 13; a = Math.imul(a, 0xc2b2ae35); a ^= a >>> 16;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mtof = m => 440 * 2 ** ((m - 69) / 12);
const steps = s => [...s].map((c, i) => (c === 'x' ? i : -1)).filter(i => i >= 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Сэмплы нот грузим один раз на страницу
const decoder = typeof OfflineAudioContext !== 'undefined' ? new OfflineAudioContext(1, 1, SR) : null;
const noteCache = new Map();
function loadNote(inst, midi) {
  while (midi < 21) midi += 12;
  while (midi > 108) midi -= 12;
  const url = `${SF}${SAMPLED[inst].gm}-mp3/${FILE_NOTES[midi % 12]}${Math.floor(midi / 12) - 1}.mp3`;
  if (!noteCache.has(url)) noteCache.set(url, fetch(url).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then(b => decoder.decodeAudioData(b)).catch(() => null));
  return noteCache.get(url);
}

function makeMotif(r, pick, mode) {
  if (mode === 'arp') return { arp: pick(['up', 'down', 'updown', 'skip']), rate: pick([2, 1, 'trip']) };
  if (mode === 'long') return { bar1: [{ s: 0, d: pick([2, 4]), l: 8 }, { s: 8, d: pick([1, 3, 4, 5]), l: 8 }], bar2: [{ s: 0, d: pick([0, 2]), l: 12 }] };
  if (mode === 'riff') {
    const notes = steps(pick(RIFFS)).map(s => ({ s, d: pick([0, 0, 0, 7, 4, -3]), l: 1 }));
    return { bar1: notes, bar2: notes.map(n => (n.s >= 12 ? { ...n, d: n.d + pick([2, -2, 5]) } : n)) };
  }
  const on = steps(pick(MOTIFS));
  let d = pick([0, 2, 4]);
  const bar1 = on.map((s, j) => {
    if (j) d = clamp(d + pick([-2, -1, -1, 0, 1, 1, 2, 3, -3]), -3, 9);
    if (s % 4 === 0 && ![0, 2, 4].includes(((d % 7) + 7) % 7)) d += 1; // на сильных долях — звук аккорда
    return { s, d, l: Math.min(4, (on[j + 1] ?? 16) - s) };
  });
  const bar2 = mode === 'call'
    ? bar1.filter(n => n.s < 8)                                   // вопрос — ответ: во втором такте пауза
    : bar1.map(n => (n.s >= 10 ? { ...n, d: n.d + pick([-2, 1, 2]) } : n));
  return { bar1, bar2 };
}

// Рецепт бита: все случайные решения в одном месте, чтобы describe и renderBeat совпадали.
function recipe(seed, styleKey) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)], chance = p => r() < p;
  const between = ([a, b] = [0, 0]) => a + r() * (b - a);
  const style = STYLES[styleKey] ? styleKey : pick(MAIN_STYLES);
  const st = STYLES[style];
  const bpm = Math.round(between(st.bpm)), barSec = 240 / bpm;
  const key = Math.floor(r() * 12), scaleName = pick(st.scales), prog = pick(PROGS[scaleName]), name = pick(NAMES);
  const intro = pick(st.intro);
  const introBars = intro === 'cold' ? 1 : st.half ? pick([2, 4]) : 2;
  const verseBars = st.half ? 8 : 4, hookBars = st.half ? 8 : 4;
  let [chordInst, chordMode] = pick(st.chords), [leadInst, leadMode] = pick(st.lead);
  if (chordInst === 'none' && !leadInst) [leadInst, leadMode] = st.lead[0];
  const counter = chance(.7) ? pick(st.counter.filter(c => c !== leadInst && c !== chordInst)) : null;
  const bass = pick(st.bass), kit = st.kit;
  const rc = {
    seed, style, st, bpm, barSec, key, scale: SCALES[scaleName], prog, name, intro, introBars, verseBars, hookBars,
    preHook: pick(['none', 'none', 'break', 'stop']), clap: chance(st.clap || 0),
    kick: { f0: between(kit.kick), f1: 45 + r() * 10, decay: between(kit.kickDecay), click: .3 + r() * .4 },
    snare: { freq: between(kit.snare), decay: .12 + r() * .14, tone: 170 + r() * 80, toneAmt: .2 + r() * .4 },
    hat: { freq: 7500 + r() * 2500, decay: .025 + r() * .035 },
    kicks: [pick(st.kicks), pick(st.kicks)], snares: [pick(st.snares), pick(st.snares)],
    hats: pick(st.hats), perc: pick(st.perc), bass, bassPat: pick(st.bassPat),
    chordInst, chordMode, chordStab: steps(pick(STABS)), leadInst, leadMode, counter,
    motif: makeMotif(r, pick, leadMode), chordArp: makeMotif(r, pick, 'arp'), counterMotif: makeMotif(r, pick, pick(['long', 'arp'])),
    drillHats: steps(pick(DRILL_HATS)), fill: pick(['snare', 'hat', 'kick', 'none']),
    seventh: chance(st.seventh), swing: between(st.swing), verb: st.verb * (.7 + r() * .6), delay: chance(.45),
  };
  rc.hookHats = chance(.5) ? pick(st.hats) : rc.hats;
  rc.hookPerc = rc.perc === 'none' && chance(.5) ? pick(st.perc) : rc.perc;
  rc.tags = [...new Set([bass, chordInst, leadInst, counter].map(labelOf).filter(Boolean))];
  return rc;
}

// Паспорт бита: темп, тональность, инструменты, части (интро / куплет / припев) с таймингами.
export function describe(seed, style) {
  const rc = recipe(seed, style), { barSec, introBars: ib, verseBars: vb, hookBars: hb } = rc, bars = ib + vb + hb;
  return {
    seed, style: rc.style, label: rc.st.label, bpm: rc.bpm, key: rc.key, keyName: KEYS[rc.key] + 'm', name: rc.name, tags: rc.tags, barSec, bars,
    sections: [
      { name: t('Интро', 'Intro'), from: 0, to: ib * barSec },
      { name: t('Куплет', 'Verse'), from: ib * barSec, to: (ib + vb) * barSec },
      { name: t('Припев', 'Hook'), from: (ib + vb) * barSec, to: bars * barSec },
    ],
    duration: bars * barSec + barSec / 2,
  };
}

export async function renderBeat(info) {
  const rc = recipe(info.seed, info.style), { st, barSec } = rc;
  const r = rng(info.seed * 7919 + 13), pick = a => a[Math.floor(r() * a.length)];
  const bars = rc.introBars + rc.verseBars + rc.hookBars, end = bars * barSec;
  const ctx = new OfflineAudioContext(2, Math.ceil((end + barSec / 2 + 1.5) * SR), SR);
  const G = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const F = (type, freq, q = .7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
  const O = (type, freq, t, stop, to) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.connect(to); o.start(t); o.stop(stop); return o; };
  const shaper = (k, c = ctx) => { const s = c.createWaveShaper(), cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) cv[i] = Math.tanh(k * (i / 512 - 1)) / Math.tanh(k); s.curve = cv; return s; };
  const env = (g, t, a, peak, hold, rel) => {
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (hold > 0) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + Math.max(0, hold) + rel);
  };

  // ---- микшер: группы → затвор (стоп перед припевом) → фильтр-проход → перегруз → компрессор
  const sum = G(), gate = G(), sweep = F('lowpass', 20000), post = G(), comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .005; comp.release.value = .15;
  sum.connect(gate).connect(sweep).connect(post);
  let tail = post;
  if (st.sat) { const s = shaper(st.sat); tail.connect(s); tail = s; }
  tail.connect(comp).connect(ctx.destination);
  const irLen = Math.floor(SR * 2.2), ir = new AudioBuffer({ numberOfChannels: 2, length: irLen, sampleRate: SR });
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irLen; i++) d[i] = (r() * 2 - 1) * (1 - i / irLen) ** 3.5; }
  const verb = ctx.createConvolver(); verb.buffer = ir; verb.connect(G(rc.verb)).connect(sum);
  const duck = G(), lift = G(); duck.connect(lift).connect(sum); // duck: музыка «качается» от бочки
  if (!['filtered', 'drums'].includes(rc.intro)) { // интро без барабанов иначе слишком тихое на фоне дропа
    const up = rc.chordInst === 'none' ? 3 : 2;
    lift.gain.setValueAtTime(up, 0); lift.gain.setValueAtTime(up, Math.max(0, rc.introBars * barSec - .3)); lift.gain.linearRampToValueAtTime(1, rc.introBars * barSec);
  }
  const bus = (v, pan, send, to = sum) => { const g = G(v), p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p).connect(to); if (send) p.connect(G(send)).connect(verb); return g; };
  const drums = bus(1, 0, .05), hats = bus(.8, -.18, .04), perc = bus(.5, .22, .12), bass = bus(st.bassGain ?? .9, 0, 0);
  const chords = bus(.5, 0, .35, duck), lead = bus(.8, .12, .3, duck), counterBus = bus(.4, -.22, .35, duck);
  if (rc.delay) { // эхо на мелодии: точечная восьмая
    const dl = ctx.createDelay(1), fb = G(.3), lp = F('lowpass', 2800);
    dl.delayTime.value = barSec * 3 / 16; lead.connect(dl).connect(lp).connect(fb).connect(dl); lp.connect(G(.2)).connect(sum);
  }

  // ---- барабаны: рендерим один раз в сэмплы, дальше только проигрываем
  const nb = new AudioBuffer({ numberOfChannels: 1, length: SR, sampleRate: SR }), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
  const noise = (c, to, t, { type = 'highpass', freq = 7000, q = .7, vel = 1, decay = .05 }) => {
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = nb; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(.0001, t + decay);
    s.connect(f).connect(g).connect(to); s.start(t, r() * .4); s.stop(t + decay + .02);
  };
  const tone = (c, to, t, { type = 'sine', f0, f1, decay, vel = 1, bend = .1 }) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + bend);
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(.0001, t + decay);
    o.connect(g).connect(to); o.start(t); o.stop(t + decay + .02);
  };
  const shot = (dur, build) => { const c = new OfflineAudioContext(1, Math.ceil(dur * SR), SR); build(c, c.destination); return c.startRendering(); };
  const K = rc.kick, S = rc.snare, H = rc.hat;
  const [kickS, snareS, clapS, hatS, hatS2, openS, rimS, tambS, snapS, shakerS, crashS, clickS] = await Promise.all([
    shot(K.decay + .1, (c, to) => {
      const s = shaper(2.5, c); s.connect(to);
      tone(c, s, 0, { f0: K.f0, f1: K.f1, decay: K.decay, vel: 1, bend: .07 });
      noise(c, to, 0, { freq: 3000, vel: K.click, decay: .01 });
    }),
    shot(S.decay + .1, (c, to) => {
      noise(c, to, 0, { type: 'bandpass', freq: S.freq, q: .8, vel: .9, decay: S.decay });
      tone(c, to, 0, { type: 'triangle', f0: S.tone, f1: S.tone * .7, decay: .12, vel: S.toneAmt, bend: .08 });
    }),
    shot(.32, (c, to) => { // клэп из нескольких хлопков и хвоста
      for (let k = 0; k < 4; k++) noise(c, to, k * .009 + r() * .003, { type: 'bandpass', freq: 1250 + r() * 300, q: 1.1, vel: .7, decay: .025 });
      noise(c, to, .03, { type: 'bandpass', freq: 1300, q: .8, vel: .55, decay: .24 });
    }),
    shot(H.decay + .03, (c, to) => noise(c, to, 0, { freq: H.freq, vel: .6, decay: H.decay })),
    shot(H.decay + .03, (c, to) => noise(c, to, 0, { freq: H.freq * 1.12, vel: .5, decay: H.decay * .8 })),
    shot(.34, (c, to) => noise(c, to, 0, { freq: H.freq * .8, vel: .5, decay: .3 })),
    shot(.08, (c, to) => { tone(c, to, 0, { type: 'square', f0: 1700, f1: 1600, decay: .03, vel: .25 }); noise(c, to, 0, { type: 'bandpass', freq: 3000, q: 2, vel: .6, decay: .04 }); }),
    shot(.2, (c, to) => { for (let k = 0; k < 3; k++) noise(c, to, k * .008, { type: 'bandpass', freq: 9000, q: 3, vel: .5, decay: .12 }); }),
    shot(.12, (c, to) => { noise(c, to, 0, { type: 'highpass', freq: 2000, vel: .9, decay: .05 }); noise(c, to, .006, { type: 'bandpass', freq: 3500, q: 3, vel: .5, decay: .06 }); }),
    shot(.12, (c, to) => noise(c, to, 0, { type: 'bandpass', freq: 6000, q: 1.5, vel: .5, decay: .09 })),
    shot(1.6, (c, to) => noise(c, to, 0, { freq: 5000, vel: .45, decay: 1.5 })),
    shot(.01, (c, to) => noise(c, to, 0, { freq: 3000, vel: 1, decay: .004 })),
  ]);
  const hit = (b, t, vel, to, rate = 1) => { const s = ctx.createBufferSource(), g = G(vel); s.buffer = b; s.playbackRate.value = rate; s.connect(g).connect(to); s.start(t); };
  const kicks = [];
  const kick = (t, vel = 1) => { hit(kickS, t, vel, drums); kicks.push(t); };
  const hat = (t, vel = 1, rate = 1) => hit(r() < .5 ? hatS : hatS2, t, vel, hats, rate);

  // ---- мелодические инструменты: сэмплы откладываем, загрузим разом перед рендером
  const pending = [];
  const synthPluck = (t, m, dur, v, to) => {
    const g = G(), lp = F('lowpass', 4000); lp.frequency.setValueAtTime(4500, t); lp.frequency.exponentialRampToValueAtTime(400, t + .3);
    env(g, t, .003, .2 * v, 0, .5); lp.connect(g).connect(to); O('triangle', mtof(m), t, t + .6, lp);
  };
  const synthPad = (t, m, dur, v, to) => {
    const g = G(), lp = F('lowpass', 1800); env(g, t, .25, .07 * v, Math.max(0, dur - .25), .4); lp.connect(g).connect(to);
    for (const det of [-8, 8]) O('sawtooth', mtof(m), t, t + dur + .7, lp).detune.value = det;
  };
  const cowbell = (t, m, dur, v, to) => {
    const f = mtof(m), g = G(), bp = F('bandpass', f * 2, 3);
    env(g, t, .002, .55 * v, 0, .28); bp.connect(g).connect(to);
    O('square', f, t, t + .3, bp); O('square', f * 1.48, t, t + .3, bp);
  };
  const play = (inst, t, m, dur, v, to) => (inst === 'cowbell' ? cowbell(t, m, dur, v, to) : pending.push({ inst, t, m, dur, v, to }));

  const bassOut = (() => { const s = shaper(st.drive ?? 1.5), lp = F('lowpass', st.half ? 1100 : 700); s.connect(lp).connect(bass); return s; })();
  let last808 = null;
  const bassVoice = (t, midi, dur, glideTo, v = 1, slideIn = false) => {
    if (rc.bass === 'upright') return play('upright', t, midi, dur, v * 1.2, bass);
    if (rc.bass === '808') { while (midi >= 36) midi -= 12; if (glideTo != null) while (glideTo >= 36) glideTo -= 12; } // 808 живёт в C1–B1
    const g = G(), o = O('sine', mtof(slideIn && last808 != null ? last808 : midi), t, t + dur + .06, g);
    if (slideIn && last808 != null) o.frequency.setTargetAtTime(mtof(midi), t, .035);   // подъезд от прошлой ноты
    if (glideTo != null) o.frequency.setTargetAtTime(mtof(glideTo), t + dur * .7, .04);
    const sub = rc.bass === 'sub';
    env(g, t, .005, .9 * v, sub ? Math.min(dur * .5, .15) : Math.min(dur * .6, .3), sub ? Math.min(dur, .35) : Math.max(.06, dur * .45));
    g.connect(bassOut);
    last808 = glideTo ?? midi;
  };

  // ---- гармония
  const sc = rc.scale, bassRoot = 31 + ((rc.key + 5) % 12); // G1..F#2
  const note = (deg, base) => base + sc[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
  const chordOf = bar => rc.prog[(((bar - rc.introBars) % 4) + 4) % 4];
  const bassNote = deg => { const n = note(deg, bassRoot); return n - bassRoot > 6 ? n - 12 : n; };
  let prevVoicing = null;
  const voicing = deg => { // обращение аккорда, ближайшее к предыдущему — аккорды «текут», а не прыгают
    const base = [0, 2, 4, ...(rc.seventh ? [6] : [])].map(d => note(deg + d, bassRoot + 24));
    let best = base, bestCost = Infinity;
    for (let inv = 0; inv < base.length; inv++) {
      const v = base.map((n, i) => (i < inv ? n + 12 : n)).sort((a, b) => a - b);
      const center = v.reduce((a, b) => a + b) / v.length;
      const cost = prevVoicing ? Math.abs(center - prevVoicing) : Math.abs(center - 62);
      if (cost < bestCost) { best = v; bestCost = cost; }
    }
    prevVoicing = best.reduce((a, b) => a + b) / best.length;
    return best;
  };
  // регистр мелодии — от тоники бита, чтобы она всегда была в тональности аккордов
  const OCT = { bells: 24, glock: 36, musicbox: 36, celesta: 36, kalimba: 36, flute: 36, panflute: 36, piano: 36, epiano: 24, guitar: 24, eguitar: 24,
    harp: 36, pizz: 24, sitar: 24, koto: 36, harpsichord: 24, violin: 36, cello: 12, strings: 24, choir: 24, voice: 24, brass: 24, organ: 24, cowbell: 36 };
  const baseOf = inst => bassRoot + (OCT[inst] ?? 24);
  const sixteenth = barSec / 16, swingOf = s => (s % 2 ? rc.swing * sixteenth : 0);
  const arp = (inst, t0, deg, motif, v, to, base, time) => {
    const tones = [0, 2, 4, 7].map(d => note(deg + d, base));
    const seq = motif.arp === 'down' ? [...tones].reverse() : motif.arp === 'updown' ? [...tones, tones[2], tones[1]] : tones;
    const n = motif.rate === 'trip' ? 12 : motif.rate === 1 ? 16 : 8;
    for (let k = 0; k < n; k++) {
      if (motif.arp === 'skip' && k % 3 === 2) continue;
      const t = motif.rate === 'trip' ? t0 + k * barSec / 12 : time(k * (16 / n));
      play(inst, t, seq[k % seq.length], barSec / n * 1.5, v * (k % 4 === 0 ? 1 : .8), to);
    }
  };
  const phrase = (inst, mode, motif, bar, deg, v, to, time, t0) => {
    if (mode === 'arp') return arp(inst, t0, deg, motif, v, to, baseOf(inst), time);
    for (const n of bar % 2 ? motif.bar2 : motif.bar1) play(inst, time(n.s), note(deg + n.d, baseOf(inst)), n.l * sixteenth * .95, v, to);
  };

  // ---- аранжировка
  const ib = rc.introBars, vb = rc.verseBars, hookStart = (ib + vb) * barSec;
  if (rc.intro === 'filtered') { sweep.frequency.setValueAtTime(300, 0); sweep.frequency.exponentialRampToValueAtTime(20000, ib * barSec); }
  if (rc.preHook === 'stop') { const t = hookStart - barSec / 4; gate.gain.setValueAtTime(1, t - .01); gate.gain.linearRampToValueAtTime(0, t); gate.gain.setValueAtTime(0, hookStart - .005); gate.gain.linearRampToValueAtTime(1, hookStart); }
  if (st.vinyl) for (let i = 0; i < end * 7; i++) hit(clickS, r() * end, .12 + r() * .15, post);
  const riser = (t, dur) => {
    const s = ctx.createBufferSource(), f = F('highpass', 500), g = G();
    s.buffer = nb; s.loop = true; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.2, t + dur);
    s.connect(f).connect(g).connect(post); s.start(t); s.stop(t + dur);
  };

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * barSec, sec = bar < ib ? 'intro' : bar < ib + vb ? 'verse' : 'hook';
    const inSec = sec === 'intro' ? bar : sec === 'verse' ? bar - ib : bar - ib - vb;
    const time = s => t0 + s * sixteenth + swingOf(s);
    const deg = chordOf(bar), hook = sec === 'hook';
    const lastVerse = bar === ib + vb - 1, brk = lastVerse && rc.preHook === 'break';
    const music = sec !== 'intro' || ['melody', 'filtered', 'build', 'cold'].includes(rc.intro);
    const drumsOn = !brk && (sec !== 'intro' || ['filtered', 'drums', 'build'].includes(rc.intro));
    const fullDrums = sec !== 'intro' || rc.intro === 'filtered';

    if (music && rc.chordInst !== 'none') {
      const v = hook ? 1 : sec === 'verse' ? .8 : .9, notes = voicing(deg), inst = rc.chordInst;
      if (rc.chordMode === 'pad') for (const m of notes) play(inst, t0, m, barSec * .97, v * .6, chords);
      else if (rc.chordMode === 'stab') for (const s of rc.chordStab) for (const m of notes) play(inst, time(s), m, sixteenth * 2.5, v * .6, chords);
      else arp(inst, t0, deg, rc.chordArp, v, chords, bassRoot + 24, time);
    }
    // в трэпе мелодия-луп играет весь бит, в бум-бэпе в куплете — через такт
    if (music && rc.leadInst && (sec !== 'verse' || st.half || bar % 2 === 0 || rc.chordInst === 'none'))
      phrase(rc.leadInst, rc.leadMode, rc.motif, bar, deg, hook ? 1.05 : sec === 'intro' ? .9 : .75, lead, time, t0);
    if (hook && rc.counter) phrase(rc.counter, rc.counterMotif.arp ? 'arp' : 'long', rc.counterMotif, bar, deg, .7, counterBus, time, t0);

    if (sec === 'intro' && bar === ib - 1 && rc.intro !== 'cold') riser(t0, barSec);
    if (lastVerse && rc.preHook !== 'stop') riser(t0, barSec);
    if (bar === ib || bar === ib + vb) hit(crashS, t0, .7, post);
    if (!drumsOn) continue;

    // бочка, малый + клэп, хэты, перкуссия
    const kp = rc.kicks[bar % 2];
    if (fullDrums || rc.intro === 'drums') kp.forEach((s, j) => { if (j === 0 || rc.bassPat !== 'bounce' || r() < .55) kick(time(s), j === 0 ? 1 : .85); });
    if (fullDrums) for (const s of rc.snares[bar % 2]) { hit(snareS, time(s), .9, drums); if (rc.clap) hit(clapS, time(s) + .004, 1.1, drums); }
    if (fullDrums && !st.half && r() < st.ghost) hit(snareS, time(pick([7, 15, 9])), .22, drums);
    if (rc.intro === 'build' && sec === 'intro' && bar === ib - 1) for (let s = 8; s < 16; s++) hit(snareS, time(s), .3 + (s - 8) * .08, drums);
    const hm = hook ? rc.hookHats : rc.hats;
    if (hm === '8ths') for (let s = 0; s < 16; s += 2) hat(time(s), s % 4 === 0 ? .9 : .65);
    else if (hm === '16ths') for (let s = 0; s < 16; s++) hat(time(s), s % 4 === 0 ? .9 : s % 2 ? .4 : .65);
    else if (hm === '16ths-skip') for (let s = 0; s < 16; s++) { if (s % 2 === 0 || r() < .4) hat(time(s), s % 4 === 0 ? .85 : .5); }
    else if (hm === 'shaker') for (let s = 0; s < 16; s++) hit(shakerS, time(s), s % 2 ? .45 : .8, hats);
    else if (hm === 'triplet') for (let k = 0; k < 12; k++) hat(t0 + k * barSec / 12, k % 3 === 0 ? .9 : .55);
    else if (hm === 'drill') for (let k = 0; k < 12; k++) { if (rc.drillHats.includes(k) || (hook && r() < .2)) hat(t0 + k * barSec / 12, k % 3 === 0 ? .9 : .6); }
    else { // трэп: восьмые, дубли 1/32 и роллы с подъёмом высоты
      const rolls = new Set([pick([6, 14]), ...(r() < .5 ? [pick([2, 10])] : [])]);
      for (let s = 0; s < 16; s += 2) {
        if (rolls.has(s)) {
          const c = pick([2, 3, 4, 4, 6]);
          for (let j = 0; j < c; j++) hat(time(s) + j * sixteenth * 2 / c, .45 + j * .08, c >= 4 ? 1 + j * .08 : 1);
          continue;
        }
        hat(time(s), s % 4 === 0 ? 1 : .7);
        if (r() < .12) hat(time(s + 1), .4);
      }
    }
    if (hook && r() < .7) hit(openS, time(pick([6, 14])), .55, hats);
    const pc = hook ? rc.hookPerc : rc.perc;
    if (fullDrums && pc === 'rim') for (const s of [6, 14].filter(() => r() < .6)) hit(rimS, time(s), .7, perc);
    if (fullDrums && pc === 'tamb') for (const s of [4, 12]) hit(tambS, time(s), .6, perc);
    if (fullDrums && pc === 'snap') for (const s of rc.snares[bar % 2]) hit(snapS, time(s) + .008, .7, perc);
    // сбивка в конце каждой четвёрки
    if (fullDrums && inSec % 4 === 3 && !lastVerse) {
      if (rc.fill === 'snare') for (let s = 12; s < 16; s++) hit(snareS, time(s), .3 + (s - 12) * .12, drums);
      else if (rc.fill === 'hat') for (let j = 0; j < 8; j++) hat(time(12) + j * sixteenth * 4 / 8, .5 + j * .06, 1 + j * .06);
      else if (rc.fill === 'kick') { kick(time(14), .8); kick(time(15), .7); }
    }

    // бас
    if (fullDrums || rc.intro === 'drums') {
      const bn = bassNote(deg), up = rc.bass === 'upright' ? 12 : 0;
      if (rc.bassPat === 'sustain') bassVoice(t0, bn + up, barSec * .95);
      else if (rc.bassPat === 'walk') {
        const nextRoot = bassNote(chordOf(bar + 1)) + up, walk = [bn + up, note(deg + 2, bassRoot) + up, note(deg + 4, bassRoot) + up, nextRoot + (r() < .5 ? 1 : -1)];
        walk.forEach((m, k) => bassVoice(time(k * 4), m, sixteenth * 3.6));
      } else if (rc.bassPat === 'bounce') kp.forEach((s, j) => { // короткие прыгающие ноты с подъездами
        const next = kp[j + 1] ?? 16, m = bn + (j && r() < .25 ? 12 : j && r() < .15 ? pick([7, 10, 3]) : 0);
        bassVoice(time(s), m, Math.min(st.loud ? .26 : .36, Math.max(.1, (next - s) * sixteenth * .9)), null, j === 0 ? 1 : .9, j > 0 && r() < .4);
      });
      else kp.forEach((s, j) => {
        const next = kp[j + 1] ?? 16, last = j === kp.length - 1, slide = rc.bassPat === 'slide';
        const m = bn + up + (slide && j && r() < .3 ? 12 : 0);
        const glide = (slide && r() < .6) || (last && r() < .25) ? (last ? bassNote(chordOf(bar + 1)) + up : bn + up + pick([0, 12, -5])) : null;
        bassVoice(time(s), m, Math.max(.16, (next - s) * sixteenth * .95 + (last ? sixteenth * 2 : 0)), glide);
      });
    }
  }
  // качание музыки от бочки (сайдчейн)
  if (st.duck) for (const t of kicks) { duck.gain.setValueAtTime(1, Math.max(0, t - .005)); duck.gain.linearRampToValueAtTime(.5, t + .01); duck.gain.setTargetAtTime(1, t + .03, .09); }
  sum.gain.setValueAtTime(1, end); sum.gain.linearRampToValueAtTime(0, end + barSec / 2);

  // ---- сэмплы: грузим всё нужное разом и расставляем ноты
  const keyOf = n => n.inst + ':' + n.m;
  const want = new Map(pending.map(n => [keyOf(n), n]));
  const bufs = new Map(await Promise.all([...want].map(async ([k, n]) => [k, await loadNote(n.inst, n.m)])));
  for (const n of pending) {
    const b = bufs.get(keyOf(n)), spec = SAMPLED[n.inst];
    if (!b) { (spec.ring ? synthPluck : synthPad)(n.t, n.m, n.dur, n.v, n.to); continue; }
    const s = ctx.createBufferSource(), g = G(), amp = 3.5 * (spec.vol ?? 1) * n.v;
    const len = Math.min(b.duration, spec.ring ? Math.max(n.dur, .3) + 1.4 : n.dur + .25), rel = spec.ring ? .5 : .2;
    s.buffer = b;
    g.gain.setValueAtTime(amp, n.t); g.gain.setValueAtTime(amp, n.t + Math.max(.01, len - rel)); g.gain.linearRampToValueAtTime(0, n.t + len);
    s.connect(g).connect(n.to); s.start(n.t); s.stop(n.t + len + .02);
  }

  const buf = await ctx.startRendering();
  // мастеринг: выравниваем по средней громкости и мягко срезаем пики — плотно и громко, как в рэпе
  let sq = 0;
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) sq += d[i] * d[i]; }
  const rms = Math.sqrt(sq / (2 * buf.length)) || 1, k = st.loud ? 3.2 : 2.1, pre = .21 / rms, outGain = .95 / Math.tanh(k);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = outGain * Math.tanh(k * d[i] * pre); }
  return buf;
}

// 16-битный WAV из AudioBuffer — чтобы скачать бит или готовый трек.
export function toWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, view = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); view.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true); view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * ch * 2, true); view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) {
    const v = Math.max(-1, Math.min(1, chans[c][i]));
    view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}
