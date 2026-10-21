// Рэп-биты из формул. Бит целиком задаётся сидом и стилем: у всех игроков он рендерится
// одинаково, по сети передаём только два значения. Из сида выбирается «рецепт»: инструменты,
// барабаны, бас, мелодия, вход и переход в припев — поэтому биты не похожи друг на друга.
const SR = 44100;

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
};
const PROGS = { // ступени лада, по аккорду на такт
  minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 5, 3, 4], [0, 6, 5, 6], [0, 3, 5, 4], [0, 2, 5, 6], [0, 5, 6, 4], [0, 0, 5, 5]],
  dorian: [[0, 3, 0, 3], [0, 3, 4, 3], [0, 6, 3, 0], [0, 4, 3, 3], [0, 0, 3, 3]],
  phrygian: [[0, 1, 0, 1], [0, 1, 6, 1], [0, 5, 1, 0], [0, 0, 1, 1]],
  harmonic: [[0, 5, 4, 4], [0, 3, 4, 0], [0, 5, 3, 4], [0, 0, 4, 4], [0, 5, 0, 4]],
};
const LABEL = {
  piano: 'пианино', epiano: 'родес', bell: 'колокольчики', strings: 'струнные', choir: 'хор', brass: 'духовые',
  flute: 'флейта', whine: 'свист', supersaw: 'суперсо', organ: 'орган', pluck: 'щипок', cowbell: 'ковбелл', clav: 'клавинет',
  guitar: 'гитара', '808': '808', sub: 'саб-бас', upright: 'контрабас', moog: 'синт-бас',
};
export const STYLES = {
  boombap: {
    label: 'Бум-бэп', bpm: [84, 96], swing: [.1, .2], scales: ['minor', 'dorian'], intro: ['melody', 'drums', 'filtered', 'cold'],
    kicks: [[0, 10], [0, 7, 10], [0, 6, 10], [0, 9, 10], [0, 3, 10], [0, 7, 9]], snares: [[4, 12]], ghost: .45,
    hats: ['8ths', '16ths-skip', 'shaker'], perc: ['rim', 'tamb', 'none'], bass: ['sub', 'upright'], bassPat: ['kick'],
    chords: [['piano', 'stab'], ['epiano', 'stab'], ['piano', 'pad'], ['strings', 'pad'], ['organ', 'stab'], ['guitar', 'stab']],
    lead: [['brass', 'call'], ['piano', 'motif'], ['bell', 'motif'], ['flute', 'call'], [null]], seventh: .6, sat: 1.6, verb: .25,
  },
  oldschool: {
    label: 'Олдскул', bpm: [94, 104], swing: [0, .08], scales: ['dorian', 'minor'], intro: ['drums', 'cold', 'melody'],
    kicks: [[0, 6, 8], [0, 7, 10], [0, 3, 6, 10], [0, 10, 11]], snares: [[4, 12]], clap: 1, ghost: .2,
    hats: ['16ths', 'off'], perc: ['tamb', 'conga', 'none'], bass: ['moog'], bassPat: ['funk'],
    chords: [['clav', 'stab'], ['brass', 'stab'], ['organ', 'stab']], lead: [['brass', 'call'], ['clav', 'riff'], ['whine', 'motif']],
    seventh: .7, sat: 1.2, verb: .18,
  },
  gfunk: {
    label: 'Джи-фанк', bpm: [86, 96], swing: [.05, .14], scales: ['dorian', 'minor'], intro: ['melody', 'filtered'],
    kicks: [[0, 10], [0, 3, 10], [0, 7, 10]], snares: [[4, 12]], clap: 1, ghost: .15,
    hats: ['16ths', '16ths-skip'], perc: ['tamb', 'none'], bass: ['moog'], bassPat: ['funk', 'kick'],
    chords: [['strings', 'pad'], ['epiano', 'pad'], ['organ', 'pad']], lead: [['whine', 'motif'], ['whine', 'long']],
    seventh: .8, sat: 1.1, verb: .3,
  },
  dark: {
    label: 'Хардкор', bpm: [84, 94], swing: [.05, .15], scales: ['phrygian', 'harmonic'], intro: ['melody', 'cold', 'drums'],
    kicks: [[0, 10], [0, 7, 10], [0, 9, 10]], snares: [[4, 12]], ghost: .3,
    hats: ['8ths', '16ths-skip'], perc: ['rim', 'none'], bass: ['sub', '808'], bassPat: ['kick', 'sustain'],
    chords: [['strings', 'pad'], ['choir', 'pad'], ['none', 'none']], lead: [['piano', 'motif'], ['bell', 'call'], ['piano', 'long']],
    seventh: .2, sat: 2, verb: .32,
  },
  jazz: {
    label: 'Джаз-рэп', bpm: [80, 90], swing: [.15, .24], scales: ['dorian'], intro: ['melody', 'cold'],
    kicks: [[0, 10], [0, 7, 10], [0, 6, 9]], snares: [[4, 12]], ghost: .5,
    hats: ['8ths', 'shaker'], perc: ['rim', 'none'], bass: ['upright'], bassPat: ['walk', 'kick'],
    chords: [['epiano', 'stab'], ['epiano', 'pad'], ['piano', 'stab'], ['guitar', 'stab']], lead: [['flute', 'call'], ['bell', 'motif'], [null]],
    seventh: 1, vinyl: 1, lofi: 1, sat: 1.3, verb: .35,
  },
  trap: {
    label: 'Трэп', bpm: [132, 150], half: 1, scales: ['minor', 'harmonic'], intro: ['melody', 'filtered', 'build', 'drums'],
    kicks: [[0, 10], [0, 7, 10], [0, 3, 10], [0, 6, 11], [0, 10, 13], [0, 11]], snares: [[8]], clap: .7,
    hats: ['trap', '16ths', 'triplet'], perc: ['snap', 'rim', 'none'], bass: ['808'], bassPat: ['kick', 'slide'],
    chords: [['strings', 'pad'], ['choir', 'pad'], ['pluck', 'arp'], ['none', 'none']],
    lead: [['bell', 'motif'], ['flute', 'motif'], ['piano', 'motif'], ['pluck', 'arp'], ['bell', 'arp'], ['guitar', 'motif']],
    seventh: .2, verb: .22, duck: 1, bassGain: .8,
  },
  drill: {
    label: 'Дрилл', bpm: [138, 146], half: 1, scales: ['harmonic', 'phrygian', 'minor'], intro: ['melody', 'build', 'filtered'],
    kicks: [[0, 10], [0, 11], [0, 3, 10], [0, 7]], snares: [[8], [8, 11], [8, 14], [3, 8]],
    hats: ['triplet', 'drill'], perc: ['rim', 'none'], bass: ['808'], bassPat: ['slide'],
    chords: [['choir', 'pad'], ['strings', 'pad'], ['none', 'none']], lead: [['piano', 'motif'], ['strings', 'long'], ['bell', 'call'], ['flute', 'motif']],
    seventh: 0, verb: .28, duck: 1, bassGain: .75,
  },
  phonk: {
    label: 'Фонк', bpm: [128, 140], half: 1, swing: [0, .05], scales: ['phrygian', 'minor'], intro: ['melody', 'cold', 'filtered'],
    kicks: [[0, 3, 6, 10], [0, 7, 10, 13], [0, 6, 10]], snares: [[8]], clap: 1,
    hats: ['8ths', '16ths'], perc: ['none'], bass: ['808'], bassPat: ['kick'],
    chords: [['none', 'none'], ['choir', 'pad']], lead: [['cowbell', 'riff'], ['cowbell', 'motif']], seventh: 0, sat: 1.5, verb: .18, duck: 1, bassGain: .55,
  },
  rage: {
    label: 'Рейдж', bpm: [150, 165], half: 1, scales: ['minor', 'harmonic'], intro: ['melody', 'build'],
    kicks: [[0, 10], [0, 6, 10], [0, 3, 10], [0, 7, 10]], snares: [[8]], clap: 1,
    hats: ['16ths', 'trap'], perc: ['none', 'snap'], bass: ['808'], bassPat: ['kick'],
    chords: [['supersaw', 'stab'], ['none', 'none']], lead: [['supersaw', 'riff'], ['supersaw', 'motif']], seventh: 0, sat: 1.3, verb: .2, duck: 1, bassGain: .6,
  },
};
const NAMES = ['Холодный подъезд', 'Ночная маршрутка', 'Ржавая девятка', 'Бетонный рассвет', 'Последняя электричка', 'Спальный район',
  'Гаражный кооператив', 'Дым над ТЭЦ', 'Пятничная шаурма', 'Двор без фонарей', 'Сломанный домофон', 'Зимний гараж', 'Тёплый асфальт',
  'Девятый этаж', 'Неон над ларьком', 'Пустая остановка', 'Мокрый кроссовок', 'Шумные соседи', 'Кассета в бардачке', 'Звонок в три ночи',
  'Лифт не работает', 'Северный ветер', 'Дача в октябре', 'Сигнал с района', 'Чёрная Приора', 'Магнитола деда', 'Дождь на крыше',
  'Полночный перрон', 'Последний урок', 'Старый плеер', 'Кеды на проводах', 'Подвальная студия', 'Автобус на конечную', 'Ржавые качели',
  'Голуби на крыше', 'Батя на гараже', 'Сдача без чека', 'Холодный чай', 'Микрофон за сотку', 'Район спит', 'Синий троллейбус',
  'Пустой стадион', 'Курилка за школой', 'Бит из подвала', 'Тонированная пятёрка', 'Мартовский лёд', 'Свет в окне напротив', 'Три аккорда',
  'Фары в тумане', 'Блок на окраине'];
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MOTIFS = ['x..x..x...x.x...', 'x..x..x.x..x.x..', 'x...x..x..x.x...', 'x.x...x.x...x.x.', 'x..x..x.........', 'x...x...x..x..x.',
  '..x..x..x..x.x..', 'x.xx..x..x.x....', 'x......x..x.x...', 'x..x...xx.x.....', 'x.x.x...x.x.x...', 'x...x.x...x.x...'];
