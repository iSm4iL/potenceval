import { availableSlots, nextDays } from './booking.js?v=14b49c6c3395';
import { initialCatalog, validBrand, validCatalog, validNews } from './catalog.js?v=14b49c6c3395';
import { serviceDuration, serviceMasters, servicePrice, workingHours } from './salon.js?v=14b49c6c3395';

const sample = { name: 'Анна, тестовый клиент', phone: '+7 (900) 000-00-00' };
const stamp = (day, time) => new Date(`${day}T${time}:00`);
const publicVisit = ({ name, phone, source, offer, ...visit }) => visit;

export function createDemo(storageKey, now, storage = () => globalThis.localStorage) {
  const fresh = () => {
    const catalog = structuredClone(initialCatalog);
    catalog.revision = 1;
    catalog.brand.address = 'Адрес салона в рабочей версии';
    const dates = nextDays(24, now());
    const dateLabel = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    for (const post of catalog.news) {
      if (!post.until || post.until >= dates[0]) continue;
      post.until = dates[post.type === 'Акция' ? 23 : 14];
      const day = dateLabel.format(new Date(post.until));
      post.date = post.type === 'Акция' ? `До ${day}` : `${day}, 12:00`;
      delete post.poster;
    }
    return { catalog, visits: [] };
  };
  let memory = fresh();
  let inMemoryOnly = false;
  function read() {
    if (inMemoryOnly) return memory;
    try { return JSON.parse(storage().getItem(storageKey)) ?? memory; }
    catch { return memory; }
  }
  function write(state) {
    memory = state;
    if (inMemoryOnly) return;
    try { storage().setItem(storageKey, JSON.stringify(state)); }
    catch { inMemoryOnly = true; }
  }
  function fail(status, message = String(status), code) {
    throw Object.assign(new Error(message), { status, code });
  }

  function request(path, { method = 'GET', body, headers = {} } = {}) {
    const state = read();
    const { catalog, visits } = state;
    const staff = path.startsWith('studio/');
    const visitPath = path.match(/^(?:studio\/)?visits\/([0-9a-f-]{36})$/i);
    const visit = visitPath && visits.find(({ id }) => id === visitPath[1]);
    if (method === 'GET') {
      if (path === 'catalog') {
        const { masterContacts, ...result } = catalog;
        return result;
      }
      if (path === 'studio/catalog') return catalog;
      if (path === 'busy') return visits.filter(({ status }) => status === 'booked')
        .map(({ day, time, masterId, duration }) => ({ day, time, masterId, duration }));
      if (path === 'studio/visits') return visits;
      if (path === 'visits') return visits.filter(({ source }) => source === 'online').map(publicVisit);
      if (path === 'shared-visit') {
        const shared = visits.find(({ shareToken }) => headers.Authorization === 'Bearer ' + shareToken);
        if (shared) return publicVisit(shared);
      }
      return fail(404);
    }

    const input = body ? JSON.parse(body) : {};
    if (method === 'PUT' && path === 'studio/catalog') {
      if (input.revision !== catalog.revision) return fail(409, 'Настройки изменились. Откройте кабинет заново.');
      if (!validCatalog(input, catalog) || !validBrand(input.brand) || !validNews(input.news, input.services)) {
        return fail(400, 'Проверьте настройки и заполненные поля.');
      }
      const conflict = visits.find((entry) => {
        if (entry.status !== 'booked' || stamp(entry.day, entry.time) <= now()) return false;
        const master = input.masters.find(({ id }) => id === entry.masterId);
        const [hour, minute] = entry.time.split(':').map(Number);
        const start = hour * 60 + minute;
        return !workingHours(master.id, entry.day, master).some(([open, close]) => start >= open && start + entry.duration <= close);
      });
      if (conflict) return fail(409, 'Изменение смены затрагивает подтверждённый визит. Перенесите или отмените его.');
      // Work contacts are outside this demo. Use only the synthetic data in sample bookings.
      state.catalog = { ...input, masterContacts: {}, revision: catalog.revision + 1 };
      write(state);
      return state.catalog;
    }

    if (method === 'DELETE' && visitPath) {
      if (!visit || visit.status !== 'booked' || stamp(visit.day, visit.time) <= now() || (!staff && visit.source !== 'online')) return fail(404);
      visit.status = 'cancelled';
      write(state);
      return {};
    }

    const moving = method === 'PUT' && staff && visitPath;
    const booking = method === 'POST' && ['visits', 'studio/visits'].includes(path);
    if (!moving && !booking) return fail(404);
    if (moving && (!visit || visit.status !== 'booked' || stamp(visit.day, visit.time) <= now())) return fail(404);
    const { serviceId, masterId, offer = '' } = moving ? visit : input;
    const { day, time } = input;
    const service = catalog.services.find(({ id }) => id === serviceId);
    const master = catalog.masters.find(({ id }) => id === masterId);
    const promotion = offer && catalog.news.find(({ id }) => id === offer);
    if (!service || !master || (!moving && !serviceMasters(service).includes(masterId)) ||
        !nextDays(30, now()).includes(day) || (offer && !moving && (promotion?.serviceId !== serviceId ||
          !promotion.until || (promotion.masterId && promotion.masterId !== masterId))) || (promotion?.until && day > promotion.until)) return fail(400);
    if (moving && (visit.day !== input.fromDay || visit.time !== input.fromTime)) return fail(409, 'Запись уже была перенесена.');
    const existing = booking && visits.find(({ id }) => id === input.id);
    if (existing) {
      if (existing.source === (staff ? 'studio' : 'online') && existing.day === day && existing.time === time &&
          existing.serviceId === serviceId && existing.masterId === masterId && existing.offer === offer) return publicVisit(existing);
      return fail(409);
    }
    const duration = moving ? visit.duration : serviceDuration(service, masterId);
    const price = moving ? visit.price : servicePrice(service, masterId);
    if (!moving && ((input.expectedPrice !== undefined && input.expectedPrice !== price) ||
        (input.expectedDuration !== undefined && input.expectedDuration !== duration))) {
      return fail(409, 'Цена или длительность изменилась. Проверьте условия записи.', 'terms_changed');
    }
    const windows = workingHours(masterId, day, master);
    const slots = availableSlots({ day, duration, masterId, windows, bookings: visits.filter(({ id }) => id !== visit?.id), now: now() });
    if (!slots.includes(time)) return fail(409);
    if (moving) Object.assign(visit, { day, time });
    else visits.push({ id: input.id, serviceId, masterId, day, time, duration, price, offer, status: 'booked',
      shareToken: crypto.randomUUID(), source: staff ? 'studio' : 'online', ...sample });
    write(state);
    return publicVisit(moving ? visit : visits.at(-1));
  }

  return {
    request,
    reset() {
      write(fresh());
    },
  };
}
