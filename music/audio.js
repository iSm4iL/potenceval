import { t } from '../shared/i18n.js?v=ui-20261029';
import { isPreviewUrl } from './catalog.js?v=music-fixes-20261030';

// Fetch cancellation alone cannot release a stalled audio decoder or resume().
function abortable(operation, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => finish(signal.reason || new DOMException('Aborted', 'AbortError'));
    function finish(error, value) {
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error); else resolve(value);
    }
    Promise.resolve(operation).then(value => finish(null, value), finish);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

// Prefer a clearly more varied 15-second window over a repetitive intro.
// This measures signal variety, not vocals or musical recognizability.
export function audibleStart(buffer, threshold = 0.01) {
  if (typeof buffer?.getChannelData !== 'function') return 0;
  const channels = Array.from({ length: buffer.numberOfChannels || 1 }, (_, c) => buffer.getChannelData(c));
  const rate = buffer.sampleRate || 44100, latest = Math.max(0, buffer.duration - 15);
  const limit = Math.min(channels[0].length, Math.floor(latest * rate));
  let start = 0;
  for (let i = 0; i < limit; i++) if (channels.some(data => Math.abs(data[i]) > threshold)) {
    start = Math.max(0, i / rate - 0.03); break;
  }
  const size = Math.max(1, Math.floor(rate / 2)), features = [];
  for (let offset = 0; offset + size <= channels[0].length; offset += size) {
    let energy = 0, crossings = 0;
    for (const data of channels) for (let i = offset; i < offset + size; i++) {
      energy += data[i] * data[i];
      if (i > offset && (data[i] > 0) !== (data[i - 1] > 0)) crossings++;
    }
    features.push([Math.sqrt(energy / (size * channels.length)), crossings / (size * channels.length)]);
  }
  const variation = values => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return mean > 0 ? Math.sqrt(values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / values.length) / mean : 0;
  };
  const score = time => {
    const frames = features.slice(Math.ceil(time * rate / size), Math.ceil(time * rate / size) + 30);
    if (frames.length < 30 || frames.some(f => f[0] < threshold)) return 0;
    return variation(frames.map(f => f[0])) + .5 * variation(frames.map(f => f[1]));
  };
  const baseline = score(start);
  let best = baseline, chosen = start;
  for (let time = Math.ceil(start * 2) / 2; time <= latest; time += .5) {
    const value = score(time);
    if (value > best + .01) { best = value; chosen = time; }
  }
  return best > baseline * 1.5 + .15 ? chosen : start;
}

export class AudioPlayer {
  constructor({ context = null, fetchAudio = (...args) => fetch(...args) } = {}) {
    this.context = context;
    this.fetchAudio = fetchAudio;
    this.controller = null;
    this.buffer = null;
    this.track = null;
    this.source = null;
    this.master = null;
    this.volume = 0.7;
    this.version = 0;
    this.settle = null;
  }