const RIFFS = ['x.x.xx.x.x.xx.x.', 'x..xx..xx..xx.x.', 'xxx.x.x.xxx.x.x.', 'x.x.x.x.x.x.x.x.', 'x..x.xx..x.xx.x.'];
const STABS = ['x.....x...x.....', 'x..x..x.........', 'x.......x.......', 'x...x...x...x...', '..x...x...x...x.', 'x..x....x..x....'];
const FUNK = ['x..x..x.x.x..x..', 'x.x..x..x..x.x..', 'x..x.x....x.x...'];
const DRILL_HATS = ['x.xx.xx.xxx.', 'x.x.xx.x.xx.', 'xx.x.xx.x.x.'];

export function rng(seed) { // mulberry32
  let a = seed >>> 0;
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
  const style = STYLES[styleKey] ? styleKey : pick(Object.keys(STYLES));
  const st = STYLES[style];
  const bpm = Math.round(between(st.bpm)), barSec = 240 / bpm;
  const key = Math.floor(r() * 12), scaleName = pick(st.scales), prog = pick(PROGS[scaleName]), name = pick(NAMES);
  const intro = pick(st.intro);
  const introBars = intro === 'cold' ? 1 : st.half ? pick([2, 4]) : 2;
  const verseBars = st.half ? 8 : 4, hookBars = st.half ? 8 : 4;
  let [chordInst, chordMode] = pick(st.chords), [leadInst, leadMode] = pick(st.lead);
  if (chordInst === 'none' && !leadInst) [leadInst, leadMode] = st.lead[0];
  const counterPool = st.lead.filter(l => l[0] && l[0] !== leadInst);
  const counter = counterPool.length && chance(.65) ? pick(counterPool)[0] : null;
  const bass = pick(st.bass);
  const kit = {
    kick: { f0: 120 + r() * 80, f1: 40 + r() * 16, decay: (st.half ? .22 : .3) + r() * .3, click: .1 + r() * .4, drive: r() * (st.sat || 1) },
    snare: { freq: 1400 + r() * 1300, decay: .12 + r() * .16, tone: 160 + r() * 90, toneAmt: .2 + r() * .45 },
    hat: { freq: 6500 + r() * 3500, decay: .025 + r() * .045 },
  };
  const rc = {
    seed, style, st, bpm, barSec, key, scale: SCALES[scaleName], prog, name, intro, introBars, verseBars, hookBars,
    preHook: pick(['none', 'none', 'break', 'stop']), kit, clap: chance(st.clap || 0),
    kicks: [pick(st.kicks), pick(st.kicks)], snares: [pick(st.snares), pick(st.snares)],
    hats: pick(st.hats), perc: pick(st.perc), bass, bassPat: pick(st.bassPat),
    chordInst, chordMode, chordStab: steps(pick(STABS)), leadInst, leadMode, counter,
    motif: makeMotif(r, pick, leadMode), chordArp: makeMotif(r, pick, 'arp'), counterMotif: makeMotif(r, pick, pick(['long', 'arp'])),
    funk: steps(pick(FUNK)), drillHats: steps(pick(DRILL_HATS)), fill: pick(['snare', 'hat', 'kick', 'none']),
    seventh: chance(st.seventh), swing: between(st.swing), verb: st.verb * (.7 + r() * .6), delay: chance(.45),
  };
  rc.hookHats = chance(.5) ? pick(st.hats) : rc.hats;
  rc.hookPerc = rc.perc === 'none' && chance(.5) ? pick(st.perc) : rc.perc;
  rc.tags = [...new Set([LABEL[bass], LABEL[chordInst], LABEL[leadInst], LABEL[counter]].filter(Boolean))];
  return rc;
}

