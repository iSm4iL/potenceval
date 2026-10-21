// Биты из формул. Каждый бит целиком задаётся числом (сидом) и стилем, поэтому
// у всех игроков он рендерится одинаково — по сети передаём только сид.
const SR = 44100;
export const STYLES = {
  trap:    { label: 'Трэп',    bpm: [136, 150], bars: [2, 8, 8], swing: 0,   snare: [8],     half: true },
  phonk:   { label: 'Фонк',    bpm: [128, 140], bars: [2, 8, 8], swing: 0,   snare: [8],     half: true },
  boombap: { label: 'Бум-бэп', bpm: [86, 94],   bars: [2, 4, 4], swing: .14, snare: [4, 12], half: false },
  lofi:    { label: 'Лоу-фай', bpm: [76, 86],   bars: [2, 4, 4], swing: .2,  snare: [4, 12], half: false },
};
const NAMES = ['Холодный подъезд', 'Ночная маршрутка', 'Ржавая девятка', 'Бетонный рассвет', 'Последняя электричка', 'Спальный район',
  'Гаражный кооператив', 'Дым над ТЭЦ', 'Пятничная шаурма', 'Двор без фонарей', 'Сломанный домофон', 'Зимний гараж', 'Тёплый асфальт',
  'Девятый этаж', 'Неон над ларьком', 'Пустая остановка', 'Мокрый кроссовок', 'Шумные соседи', 'Кассета в бардачке', 'Звонок в три ночи',
  'Лифт не работает', 'Северный ветер', 'Дача в октябре', 'Сигнал с района', 'Чёрная Приора', 'Магнитола деда', 'Дождь на крыше',
  'Полночный перрон', 'Последний урок', 'Старый плеер'];
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PENTA = [0, 3, 5, 7, 10];
const PROGS = [[0, 5, 2, 6], [0, 3, 4, 0], [0, 5, 3, 4], [0, 6, 5, 6], [0, 3, 5, 4], [0, 2, 5, 6]];
const KICKS = {
  trap: [[0, 10], [0, 7, 10], [0, 3, 10], [0, 6, 11], [0, 10, 13]],
  phonk: [[0, 3, 6, 10], [0, 7, 10, 13], [0, 6, 10]],
  boombap: [[0, 10], [0, 6, 10], [0, 7, 10], [0, 9, 10]],
  lofi: [[0, 10], [0, 7, 10], [0, 6, 9]],
};

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
const pickOf = r => arr => arr[Math.floor(r() * arr.length)];

// Паспорт бита: темп, тональность, части (интро / куплет / припев) с таймингами.
export function describe(seed, style) {
  const r = rng(seed), pick = pickOf(r);
  style = STYLES[style] ? style : pick(Object.keys(STYLES));
  const st = STYLES[style];
  const bpm = Math.round(st.bpm[0] + r() * (st.bpm[1] - st.bpm[0]));
  const key = Math.floor(r() * 12);
  const prog = pick(PROGS), name = pick(NAMES);
  const barSec = 240 / bpm, [ib, vb, hb] = st.bars, bars = ib + vb + hb;
  return {
    seed, style, label: st.label, bpm, key, keyName: KEYS[key] + 'm', prog, name, barSec, bars,
    sections: [
      { name: 'Интро', from: 0, to: ib * barSec },
      { name: 'Куплет', from: ib * barSec, to: (ib + vb) * barSec },
      { name: 'Припев', from: (ib + vb) * barSec, to: bars * barSec },
    ],
    duration: bars * barSec + barSec / 2,
  };
}

