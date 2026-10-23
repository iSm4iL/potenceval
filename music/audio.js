import { isPreviewUrl } from './catalog.js';

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
      if (!Audio) throw new Error('В этом браузере не работает звук. Открой игру в современном браузере.');
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
    if (!isPreviewUrl(track?.preview)) throw new Error('Нет доступного онлайн-превью для этого трека.');
    const controller = this.controller = new AbortController();
    try {
      const buffer = await this.fetchBuffer(track, controller.signal, onStatus);
      if (version !== this.version) return false;
      this.track = { ...track, start: 0 }; this.buffer = buffer;
      return true;
    } catch (error) {
      if (version !== this.version) return false;
      throw error;
    } finally { if (this.controller === controller) this.controller = null; }
  }

  // Фоновая подгрузка следующей песни: только скачать и раскодировать, текущий звук не трогаем.
  async fetchBuffer(track, signal, onStatus = () => {}) {
    if (!isPreviewUrl(track?.preview)) throw new Error('Нет доступного онлайн-превью для этого трека.');
    const controller = new AbortController();
    const cancel = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    let decoding = false;
    const timer = setTimeout(() => controller.abort(new Error(decoding
      ? 'Браузер не смог подготовить звук за 15 секунд. Обновите страницу или попробуйте другой браузер.'
      : 'Аудиофайл не загрузился за 15 секунд. Попробуйте другое подключение к интернету или замените песню.')), 15000);
    try {
      if (signal?.aborted) cancel();
      controller.signal.throwIfAborted();
      onStatus('Загружаем аудиофайл…');
      const response = await abortable(this.fetchAudio(track.preview, { signal: controller.signal, mode: 'cors', credentials: 'omit', cache: 'no-store' }), controller.signal);
      if (!response.ok) throw new Error(`Сервер аудиопревью вернул ошибку HTTP ${response.status}. Попробуйте заменить песню.`);
      const bytes = await abortable(response.arrayBuffer(), controller.signal);
      decoding = true; onStatus('Подготавливаем звук…');
      const buffer = await abortable(this.getContext().decodeAudioData(bytes), controller.signal);
      if (!Number.isFinite(buffer.duration) || buffer.duration < 15) throw new Error('В превью меньше 15 секунд звука. Этот трек можно заменить без штрафа.');
      return buffer;
    } catch (error) {
      if (error instanceof TypeError) throw new Error('Не удалось загрузить аудиофайл с сервера Deezer. Попробуйте другое подключение к интернету.');
      if (error.name === 'EncodingError') throw new Error('Браузер не смог прочитать аудиофайл. Попробуйте заменить песню.');
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }

  useBuffer(track, buffer) {
    this.stop();
    this.track = { ...track, start: 0 }; this.buffer = buffer;
  }

  async play(seconds, { onStart = () => {} } = {}) {
    this.stop();
    const version = this.version, buffer = this.buffer, track = this.track;
    if (!buffer || !track) throw new Error('Сначала загрузи песню.');
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 15) throw new Error('Некорректная длина отрывка.');
    const context = this.getContext();
    const controller = this.controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Браузер не включил звук. Нажмите на пластинку ещё раз. Если не поможет, проверьте разрешение на звук для сайта и устройство вывода в настройках браузера.')), 5000);
    try { await abortable(context.resume(), controller.signal); }
    catch (error) { if (version !== this.version) return false; throw error; }
    finally { clearTimeout(timer); if (this.controller === controller) this.controller = null; }
    if (version !== this.version) return false;
    if (context.state && context.state !== 'running') throw new Error('Браузер приостановил звук. Нажмите на пластинку ещё раз или обновите страницу.');
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
        reject(new Error('Воспроизведение звука остановилось в браузере. Проверьте устройство вывода звука и нажмите на пластинку ещё раз.'));
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