// Паспорт бита: темп, тональность, инструменты, части (интро / куплет / припев) с таймингами.
export function describe(seed, style) {
  const rc = recipe(seed, style), { barSec, introBars: ib, verseBars: vb, hookBars: hb } = rc, bars = ib + vb + hb;
  return {
    seed, style: rc.style, label: rc.st.label, bpm: rc.bpm, key: rc.key, keyName: KEYS[rc.key] + 'm', name: rc.name, tags: rc.tags, barSec, bars,
    sections: [
      { name: 'Интро', from: 0, to: ib * barSec },
      { name: 'Куплет', from: ib * barSec, to: (ib + vb) * barSec },
      { name: 'Припев', from: (ib + vb) * barSec, to: bars * barSec },
    ],
    duration: bars * barSec + barSec / 2,
  };
}

export async function renderBeat(info) {
  const rc = recipe(info.seed, info.style), { st, barSec, kit } = rc;
  const r = rng(info.seed * 7919 + 13), pick = a => a[Math.floor(r() * a.length)];
  const bars = rc.introBars + rc.verseBars + rc.hookBars, end = bars * barSec;
  const ctx = new OfflineAudioContext(2, Math.ceil((end + barSec / 2 + 1.5) * SR), SR);
  const G = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const F = (type, freq, q = .7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
  const O = (type, freq, t, stop, to) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.connect(to); o.start(t); o.stop(stop); return o; };
  const shaper = k => { const s = ctx.createWaveShaper(), c = new Float32Array(1024); for (let i = 0; i < 1024; i++) c[i] = Math.tanh(k * (i / 512 - 1)) / Math.tanh(k); s.curve = c; return s; };
  const env = (g, t, a, peak, hold, rel) => {
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (hold > 0) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + Math.max(0, hold) + rel);
  };

  // ---- микшер: группы → затвор (стоп перед припевом) → фильтр-проход → тёплый перегруз → компрессор
  const sum = G(), gate = G(), sweep = F('lowpass', 20000), post = G(), comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
  sum.connect(gate).connect(sweep).connect(post);
  let tail = post;
  if (st.sat) { const s = shaper(st.sat); tail.connect(s); tail = s; }
  tail.connect(comp);
  let out = comp;
  if (st.lofi) { const lp = F('lowpass', 3800); comp.connect(lp); out = lp; }
  out.connect(ctx.destination);
  // ревер из сгенерированного импульса
  const irLen = Math.floor(SR * 2.3), ir = new AudioBuffer({ numberOfChannels: 2, length: irLen, sampleRate: SR });
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irLen; i++) d[i] = (r() * 2 - 1) * (1 - i / irLen) ** 3.5; }
  const verb = ctx.createConvolver(); verb.buffer = ir; verb.connect(G(rc.verb)).connect(sum);
  const duck = G(), lift = G(); duck.connect(lift).connect(sum); // duck: музыка «качается» от бочки в трэпе
  if (!['filtered', 'drums'].includes(rc.intro)) { // интро без барабанов иначе слишком тихое на фоне дропа
    const up = rc.chordInst === 'none' ? 4 : 2.5; // одна мелодия без аккордов звучит совсем тонко
    lift.gain.setValueAtTime(up, 0); lift.gain.setValueAtTime(up, Math.max(0, rc.introBars * barSec - .3)); lift.gain.linearRampToValueAtTime(1, rc.introBars * barSec);
  }
  const bus = (v, pan, send, to = sum) => { const g = G(v), p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p).connect(to); if (send) p.connect(G(send)).connect(verb); return g; };
  const drums = bus(1, 0, .06), hats = bus(.3, -.2, .05), perc = bus(.4, .25, .15), bass = bus(st.bassGain ?? .95, 0, 0);
  const chords = bus(.5, 0, .3, duck), lead = bus(.42, .15, .32, duck), counterBus = bus(.3, -.25, .35, duck);
  if (rc.delay) { // эхо на мелодии: точечная восьмая
    const dl = ctx.createDelay(1), fb = G(.32), lp = F('lowpass', 2600);
    dl.delayTime.value = barSec * 3 / 16; lead.connect(dl).connect(lp).connect(fb).connect(dl); lp.connect(G(.22)).connect(sum);
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
  const K = kit.kick, S = kit.snare, H = kit.hat;
  const [kickS, snareS, clapS, hatS, hatS2, openS, rimS, tambS, congaS, snapS, shakerS, crashS, clickS] = await Promise.all([
    shot(K.decay + .1, (c, to) => {
      let dest = to;
      if (K.drive > .3) { const s = c.createWaveShaper(), cv = new Float32Array(512), k = 1 + K.drive * 2; for (let i = 0; i < 512; i++) cv[i] = Math.tanh(k * (i / 256 - 1)) / Math.tanh(k); s.curve = cv; s.connect(to); dest = s; }
      tone(c, dest, 0, { f0: K.f0, f1: K.f1, decay: K.decay, vel: 1, bend: .11 });
      noise(c, dest, 0, { freq: 2500, vel: K.click, decay: .012 });
    }),
    shot(S.decay + .1, (c, to) => {
      noise(c, to, 0, { type: 'bandpass', freq: S.freq, q: .8, vel: .9, decay: S.decay });
      tone(c, to, 0, { type: 'triangle', f0: S.tone, f1: S.tone * .7, decay: .12, vel: S.toneAmt, bend: .08 });
    }),
    shot(.26, (c, to) => {
      for (let k = 0; k < 3; k++) noise(c, to, k * .011, { type: 'bandpass', freq: 1300, q: 1.2, vel: .6, decay: .03 });
      noise(c, to, .033, { type: 'bandpass', freq: 1200, q: .9, vel: .5, decay: .18 });
    }),
    shot(H.decay + .03, (c, to) => noise(c, to, 0, { freq: H.freq, vel: .55, decay: H.decay })),
    shot(H.decay + .03, (c, to) => noise(c, to, 0, { freq: H.freq * 1.15, vel: .5, decay: H.decay * .8 })),
    shot(.34, (c, to) => noise(c, to, 0, { freq: H.freq * .8, vel: .5, decay: .3 })),
    shot(.08, (c, to) => { tone(c, to, 0, { type: 'square', f0: 1700, f1: 1600, decay: .03, vel: .25 }); noise(c, to, 0, { type: 'bandpass', freq: 3000, q: 2, vel: .6, decay: .04 }); }),
    shot(.2, (c, to) => { for (let k = 0; k < 3; k++) noise(c, to, k * .008, { type: 'bandpass', freq: 9000, q: 3, vel: .5, decay: .12 }); }),
    shot(.3, (c, to) => tone(c, to, 0, { f0: 260, f1: 210, decay: .25, vel: .8, bend: .05 })),
    shot(.12, (c, to) => { noise(c, to, 0, { type: 'highpass', freq: 2000, vel: .9, decay: .05 }); noise(c, to, .006, { type: 'bandpass', freq: 3500, q: 3, vel: .5, decay: .06 }); }),
    shot(.12, (c, to) => noise(c, to, 0, { type: 'bandpass', freq: 6000, q: 1.5, vel: .5, decay: .09 })),
    shot(1.6, (c, to) => noise(c, to, 0, { freq: 5000, vel: .45, decay: 1.5 })),
    shot(.01, (c, to) => noise(c, to, 0, { freq: 3000, vel: 1, decay: .004 })),
  ]);
  const hit = (b, t, vel, to) => { const s = ctx.createBufferSource(), g = G(vel); s.buffer = b; s.connect(g).connect(to); s.start(t); };
  const kicks = [];
  const kick = (t, vel = 1) => { hit(kickS, t, vel, drums); kicks.push(t); };
  const hat = (t, vel = 1) => hit(r() < .5 ? hatS : hatS2, t, vel, hats);

  // ---- инструменты: (время, нота, длительность, сила, шина)
  const I = {
    piano(t, m, dur, v, to) {
      const f = mtof(m), g = G(), lp = F('lowpass', 2200 + v * 2500), rel = Math.min(2.4, .5 + dur * 1.6);
      env(g, t, .004, .3 * v, 0, rel); lp.connect(g).connect(to);
      for (const [k, a] of [[1, 1], [2, .45], [3, .2]]) { const amp = G(a); amp.connect(lp); O('sine', f * k, t, t + rel + .05, amp).detune.value = (r() - .5) * 6; }
    },
    epiano(t, m, dur, v, to) {
      const f = mtof(m), g = G(), mod = G(f * 2);
      env(g, t, .003, .28 * v, dur * .4, 1.2); g.connect(to);
      mod.gain.setValueAtTime(f * 2, t); mod.gain.exponentialRampToValueAtTime(f * .2, t + .5);
      const car = O('sine', f, t, t + dur + 1.4, g); O('sine', f, t, t + dur + 1.4, mod); mod.connect(car.frequency);
    },
    bell(t, m, dur, v, to) {
      const f = mtof(m), g = G(), mod = G(f * 3);
      env(g, t, .002, .22 * v, 0, 1.6); g.connect(to);
      mod.gain.setValueAtTime(f * 3, t); mod.gain.exponentialRampToValueAtTime(f * .3, t + 1);
      const car = O('sine', f, t, t + 1.8, g); O('sine', f * 3.5, t, t + 1.8, mod); mod.connect(car.frequency);
    },
    strings(t, m, dur, v, to) {
      const f = mtof(m), g = G(), lp = F('lowpass', 2000), lfo = G(5);
      env(g, t, .3, .1 * v, Math.max(0, dur - .3), .5); lp.connect(g).connect(to);
      O('sine', 5, t, t + dur + .9, lfo);
      for (const det of [-10, 0, 10]) { const o = O('sawtooth', f, t, t + dur + .9, lp); o.detune.value = det; lfo.connect(o.detune); }
    },
    choir(t, m, dur, v, to) {
      const f = mtof(m), g = G(), f1 = F('bandpass', 700, 5), f2 = F('bandpass', 1150, 6);
      env(g, t, .45, .22 * v, Math.max(0, dur - .45), .6); f1.connect(g); f2.connect(g); g.connect(to);
      for (const det of [-8, 8]) { const o = O('sawtooth', f, t, t + dur + 1.1, f1); o.detune.value = det; o.connect(f2); }
    },
    brass(t, m, dur, v, to) {
      const f = mtof(m), g = G(), lp = F('lowpass', 300, 2);
      lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2800, t + .05); lp.frequency.exponentialRampToValueAtTime(900, t + .3);
      env(g, t, .02, .14 * v, Math.max(0, dur - .1), .12); lp.connect(g).connect(to);
      for (const det of [-6, 6]) O('sawtooth', f, t, t + dur + .2, lp).detune.value = det;
    },
    flute(t, m, dur, v, to) {
      const f = mtof(m), g = G(), lfo = G(8);
      env(g, t, .05, .24 * v, Math.max(0, dur - .05), .12); g.connect(to);
      const o = O('sine', f, t, t + dur + .2, g); O('sine', 5.5, t, t + dur + .2, lfo); lfo.connect(o.detune);
      const tri = G(.15); tri.connect(g); O('triangle', f * 2, t, t + dur + .2, tri);
      const s = ctx.createBufferSource(), bp = F('bandpass', f * 2, 2), ng = G(); s.buffer = nb; s.loop = true;
      env(ng, t, .03, .05 * v, Math.max(0, dur - .05), .1); s.connect(bp).connect(ng).connect(to); s.start(t); s.stop(t + dur + .2);
    },
    whine(t, m, dur, v, to, prev) { // джи-фанк свист: подъезжает к ноте от предыдущей
      const g = G(), lfo = G(14), lp = F('lowpass', 3000);
      env(g, t, .03, .2 * v, Math.max(0, dur - .03), .15); lp.connect(g).connect(to);
      const o = O('sine', mtof(prev ?? m), t, t + dur + .2, lp); o.frequency.setTargetAtTime(mtof(m), t, .03);
      O('sine', 6, t, t + dur + .2, lfo); lfo.connect(o.detune);
      const tri = G(.3); tri.connect(lp); const o2 = O('triangle', mtof(prev ?? m), t, t + dur + .2, tri); o2.frequency.setTargetAtTime(mtof(m), t, .03);
    },
    supersaw(t, m, dur, v, to) {
      const f = mtof(m), g = G(), hp = F('highpass', 200), lp = F('lowpass', 6000);
      env(g, t, .005, .09 * v, Math.max(0, dur * .7), .12); hp.connect(lp).connect(g).connect(to);
      for (const det of [-22, -8, 8, 22]) O('sawtooth', f, t, t + dur + .2, hp).detune.value = det;
    },
    organ(t, m, dur, v, to) {
      const f = mtof(m), g = G();
      env(g, t, .01, .12 * v, Math.max(0, dur - .02), .08); g.connect(to);
      for (const [k, a] of [[1, 1], [2, .55], [3, .3], [4, .15]]) { const amp = G(a); amp.connect(g); O('sine', f * k, t, t + dur + .15, amp); }
    },
    pluck(t, m, dur, v, to) {
      const f = mtof(m), g = G(), lp = F('lowpass', 4000);
      lp.frequency.setValueAtTime(4500, t); lp.frequency.exponentialRampToValueAtTime(300, t + .3);
      env(g, t, .003, .25 * v, 0, .45); lp.connect(g).connect(to);
      O('sawtooth', f, t, t + .55, lp);
    },
    guitar(t, m, dur, v, to) {
      const f = mtof(m), g = G(), lp = F('lowpass', 2400);
      lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(900, t + .4);
      env(g, t, .003, .26 * v, 0, .9); lp.connect(g).connect(to);
      O('triangle', f, t, t + 1, lp); const s = G(.25); s.connect(lp); O('sawtooth', f, t, t + 1, s).detune.value = 4;
    },
    clav(t, m, dur, v, to) {
      const f = mtof(m), g = G(), bp = F('bandpass', f * 3, 4);
      env(g, t, .002, .5 * v, 0, .18); bp.connect(g).connect(to);
      O('square', f, t, t + .25, bp);
    },
    cowbell(t, m, dur, v, to) {
      const f = mtof(m), g = G(), bp = F('bandpass', f * 2, 3);
      env(g, t, .002, .55 * v, 0, .28); bp.connect(g).connect(to);
      O('square', f, t, t + .3, bp); O('square', f * 1.48, t, t + .3, bp);
    },
  };
  const bassOut = (() => { const s = shaper(st.half ? 2.5 : 1.5), lp = F('lowpass', st.half ? 1000 : 700); s.connect(lp).connect(bass); return s; })();
  let lastBass = null;
  const bassVoice = (t, midi, dur, glideTo, v = 1) => {
    const g = G();
    if (rc.bass === '808' || rc.bass === 'sub') {
      const o = O('sine', mtof(midi), t, t + dur + .06, g);
      if (glideTo != null) o.frequency.setTargetAtTime(mtof(glideTo), t + dur * .7, .04);
      env(g, t, .006, .9 * v, rc.bass === 'sub' ? Math.min(dur * .5, .15) : Math.min(dur * .6, .3), rc.bass === 'sub' ? Math.min(dur, .35) : Math.max(.08, dur * .45));
    } else if (rc.bass === 'upright') {
      const lp = F('lowpass', 750); lp.connect(g);
      const o = O('triangle', mtof(midi) * 1.03, t, t + dur + .1, lp); o.frequency.setTargetAtTime(mtof(midi), t, .02);
      const s = G(.6); s.connect(g); O('sine', mtof(midi), t, t + dur + .1, s);
      env(g, t, .01, .9 * v, 0, Math.min(.6, dur + .1));
    } else { // moog: подъезд от прошлой ноты, резонансный фильтр
      const lp = F('lowpass', 250, 6); lp.connect(g);
      lp.frequency.setValueAtTime(250, t); lp.frequency.exponentialRampToValueAtTime(1500, t + .02); lp.frequency.exponentialRampToValueAtTime(450, t + .25);
      const o = O('sawtooth', mtof(lastBass ?? midi), t, t + dur + .08, lp); o.frequency.setTargetAtTime(mtof(midi), t, .025);
      env(g, t, .005, .55 * v, Math.max(0, dur - .05), .06);
      lastBass = midi;
    }
    g.connect(bassOut);
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
  // регистр мелодии — от тоники бита, чтобы мелодия всегда была в тональности аккордов
  const OCT = { bell: 36, flute: 36, whine: 36, pluck: 36, piano: 36, strings: 36, cowbell: 36, guitar: 24, brass: 24, clav: 24, supersaw: 24, epiano: 24, organ: 24, choir: 24 };
  const leadBase = inst => bassRoot + OCT[inst];
  const sixteenth = barSec / 16, swingOf = s => (s % 2 ? rc.swing * sixteenth : 0);
  const arp = (inst, t0, deg, motif, v, to, base, time) => {
    const tones = [0, 2, 4, 7].map(d => note(deg + d, base));
    const seq = motif.arp === 'down' ? [...tones].reverse() : motif.arp === 'updown' ? [...tones, tones[2], tones[1]] : tones;
    const n = motif.rate === 'trip' ? 12 : motif.rate === 1 ? 16 : 8;
    for (let k = 0; k < n; k++) {
      if (motif.arp === 'skip' && k % 3 === 2) continue;
      const t = motif.rate === 'trip' ? t0 + k * barSec / 12 : time(k * (16 / n));
      I[inst](t, seq[k % seq.length], barSec / n * 1.5, v * (k % 4 === 0 ? 1 : .8), to);
    }
  };
  const playPhrase = (inst, mode, motif, bar, deg, v, to, base, time, t0) => {
    if (mode === 'arp') return arp(inst, t0, deg, motif, v, to, base, time);
    let prev = null;
    for (const n of bar % 2 ? motif.bar2 : motif.bar1) {
      const m = note(deg + n.d, base);
      I[inst](time(n.s), m, n.l * sixteenth * .95, v, to, prev);
      prev = m;
    }
  };

  // ---- аранжировка
  const ib = rc.introBars, vb = rc.verseBars, hookStart = (ib + vb) * barSec;
  if (rc.intro === 'filtered') { sweep.frequency.setValueAtTime(300, 0); sweep.frequency.exponentialRampToValueAtTime(20000, ib * barSec); }
  if (rc.preHook === 'stop') { const t = hookStart - barSec / 4; gate.gain.setValueAtTime(1, t - .01); gate.gain.linearRampToValueAtTime(0, t); gate.gain.setValueAtTime(0, hookStart - .005); gate.gain.linearRampToValueAtTime(1, hookStart); }
  if (st.vinyl) for (let i = 0; i < end * 7; i++) hit(clickS, r() * end, .12 + r() * .15, post);
  const riser = (t, dur) => {
    const s = ctx.createBufferSource(), f = F('highpass', 500), g = G();
    s.buffer = nb; s.loop = true; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.22, t + dur);
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
      if (rc.chordMode === 'pad') for (const m of notes) I[inst](t0, m, barSec * .97, v, chords);
      else if (rc.chordMode === 'stab') for (const s of rc.chordStab) for (const m of notes) I[inst](time(s), m, sixteenth * 2.5, v, chords);
      else arp(inst, t0, deg, rc.chordArp, v, chords, bassRoot + 36, time);
    }
    if (music && rc.leadInst) {
      const v = hook ? 1.1 : sec === 'intro' ? .9 : .55;
      if (sec !== 'verse' || st.half || bar % 2 === 0 || rc.chordInst === 'none')
        playPhrase(rc.leadInst, rc.leadMode, rc.motif, bar, deg, v, lead, leadBase(rc.leadInst), time, t0);
    }
    if (hook && rc.counter) playPhrase(rc.counter, rc.counterMotif.arp ? 'arp' : 'long', rc.counterMotif, bar, deg, .7, counterBus, leadBase(rc.counter), time, t0);

    if (sec === 'intro' && bar === ib - 1 && rc.intro !== 'cold') riser(t0, barSec);
    if (lastVerse && rc.preHook !== 'stop') riser(t0, barSec);
    if (bar === ib || bar === ib + vb) hit(crashS, t0, .75, post);
    if (!drumsOn) continue;

    // бочка, малый, хэты, перкуссия
    const kp = rc.kicks[bar % 2];
    if (fullDrums || rc.intro === 'drums') for (const s of kp) kick(time(s), s === 0 ? 1 : .85);
    if (fullDrums) for (const s of rc.snares[bar % 2]) { hit(snareS, time(s), 1, drums); if (rc.clap) hit(clapS, time(s), .75, drums); }
    if (fullDrums && !st.half && r() < st.ghost) hit(snareS, time(pick([7, 15, 9])), .22, drums);
    if (rc.intro === 'build' && sec === 'intro' && bar === ib - 1) for (let s = 8; s < 16; s++) hit(snareS, time(s), .3 + (s - 8) * .08, drums);
    const hm = hook ? rc.hookHats : rc.hats;
    if (hm === '8ths') for (let s = 0; s < 16; s += 2) hat(time(s), s % 4 === 0 ? .9 : .65);
    else if (hm === '16ths') for (let s = 0; s < 16; s++) hat(time(s), s % 4 === 0 ? .9 : s % 2 ? .4 : .65);
    else if (hm === '16ths-skip') for (let s = 0; s < 16; s++) { if (s % 2 === 0 || r() < .4) hat(time(s), s % 4 === 0 ? .85 : .5); }
    else if (hm === 'shaker') for (let s = 0; s < 16; s++) hit(shakerS, time(s), s % 2 ? .45 : .8, hats);
    else if (hm === 'off') for (let s = 0; s < 16; s += 2) hit(s % 4 === 2 ? openS : hatS, time(s), s % 4 === 2 ? .55 : .7, hats);
    else if (hm === 'triplet') for (let k = 0; k < 12; k++) hat(t0 + k * barSec / 12, k % 3 === 0 ? .9 : .55);
    else if (hm === 'drill') for (let k = 0; k < 12; k++) { if (rc.drillHats.includes(k) || (hook && r() < .2)) hat(t0 + k * barSec / 12, k % 3 === 0 ? .9 : .6); }
    else { // trap: восьмые, редкие шестнадцатые и рол
      const roll = r() < .6 ? 8 + 2 * Math.floor(r() * 4) : -1;
      for (let s = 0; s < 16; s += 2) {
        if (s === roll) { const c = pick([3, 4]); for (let j = 0; j < 2 * c; j++) hat(time(s) + j * sixteenth * 2 / c, .45 + j * .06); s += 2; continue; }
        hat(time(s), s % 4 === 0 ? 1 : .7);
        if (r() < .15) hat(time(s + 1), .45);
      }
    }
    if (hook) hit(openS, time(14), .6, hats);
    const pc = hook ? rc.hookPerc : rc.perc;
    if (fullDrums && pc === 'rim') for (const s of [6, 14].filter(() => r() < .7)) hit(rimS, time(s), .7, perc);
    if (fullDrums && pc === 'tamb') for (const s of [4, 12]) hit(tambS, time(s), .6, perc);
    if (fullDrums && pc === 'conga') for (const s of [3, 6, 11, 14]) hit(congaS, time(s), .4 + r() * .3, perc);
    if (fullDrums && pc === 'snap') for (const s of rc.snares[bar % 2]) hit(snapS, time(s) + .008, .7, perc);
    // сбивка в конце каждой четвёрки
    if (fullDrums && inSec % 4 === 3 && !lastVerse) {
      if (rc.fill === 'snare') for (let s = 12; s < 16; s++) hit(snareS, time(s), .3 + (s - 12) * .12, drums);
      else if (rc.fill === 'hat') for (let j = 0; j < 6; j++) hat(time(12) + j * sixteenth * 4 / 6, .5 + j * .07);
      else if (rc.fill === 'kick') { kick(time(14), .8); kick(time(15), .7); }
    }

    // бас
    if (fullDrums || rc.intro === 'drums') {
      const bn = bassNote(deg), up = rc.bass === '808' || rc.bass === 'sub' ? 0 : 12;
      if (rc.bassPat === 'sustain') bassVoice(t0, bn + up, barSec * .95);
      else if (rc.bassPat === 'walk') {
        const nextRoot = bassNote(chordOf(bar + 1)) + up, walk = [bn + up, note(deg + 2, bassRoot) + up, note(deg + 4, bassRoot) + up, nextRoot + (r() < .5 ? 1 : -1)];
        walk.forEach((m, k) => bassVoice(time(k * 4), m, sixteenth * 3.6));
      } else if (rc.bassPat === 'funk') rc.funk.forEach((s, k) => bassVoice(time(s), (k % 3 === 2 ? note(deg + 4, bassRoot) : k % 2 ? bn + 12 : bn) + up, sixteenth * 1.8));
      else kp.forEach((s, j) => {
        const next = kp[j + 1] ?? 16, last = j === kp.length - 1, slide = rc.bassPat === 'slide';
        const m = bn + up + (slide && j && r() < .3 ? 12 : 0);
        const glide = (slide && r() < .6) || (last && r() < .25) ? (last ? bassNote(chordOf(bar + 1)) + up : bn + up + pick([0, 12, -5])) : null;
        bassVoice(time(s), m, Math.max(.16, (next - s) * sixteenth * .95 + (last ? sixteenth * 2 : 0)), glide);
      });
    }
  }
  // качание музыки от бочки (сайдчейн)
  if (st.duck) for (const t of kicks) { duck.gain.setValueAtTime(1, Math.max(0, t - .005)); duck.gain.linearRampToValueAtTime(.45, t + .01); duck.gain.setTargetAtTime(1, t + .03, .09); }
  sum.gain.setValueAtTime(1, end); sum.gain.linearRampToValueAtTime(0, end + barSec / 2);

  const buf = await ctx.startRendering();
  // выравниваем по средней громкости, а не по пику — все биты звучат одинаково громко
  let peak = 0, sq = 0;
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = d[i]; sq += v * v; if (v > peak) peak = v; else if (-v > peak) peak = -v; } }
  const rms = Math.sqrt(sq / (2 * buf.length)), gain = Math.min(.89 / (peak || 1), .22 / (rms || 1));
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= gain; }
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
