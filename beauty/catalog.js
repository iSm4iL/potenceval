import { salon, news, masters, services, categories, serviceMasters } from './salon.js?v=14b49c6c3395';

export const defaultBrand = { ...salon, icon: '' };
export const initialCatalog = { revision: 0, masters, services, brand: defaultBrand, news, masterContacts: {} };

const validText = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const validId = (value) => typeof value === 'string' && /^[a-z0-9-]{1,48}$/.test(value);
const validDuration = (value) => Number.isInteger(value) && value >= 5 && value <= 480;
const validPrice = (value) => Number.isInteger(value) && value >= 0 && value <= 1000000;
const validPhoto = (value) => typeof value === 'string' && (/^\.\/assets\/[a-z-]+\.webp$/.test(value) ||
  (value.length <= 600000 && /^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+=*$/.test(value)));
const validWindows = (windows) => Array.isArray(windows) && windows.length <= 2 &&
  windows.every((entry, i) => Array.isArray(entry) && entry.length === 2 && entry.every(Number.isInteger) &&
    entry[0] >= 0 && entry[1] <= 1440 && entry[0] < entry[1] && (!i || windows[i - 1][1] <= entry[0]));
const validDate = (day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  new Date(day + 'T00:00:00Z').toJSON()?.slice(0, 10) === day;

export function validBrand(brand) {
  const limits = { name: 26, descriptor: 36, headline: 58, intro: 120, area: 55, address: 95, hours: 100 };
  return brand && Object.entries(limits).every(([key, limit]) => validText(brand[key], limit)) &&
    typeof brand.accent === 'string' && /^#[0-9a-f]{6}$/i.test(brand.accent) && validPhoto(brand.hero) &&
    (brand.logo === '' || validPhoto(brand.logo)) && (brand.icon === '' || (typeof brand.icon === 'string' &&
      brand.icon.length <= 1_500_000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+=*$/.test(brand.icon)));
}

export function validNews(posts, services) {
  return Array.isArray(posts) && posts.length <= 10 && new Set(posts.map((item) => item?.id)).size === posts.length &&
    posts.every((item) => {
      if (!item || !validId(item.id) || !['Событие', 'Новость', 'Акция'].includes(item.type) ||
          !validText(item.title, 70) || !validText(item.detail, 1200) || !validText(item.date, 80) ||
          !validPhoto(item.photo) || (item.poster !== undefined && !validPhoto(item.poster)) ||
          (item.until !== undefined && item.until !== '' && !validDate(item.until))) return false;
      if (item.serviceId === undefined || item.serviceId === '') return item.masterId === undefined;
      const service = services.find(({ id }) => id === item.serviceId);
      return service && item.type === 'Акция' && validDate(item.until) &&
        (!item.masterId || serviceMasters(service).includes(item.masterId));
    });
}

export function validCatalog(value, previous) {
  if (!Array.isArray(value?.masters) || !Array.isArray(value.services) ||
      value.masters.length > 100 || value.services.length > 250) return false;
  const ids = new Set(value.masters.map((master) => master?.id));
  const serviceIds = new Set(value.services.map((service) => service?.id));
  return ids.size === value.masters.length && serviceIds.size === value.services.length &&
    previous.masters.every(({ id }) => ids.has(id)) && previous.services.every(({ id }) => serviceIds.has(id)) &&
    (value.masterContacts === undefined || (value.masterContacts && typeof value.masterContacts === 'object' &&
      !Array.isArray(value.masterContacts) && Object.entries(value.masterContacts).every(([id, contact]) => ids.has(id) && validText(contact, 120)))) &&
    value.masters.every((master) => master && validId(master.id) && validText(master.name, 40) &&
      validText(master.role, 55) && validText(master.bio, 360) && validPhoto(master.photo) &&
      (master.level === undefined || master.level === '' || validText(master.level, 32)) &&
      (!master.schedule || (Array.isArray(master.schedule) && master.schedule.length === 7 && master.schedule.every(validWindows))) &&
      (!master.exceptions || (typeof master.exceptions === 'object' && !Array.isArray(master.exceptions) &&
        Object.keys(master.exceptions).length <= 366 && Object.entries(master.exceptions).every(([day, windows]) => validDate(day) && validWindows(windows))))) &&
    value.services.every((service) => service && validId(service.id) && validText(service.title, 65) &&
      categories.some(({ id }) => id === service.category) && validPrice(service.price) && validDuration(service.duration) &&
      (!service.photo || validPhoto(service.photo)) && Array.isArray(serviceMasters(service)) &&
      serviceMasters(service).length > 0 && serviceMasters(service).every((id) => ids.has(id)) &&
      (service.prices === undefined || (service.prices && typeof service.prices === 'object' && !Array.isArray(service.prices) &&
        Object.entries(service.prices).every(([id, amount]) => serviceMasters(service).includes(id) && validPrice(amount)))) &&
      (!service.durations || (typeof service.durations === 'object' && !Array.isArray(service.durations) &&
        Object.entries(service.durations).every(([id, duration]) => serviceMasters(service).includes(id) && validDuration(duration)))));
}
