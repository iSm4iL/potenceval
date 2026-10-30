import { t } from '../shared/i18n.js?v=ui-20261029';
import { normalizeDeezer } from './catalog.js?v=music-fixes-20261030';

const API_ORIGIN = 'https://api.deezer.com';
let callbackSequence = 0;
const noop = () => {};

function abortError(signal) {
  return signal?.reason?.name === 'AbortError'
    ? signal.reason : new DOMException('Request cancelled', 'AbortError');
}

function checkAborted(signal) {
  if (signal?.aborted) throw abortError(signal);
}

export function deezerRequest(path, params = {}, { signal } = {}) {
  return new Promise((resolve, reject) => {
    checkAborted(signal);
    const url = new URL(path, `${API_ORIGIN}/`);
    if (url.origin !== API_ORIGIN || url.username || url.password) {
      throw new Error('Deezer requests must use https://api.deezer.com/');
    }
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    let callback;
    do {
      callback = `__deezer_jsonp_${Date.now().toString(36)}_${(++callbackSequence).toString(36)}`;
    } while (callback in globalThis);
    url.searchParams.set('output', 'jsonp');
    url.searchParams.set('callback', callback);

    const script = document.createElement('script');
    let settled = false, timer;
    const onAbort = () => finish(abortError(signal));
    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      script.onerror = null;
      script.remove();
      // Removing a script cannot cancel code already in flight; leave a harmless callback.
      globalThis[callback] = noop;
      if (error) reject(error);
      else resolve(value);
    }

    globalThis[callback] = payload => {
      if (payload?.error) {
        const error = new Error(`Deezer: ${payload.error.message || payload.error.type || 'API error'}`);
        error.code = payload.error.code;
        finish(error);
      } else finish(null, payload);
    };
    script.async = true;
    script.src = url.href;
    script.onerror = () => finish(new Error(t('Не удалось загрузить данные Deezer. Проверьте подключение к интернету и блокировщики в браузере.', "Could not load Deezer data. Check your internet connection and browser blockers.")));
    timer = setTimeout(() => finish(new Error(t('Вышло время ожидания: Deezer не ответил за 12 секунд. Попробуйте ещё раз или проверьте игру через другое подключение к интернету.', "Deezer did not respond within 12 seconds. Try again or use another internet connection."))), 12000);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    try {
      document.head.appendChild(script);
    } catch (error) {
      finish(error);
    }
  });
}

function numericId(value, allowZero = false) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) {
    throw new Error('Invalid Deezer ID');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < (allowZero ? 0 : 1)) throw new Error('Invalid Deezer ID');
  return id;
}

function rows(response) {
  if (!Array.isArray(response?.data)) throw new Error(t('Deezer вернул некорректный список. Попробуй обновить подборку.', "Deezer returned an invalid list. Try refreshing the collection."));
  return response.data;
}

function normalizeTracks(rawTracks, limit = 100) {
  const tracks = [], seen = new Set();
  for (const raw of rawTracks) {
    const track = normalizeDeezer(raw);
    if (!track || seen.has(track.answerKey)) continue;
    seen.add(track.answerKey);
    tracks.push(track);
    if (tracks.length === limit) break;
  }
  return tracks;
}

function* roundRobin(lists) {
  const length = Math.max(0, ...lists.map(list => list.length));
  for (let index = 0; index < length; index++) {
    for (const list of lists) {
      if (index < list.length) yield list[index];
    }
  }
}

export function createDeezerClient({ request = deezerRequest } = {}) {
  async function get(path, params, signal) {
    checkAborted(signal);
    const result = await request(path, params, { signal });
    checkAborted(signal);
    return result;
  }

  return {
    async loadPack(pack, { signal } = {}) {
      checkAborted(signal);
      if (pack.genreId != null) {
        const response = await get(`chart/${numericId(pack.genreId, true)}/tracks`, { limit: 100 }, signal);
        return { tracks: normalizeTracks(rows(response)), loadedAt: Date.now(), failures: [] };
      }
      if (!Array.isArray(pack.artists) || !pack.artists.length) throw new Error('Pack requires a genre or artists');
      const limit = pack.topLimit ?? (pack.artists.length === 1 ? 10 : 5);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error(t('Некорректное количество треков исполнителя', "Invalid artist track count"));
      const results = await Promise.all(pack.artists.map(async artist => {
        try {
          const response = await get(`artist/${numericId(artist.id)}/top`, { limit }, signal);
          return { tracks: rows(response).slice(0, limit) };
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          checkAborted(signal);
          return { failure: `${artist.name}: ${error?.message || String(error)}` };
        }
      }));
      checkAborted(signal);
      const failures = results.filter(result => result.failure).map(result => result.failure);
      if (failures.length === results.length) throw new Error(`${t("Не удалось загрузить исполнителей из Deezer:", "Could not load artists from Deezer:")} ${failures.join('; ')}`);
      return {
        tracks: normalizeTracks(roundRobin(results.filter(result => result.tracks).map(result => result.tracks))),
        loadedAt: Date.now(),
        failures,
      };
    },

    async track(id, { signal } = {}) {
      checkAborted(signal);
      const result = normalizeDeezer(await get(`track/${numericId(id)}`, {}, signal));
      if (!result) throw new Error(t('Превью Deezer недоступно. Попробуй заменить этот трек без штрафа.', "The Deezer preview is unavailable. Replace this track without penalty."));
      return result;
    },

    async searchTracks(query, { signal } = {}) {
      const response = await get('search', { q: query, limit: 12 }, signal);
      const raw = rows(response);
      return Promise.all(normalizeTracks(raw, 12).map(async track => {
        if (raw.find(item => item.id === track.deezerId)?.contributors?.length) return track;
        try {
          const detail = normalizeDeezer(await get(`track/${track.deezerId}`, {}, signal));
          return detail?.id === track.id ? detail : track;
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          checkAborted(signal);
          return track;
        }
      }));
    },

    async searchArtists(query, { signal } = {}) {
      const response = await get('search/artist', { q: query, limit: 8 }, signal);
      return rows(response).slice(0, 8).map(artist => ({
        id: Number(artist.id), name: artist.name,
        picture: artist.picture_medium || artist.picture || '',
      }));
    },
  };
}