export async function renderBeat(info) {
  const { style, key, prog, barSec, bars } = info, st = STYLES[style];
  const r = rng(info.seed * 7919 + 13), pick = pickOf(r);
  const ctx = new OfflineAudioContext(2, Math.ceil((info.duration + 1) * SR), SR);

  // микшер: группы → мастер → компрессор (→ «плёнка» для лоу-фая)
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
  master.connect(comp);
  let out = comp;
  if (style === 'lofi') { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600; comp.connect(lp); out = lp; }
  out.connect(ctx.destination);
  const bus = (v, pan = 0) => {
    const g = ctx.createGain(); g.gain.value = v;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p).connect(master);
    return g;
  };
  const drums = bus(1), bass = bus(.9), music = bus(.6), lead = bus(.42, .18), hats = bus(.32, -.18);

  // шум — основа щелчка бочки, малого, клэпа и тарелок
  const nb = new AudioBuffer({ numberOfChannels: 1, length: SR, sampleRate: SR }), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
  const noise = (c, to, t, { type = 'highpass', freq = 7000, q = .7, vel = 1, decay = .05 }) => {
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = nb; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(.0001, t + decay);
    s.connect(f).connect(g).connect(to);
    s.start(t, r() * .4); s.stop(t + decay + .02);
  };
  const osc = (type, freq, t, dur, to, c = ctx) => {
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    o.connect(to); o.start(t); o.stop(t + dur);
    return o;
  };
  // Барабаны рендерим один раз в короткие сэмплы, дальше только проигрываем их — так в разы быстрее.
  const shot = (dur, build) => { const c = new OfflineAudioContext(1, Math.ceil(dur * SR), SR); build(c, c.destination); return c.startRendering(); };
  const [kickS, snareS, clapS, hatS, hatS2, openS, clickS, crashS] = await Promise.all([
    shot(.5, (c, to) => {
      const g = c.createGain(), o = osc('sine', 0, 0, .5, g, c);
      o.frequency.setValueAtTime(style === 'lofi' ? 120 : 160, 0); o.frequency.exponentialRampToValueAtTime(45, .11);
      g.gain.setValueAtTime(1, 0); g.gain.exponentialRampToValueAtTime(.0001, st.half ? .32 : .42);
      g.connect(to);
      noise(c, to, 0, { type: 'highpass', freq: 2500, vel: .3, decay: .012 });
    }),
    shot(.25, (c, to) => {
      noise(c, to, 0, { type: 'bandpass', freq: 1900, q: .8, vel: .9, decay: .19 });
      const g = c.createGain(), o = osc('triangle', 0, 0, .15, g, c);
      o.frequency.setValueAtTime(200, 0); o.frequency.exponentialRampToValueAtTime(140, .08);
      g.gain.setValueAtTime(.45, 0); g.gain.exponentialRampToValueAtTime(.0001, .12);
      g.connect(to);
    }),
    shot(.25, (c, to) => {
      for (let k = 0; k < 3; k++) noise(c, to, k * .011, { type: 'bandpass', freq: 1300, q: 1.2, vel: .6, decay: .03 });
      noise(c, to, .033, { type: 'bandpass', freq: 1200, q: .9, vel: .5, decay: .18 });
    }),
    shot(.07, (c, to) => noise(c, to, 0, { freq: 8000, vel: .55, decay: .045 })),
    shot(.07, (c, to) => noise(c, to, 0, { freq: 9500, vel: .5, decay: .04 })),
    shot(.32, (c, to) => noise(c, to, 0, { freq: 6500, vel: .55, decay: .28 })),
    shot(.01, (c, to) => noise(c, to, 0, { freq: 3000, vel: 1, decay: .004 })),
    shot(1.5, (c, to) => noise(c, to, 0, { freq: 5000, vel: .45, decay: 1.4 })),
  ]);
  const hit = (b, t, vel, to) => { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = vel; s.connect(g).connect(to); s.start(t); };
  const kick = (t, vel = 1) => hit(kickS, t, vel, drums);
  const snare = (t, vel = 1) => hit(snareS, t, vel, drums);
  const clap = (t, vel = 1) => hit(clapS, t, vel, drums);
  const hat = (t, vel = 1, open = false) => hit(open ? openS : r() < .5 ? hatS : hatS2, t, vel, hats);

  // 808 / бас через мягкий перегруз
  const shaper = ctx.createWaveShaper(), curve = new Float32Array(1024), k = style === 'phonk' ? 6 : 2.5;
  for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(k * (i / 512 - 1)) / Math.tanh(k);
  shaper.curve = curve;
  const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = st.half ? 900 : 600;
  shaper.connect(blp).connect(bass);
  const b808 = (t, midi, dur, glide) => {
    const g = ctx.createGain(), o = osc(st.half ? 'sine' : 'triangle', mtof(midi), t, dur + .05, g);
    if (glide != null) o.frequency.setTargetAtTime(mtof(glide), t + dur * .7, .04);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.9, t + .008);
    g.gain.setValueAtTime(.9, t + Math.max(.01, Math.min(dur * .5, .25))); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    g.connect(shaper);
  };
  const pad = (t, dur, midis, vel = 1, bright = 1) => {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = (style === 'lofi' ? 1400 : 1800) * bright; f.Q.value = .5;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16 * vel, t + .25);
    g.gain.setValueAtTime(.16 * vel, t + dur * .8); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .25);
    f.connect(g).connect(music);
    for (const m of midis) for (const det of [-7, 7]) osc(style === 'lofi' ? 'triangle' : 'sawtooth', mtof(m), t, dur + .3, f).detune.value = det;
  };
  const pluck = (t, midi, vel = 1, dur = .35) => {
    if (style === 'phonk') { // ковбелл
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = mtof(midi) * 2; f.Q.value = 3;
      g.gain.setValueAtTime(.55 * vel, t); g.gain.exponentialRampToValueAtTime(.0001, t + .28);
      f.connect(g).connect(lead);
      osc('square', mtof(midi), t, .3, f); osc('square', mtof(midi) * 1.48, t, .3, f);
      return;
    }
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35 * vel, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    f.connect(g).connect(lead);
    osc(style === 'lofi' ? 'sine' : 'triangle', mtof(midi), t, dur + .05, f);
  };
  const riser = (t, dur) => { // шум нарастает перед дропом
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = nb; s.loop = true; f.type = 'highpass';
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.25, t + dur);
    s.connect(f).connect(g).connect(hats); s.start(t); s.stop(t + dur);
  };
  if (style === 'lofi') { // треск пластинки
    for (let i = 0; i < info.duration * 7; i++) hit(clickS, r() * info.duration, .12 + r() * .15, master);
  }

  // гармония и мелодия
  const bassRoot = 33 + ((key + 3) % 12); // A1..G#2
  const scale = (deg, base) => base + MINOR[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
  const penta = (deg, base) => base + PENTA[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5);
  const chordOf = bar => prog[(((bar - st.bars[0]) % 4) + 4) % 4];
  const bassNote = deg => { const n = bassRoot + MINOR[deg]; return n - bassRoot > 6 ? n - 12 : n; };
  const phrase = []; // двухтактная мелодия, повторяется — так ухо слышит мотив
  for (let i = 0, d = 0; i < 16; i++) {
    if (r() < (i % 4 === 0 ? .75 : .38)) { d = Math.max(-2, Math.min(7, d + Math.floor(r() * 5) - 2)); phrase.push({ i, d, len: r() < .3 ? 2 : 1 }); }
  }
  const kickA = pick(KICKS[style]), kickB = pick(KICKS[style]);
  const sixteenth = barSec / 16, [ib, vb] = st.bars;

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * barSec, sec = bar < ib ? 'intro' : bar < ib + vb ? 'verse' : 'hook';
    const time = s => t0 + s * sixteenth + (s % 2 ? st.swing * sixteenth : 0);
    const deg = chordOf(bar);
    pad(t0, barSec, [0, 2, 4].map(d => scale(deg + d, bassRoot + 24)), sec === 'verse' ? .6 : 1, sec === 'hook' ? 1.4 : sec === 'verse' ? .75 : 1);

    // мелодия: в интро и припеве ярко, в куплете тихо или молчит — чтобы не мешать читать
    const leadVel = sec === 'hook' ? 1.25 : sec === 'intro' ? .9 : style === 'trap' ? 0 : bar % 2 ? .45 : 0;
    if (leadVel) for (const n of phrase) {
      if (Math.floor(n.i / 8) !== bar % 2) continue;
      const t = time((n.i % 8) * 2), note = penta(n.d, bassRoot + 36), len = n.len * 2 * sixteenth * 1.5;
      pluck(t, note, leadVel, len);
      if (sec === 'hook' && style !== 'phonk') pluck(t, note + 12, .45, len);
    }
    if (bar === ib + vb) hit(crashS, t0, .8, hats); // тарелка на входе в припев
    if (bar === ib + vb - 1) riser(t0, barSec);
    if (sec === 'intro') {
      if (bar === ib - 1) { riser(t0, barSec); if (st.half) for (let s = 8; s < 16; s += 2) hat(time(s), .6); }
      continue;
    }

    const kp = bar % 2 ? kickB : kickA;
    for (const s of kp) kick(time(s), s === 0 ? 1 : .85);
    for (const s of st.snare) { snare(time(s)); if (st.half) clap(time(s), .8); }
    if (!st.half && r() < .35) snare(time(r() < .5 ? 7 : 15), .25);
    if (st.half && sec === 'hook' && bar % 2) clap(time(14), .5);

    if (st.half) {
      const roll = r() < .6 ? 8 + 2 * Math.floor(r() * 4) : -1;
      for (let s = 0; s < 16; s += 2) {
        if (s === roll) { const c = r() < .5 ? 3 : 4; for (let j = 0; j < 2 * c; j++) hat(time(s) + j * sixteenth * 2 / c, .45 + j * .06); s += 2; continue; }
        hat(time(s), s % 4 === 0 ? 1 : .7);
        if (r() < .15) hat(time(s + 1), .45);
      }
      kp.forEach((s, j) => {
        const nextStep = kp[j + 1] ?? 16, last = j === kp.length - 1;
        const glide = last && r() < .3 ? bassNote(chordOf(bar + 1)) : null;
        b808(time(s), bassNote(deg), Math.max(.18, (nextStep - s) * sixteenth * .95 + (last ? sixteenth * 2 : 0)), glide);
      });
    } else {
      for (let s = 0; s < 16; s += 2) hat(time(s), s % 4 === 0 ? .9 : .6 + r() * .2);
      kp.forEach(s => b808(time(s), bassNote(deg) + 12, sixteenth * 3.5));
    }
    if (sec === 'hook') hat(time(14), .7, true);
  }
  // затухание в конце
  const end = bars * barSec;
  master.gain.setValueAtTime(.9, end); master.gain.linearRampToValueAtTime(0, end + barSec / 2);

  const buf = await ctx.startRendering();
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) for (const v of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= .89 / peak; }
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