  getContext() {
    if (!this.context) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) throw new Error(t('В этом браузере не работает звук. Открой игру в современном браузере.', "This browser does not support audio. Open the game in a modern browser."));
      this.context = new Audio();
    }
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.master) this.master.gain.value = this.volume;
  }

  async load(track, { onStatus } = {}) {
    this.stop();
    const version = this.version;
    this.track = null; this.buffer = null;
    if (!isPreviewUrl(track?.preview)) throw new Error(t('Нет доступного онлайн-превью для этого трека.', "No online preview is available for this track."));
    const controller = this.controller = new AbortController();
    try {
      const buffer = await this.fetchBuffer(track, controller.signal, onStatus);
      if (version !== this.version) return false;
      this.track = { ...track, start: audibleStart(buffer) }; this.buffer = buffer;
      return true;
    } catch (error) {
      if (version !== this.version) return false;
      throw error;
    } finally { if (this.controller === controller) this.controller = null; }
  }

  // Фоновая подгрузка следующей песни: только скачать и раскодировать, текущий звук не трогаем.
  async fetchBuffer(track, signal, onStatus = () => {}) {
    if (!isPreviewUrl(track?.preview)) throw new Error(t('Нет доступного онлайн-превью для этого трека.', "No online preview is available for this track."));
    const controller = new AbortController();
    const cancel = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    let decoding = false;
    const timer = setTimeout(() => controller.abort(new Error(decoding
      ? t('Браузер не смог подготовить звук за 15 секунд. Обновите страницу или попробуйте другой браузер.', "The browser could not prepare audio within 15 seconds. Reload or try another browser.")
      : t('Аудиофайл не загрузился за 15 секунд. Попробуйте другое подключение к интернету или замените песню.', "Audio did not load within 15 seconds. Try another connection or replace the song."))), 15000);
    try {
      if (signal?.aborted) cancel();
      controller.signal.throwIfAborted();
      onStatus(t('Загружаем аудиофайл…', "Loading audio…"));
      const response = await abortable(this.fetchAudio(track.preview, { signal: controller.signal, mode: 'cors', credentials: 'omit', cache: 'no-store' }), controller.signal);
      if (!response.ok) throw new Error(`${t("Сервер аудиопревью вернул ошибку HTTP", "The preview server returned HTTP error")} ${response.status}. ${t("Попробуйте заменить песню.", "Try replacing the song.")}`);
      const bytes = await abortable(response.arrayBuffer(), controller.signal);
      decoding = true; onStatus(t('Подготавливаем звук…', "Preparing audio…"));
      const buffer = await abortable(this.getContext().decodeAudioData(bytes), controller.signal);
      if (!Number.isFinite(buffer.duration) || buffer.duration < 15) throw new Error(t('В превью меньше 15 секунд звука. Этот трек можно заменить без штрафа.', "The preview is shorter than 15 seconds. Replace this track without penalty."));
      return buffer;
    } catch (error) {
      if (error instanceof TypeError) throw new Error(t('Не удалось загрузить аудиофайл с сервера Deezer. Попробуйте другое подключение к интернету.', "Could not load audio from Deezer. Try another internet connection."));
      if (error.name === 'EncodingError') throw new Error(t('Браузер не смог прочитать аудиофайл. Попробуйте заменить песню.', "The browser could not decode the audio. Try replacing the song."));
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }

  useBuffer(track, buffer) {
    this.stop();
    this.track = { ...track, start: audibleStart(buffer) }; this.buffer = buffer;
  }

  async play(seconds, { onStart = () => {} } = {}) {
    this.stop();
    const version = this.version, buffer = this.buffer, track = this.track;
    if (!buffer || !track) throw new Error(t('Сначала загрузи песню.', "Load a song first."));
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 15) throw new Error(t('Некорректная длина отрывка.', "Invalid snippet length."));
    const context = this.getContext();
    const controller = this.controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(t('Браузер не включил звук. Нажмите на пластинку ещё раз. Если не поможет, проверьте разрешение на звук для сайта и устройство вывода в настройках браузера.', "The browser did not start audio. Press the record again. If needed, check this site’s audio permission and the browser’s output device."))), 5000);
    try { await abortable(context.resume(), controller.signal); }
    catch (error) { if (version !== this.version) return false; throw error; }
    finally { clearTimeout(timer); if (this.controller === controller) this.controller = null; }
    if (version !== this.version) return false;
    if (context.state && context.state !== 'running') throw new Error(t('Браузер приостановил звук. Нажмите на пластинку ещё раз или обновите страницу.', "The browser paused audio. Press the record again or reload the page."));
    const source = context.createBufferSource(), gain = context.createGain(), when = context.currentTime + 0.02;
    source.buffer = buffer; source.connect(gain); gain.connect(this.master);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(1, when + 0.004);
    gain.gain.setValueAtTime(1, when + seconds - 0.008);
    gain.gain.linearRampToValueAtTime(0, when + seconds);
    this.source = source;
    return new Promise((resolve, reject) => {
      const watchdog = setTimeout(() => {
        if (this.source !== source) return;
        this.source = null; this.settle = null;
        try { source.stop(); } catch { /* Already stopped. */ }
        reject(new Error(t('Воспроизведение звука остановилось в браузере. Проверьте устройство вывода звука и нажмите на пластинку ещё раз.', "Audio playback stopped. Check your output device and press the record again.")));
      }, seconds * 1000 + 3000);
      this.settle = value => { clearTimeout(watchdog); resolve(value); };
      source.onended = () => {
        clearTimeout(watchdog);
        source.disconnect(); gain.disconnect();
        if (this.source === source) { this.source = null; this.settle = null; resolve(true); }
      };
      try { source.start(when, track.start || 0, seconds); onStart(); }
      catch (error) { clearTimeout(watchdog); this.source = null; this.settle = null; source.disconnect(); gain.disconnect(); reject(error); }
    });
  }

  stop() {
    this.version++;
    this.controller?.abort(); this.controller = null;
    const source = this.source, settle = this.settle;
    this.source = null; this.settle = null;
    settle?.(false);
    if (source) { try { source.stop(); } catch { /* Already stopped. */ } }
  }

  // Losing visibility stops sound, but must not discard an in-flight decode.
  pause() {
    if (this.track) this.stop();
  }
}
