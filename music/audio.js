import { isPreviewUrl } from './catalog.js';

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

  async load(track) {
    this.stop();
    const version = this.version;
    this.track = null; this.buffer = null;
    if (!isPreviewUrl(track?.preview)) throw new Error('Нет доступного онлайн-превью для этого трека.');
    const controller = this.controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await this.fetchAudio(track.preview, { signal: controller.signal, mode: 'cors', credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('Превью недоступно в этом регионе или ссылка устарела. Попробуй ещё раз или замени трек.');
      const buffer = await this.getContext().decodeAudioData(await response.arrayBuffer());
      if (version !== this.version) return false;
      if (!Number.isFinite(buffer.duration) || buffer.duration < 15) throw new Error('В превью меньше 15 секунд звука. Этот трек можно заменить без штрафа.');
      this.track = { ...track, start: 0 }; this.buffer = buffer;
      return true;
    } catch (error) {
      if (version !== this.version) return false;
      if (error.name === 'AbortError') throw new Error('Сервис слишком долго загружает превью. Попробуй ещё раз или замени песню.');
      if (error instanceof TypeError) throw new Error('Не удалось получить онлайн-превью. Проверь соединение и доступность Deezer в своём регионе.');
      throw error;
    } finally { clearTimeout(timer); if (this.controller === controller) this.controller = null; }
  }

  // Фоновая подгрузка следующей песни: только скачать и раскодировать, текущий звук не трогаем.
  async fetchBuffer(track, signal) {
    if (!isPreviewUrl(track?.preview)) throw new Error('Нет доступного онлайн-превью для этого трека.');
    const response = await this.fetchAudio(track.preview, { signal, mode: 'cors', credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('Превью недоступно в этом регионе или ссылка устарела.');
    const buffer = await this.getContext().decodeAudioData(await response.arrayBuffer());
    if (!Number.isFinite(buffer.duration) || buffer.duration < 15) throw new Error('В превью меньше 15 секунд звука.');
    return buffer;
  }

  useBuffer(track, buffer) {
    this.stop();
    this.track = { ...track, start: 0 }; this.buffer = buffer;
  }

  async play(seconds) {
    this.stop();
    const version = this.version, buffer = this.buffer, track = this.track;
    if (!buffer || !track) throw new Error('Сначала загрузи песню.');
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 15) throw new Error('Некорректная длина отрывка.');
    const context = this.getContext();
    await context.resume();
    if (version !== this.version) return false;
    const source = context.createBufferSource(), gain = context.createGain(), when = context.currentTime + 0.02;
    source.buffer = buffer; source.connect(gain); gain.connect(this.master);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(1, when + 0.004);
    gain.gain.setValueAtTime(1, when + seconds - 0.008);
    gain.gain.linearRampToValueAtTime(0, when + seconds);
    this.source = source;
    return new Promise((resolve, reject) => {
      this.settle = resolve;
      source.onended = () => {
        source.disconnect(); gain.disconnect();
        if (this.source === source) { this.source = null; this.settle = null; resolve(true); }
      };
      try { source.start(when, track.start || 0, seconds); }
      catch (error) { this.source = null; this.settle = null; source.disconnect(); gain.disconnect(); reject(error); }
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
