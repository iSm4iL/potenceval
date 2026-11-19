import { availableSlots, isValidPhone, nextDays, monthGrid, shiftMonth, minuteLabel, timeMinutes, workloadPercent } from './booking.js';
import { salon, masters as defaultMasters, categories, services as defaultServices, news, serviceDuration, serviceMasters, servicePrice, workingHours } from './salon.js';

let catalog = { revision: 0, masters: defaultMasters, services: defaultServices, brand: { ...salon, icon: '' }, news };
let services = catalog.services;
const hoursFor = (id, day) => workingHours(id, day, masterById(id));

const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));
const price = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const fullDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
const salonClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: salon.zone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const panel = $('#panel');
const shade = $('.panel-shade');
const main = $('#main');
const bottomNav = $('.bottom-nav');
const title = $('#panel-title');
const caption = $('#panel-caption');
const body = $('#panel-body');
const storageKey = `salon-demo-v1:${new URL('.', location.href).pathname}`;
const demoStorageKey = storageKey + ':preview';
const demo = document.body.hasAttribute('data-demo')
  ? (await import('./demo.js')).createDemo(demoStorageKey, nowAtSalon) : null;
const demoStudio = demo && document.body.hasAttribute('data-demo-studio');
const demoName = 'Анна, тестовый клиент';
const demoPhone = '+7 (900) 000-00-00';

// shortcut: keep legacy profile overrides readable until the first server catalog edit.
function read() {
  try { return JSON.parse(localStorage.getItem(storageKey)) ?? {}; }
  catch { return {}; }
}

function brand() { return catalog.brand; }
function people(settings = catalog) {
  const profiles = read().profiles ?? {};
  return settings.revision ? settings.masters : settings.masters.map((person) => ({ ...person, ...profiles[person.id] }));
}
let clientVisits = [];
let busySlots = [];
let staffVisits = [];
let staffKey = '';
let staffRole = '';
let studioCatalog;
let calendarRequest;
function visits() { return clientVisits; }

async function api(path, options = {}) {
  if (demo) return demo.request(path, options);
  const response = await fetch('./api/' + path, { cache: 'no-store', ...options });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const error = new Error(details.error ?? String(response.status));
    error.status = response.status;
    error.code = details.code;
    throw error;
  }
  return response.json();
}

function refreshCalendar() {
  calendarRequest ??= loadCalendar().finally(() => { calendarRequest = undefined; });
  return calendarRequest;
}

async function loadCalendar() {
  // Establish the client cookie before making any parallel requests.
  clientVisits = await api('visits');
  refreshCount();
  const [busy, settings] = await Promise.all([api('busy'), api('catalog')]);
  busySlots = busy;
  applyCatalog(settings);
}
function applyCatalog(settings) {
  if (settings.revision === catalog.revision || (!demo && settings.revision < catalog.revision)) return;
  catalog = { ...catalog, ...settings };
  services = settings.services;
  renderBrand();
  if (demoStudio) return;
  renderPosters();
  renderHomeServices();
  renderServices();
  renderMasters();
}

function applyStudioCatalog(settings) {
  if (!demo && studioCatalog && settings.revision < studioCatalog.revision) return;
  studioCatalog = settings;
  const { masterContacts, ...publicCatalog } = settings;
  applyCatalog(publicCatalog);
}

function clearStudioAccess() {
  staffKey = '';
  staffRole = '';
  staffVisits = [];
  studioCatalog = undefined;
}
function isUpcoming(visit) {
  return dateOf(visit.day, visit.time) > nowAtSalon();
}
function nowAtSalon() {
  const time = Object.fromEntries(salonClock.formatToParts().map(({ type, value }) => [type, value]));
  return new Date(+time.year, time.month - 1, +time.day, +time.hour, +time.minute);
}
function dateOf(day, time = '12:00') { return new Date(`${day}T${time}:00`); }
function money(service) { return price.format(service.price); }
function priceLabel(service, masterId) {
  if (masterId) return money({ price: servicePrice(service, masterId) });
  const amounts = serviceMasters(service).map((id) => servicePrice(service, id));
  const min = Math.min(...amounts);
  return (Math.max(...amounts) > min ? 'от ' : '') + money({ price: min });
}
function masterRole(person) { return [person.role, person.level].filter(Boolean).join(' · '); }
function masterById(id) { return people().find((person) => person.id === id); }
function serviceById(id) { return services.find((service) => service.id === id); }

let filter = 'all';
let draft;
let studioTab = 'calendar';
let studioDay = '';
let studioMasterId = '';
let studioBookingServiceId = '';
let profileId = defaultMasters[0].id;
let studioServiceId = '';
let studioNewsId;
let panelOpener;
let installPrompt;

function button(label, action, style = 'outline', attributes = '') {
  return `<button type="button" class="button ${style}" data-action="${action}" ${attributes}>${label}</button>`;
}

function refreshCount() {
  const badge = $('#visit-count');
  if (!badge) return;
  const count = visits().filter((visit) => visit.status === 'booked' && isUpcoming(visit)).length;
  badge.textContent = count;
  badge.hidden = count === 0;
}

function readableInk(hex) {
  const channels = hex.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  return luminance > .179 ? '#000000' : '#ffffff';
}

function renderBrand() {
  const config = brand();
  document.documentElement.style.setProperty('--accent', config.accent);
  document.documentElement.style.setProperty('--on-accent', readableInk(config.accent));
  if (demoStudio) {
    document.title = `${config.name} · Демо-кабинет`;
    return;
  }
  document.title = `${config.name} · ${config.descriptor}`;
  const name = $('[data-brand="name"]');
  name.textContent = config.name;
  name.hidden = Boolean(config.logo);
  const logo = $('[data-logo]');
  logo.hidden = !config.logo;
  logo.alt = config.name;
  if (config.logo) logo.src = config.logo;
  else logo.removeAttribute('src');
}

function renderServices() {
  const list = $('#service-list');
  if (!list) return;
  const options = [{ id: 'all', title: 'Все' }, ...categories];
  $('#filters').innerHTML = options.map(({ id, title: label }) => `<button type="button" class="filter"
    data-action="filter" data-value="${id}" aria-pressed="${filter === id}">${label}</button>`).join('');
  const groups = categories.filter(({ id }) => filter === 'all' || id === filter).map(({ id, title }) => {
    const group = services.filter((service) => service.category === id);
    if (!group.length) return '';
    return `<tbody><tr class="price-category"><th scope="rowgroup">${title}</th><th scope="col">Цена и время</th></tr>
      ${group.map((service) => {
        const serviceId = escape(service.id);
        return `<tr class="price-row" data-action="service-book" data-value="${serviceId}">
          <th scope="row">
            <button type="button" class="price-service" aria-haspopup="dialog" aria-describedby="price-${serviceId}">
              <img src="${escape(servicePhoto(service))}" alt="" loading="lazy" width="640" height="640">
              <strong>${escape(service.title)}</strong>
            </button>
          </th>
          <td id="price-${serviceId}" class="price-value"><strong>${priceLabel(service)}</strong><span>${durationLabel(service)} мин</span></td>
        </tr>`;
      }).join('')}</tbody>`;
  }).join('');
  list.innerHTML = groups ? `<table class="price-table" aria-label="Прайс услуг">
    <colgroup><col><col class="price-column"></colgroup>
    ${groups}</table>` : '<p class="notice">В этом разделе пока нет услуг.</p>';
}

function showServices() {
  filter = 'all';
  show('Услуги', `<div id="filters" class="filters" role="group" aria-label="Фильтр услуг"></div>
    <div id="service-list" class="service-grid"></div>`);
  renderServices();
}

const homeServices = $('.home-service-grid');

function serviceCard(service, category = '') {
  return `<button type="button" class="service-card${category ? ' home-service-card' : ''}" aria-haspopup="dialog"
    data-action="service-book" data-value="${escape(service.id)}">
    <img class="service-photo" src="${escape(servicePhoto(service))}" alt="" loading="lazy" width="640" height="640">
    <span>${category ? `<span class="service-category">${escape(category)}</span>` : ''}
    <strong class="service-title">${escape(service.title)}</strong>
    <span class="service-meta"><strong>${priceLabel(service)}</strong><span>·</span><span>${durationLabel(service)} мин</span></span></span>
  </button>`;
}

function renderHomeServices() {
  const focused = homeServices.contains(document.activeElement) ? document.activeElement.dataset.value : '';
  homeServices.innerHTML = categories.map(({ id, title }) => {
    const service = services.find(({ category }) => category === id);
    return service ? serviceCard(service, title) : '';
  }).join('');
  $('.front-services').hidden = !services.length;
  if (focused) homeServices.querySelector(`[data-value="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
}

function servicePhoto(service) {
  return service.photo ?? './assets/' + service.category + '.webp';
}

function durationLabel(service, masterId) {
  if (masterId) return serviceDuration(service, masterId);
  const times = serviceMasters(service).map((id) => serviceDuration(service, id));
  const min = Math.min(...times);
  const max = Math.max(...times);
  return min === max ? min : min + '–' + max;
}

function renderMasters() {
  const list = $('#master-list');
  if (!list) return;
  list.innerHTML = people().map((person) => `<button class="master-card" type="button" aria-haspopup="dialog"
    data-action="profile" data-value="${escape(person.id)}">
    <img src="${escape(person.photo)}" alt="" loading="lazy" width="72" height="72">
    <span class="master-card-body"><strong>${escape(person.name)}</strong><span>${escape(masterRole(person))}</span>
    <small class="master-services">${services.filter((service) => serviceMasters(service).includes(person.id)).map((service) => escape(service.title)).join(' · ')}</small></span>
  </button>`).join('');
}

function showMasters(focus = '') {
  show('Мастера', '<div id="master-list" class="master-grid"></div>');
  renderMasters();
  if (focus) body.querySelector(focus)?.focus();
}

function newsCard(item) {
  return `<button type="button" class="news-card" aria-haspopup="dialog"
    data-action="news" data-value="${escape(item.id)}">
    <img src="${escape(item.photo)}" alt="" loading="lazy" width="640" height="640">
    <span class="news-card-body"><span class="news-card-type">${escape(item.type)}</span>
    <strong>${escape(item.title)}</strong><span class="news-card-date">${escape(item.date)}</span></span>
  </button>`;
}

function currentNews() {
  const today = nextDays(1, nowAtSalon())[0];
  return catalog.news.filter((item) => !item.until || item.until >= today);
}

function renderPosters() {
  const agenda = $('.front-agenda');
  const track = $('#poster-track');
  const dots = $('.poster-dots');
  const items = currentNews();
  const previous = track.children[Math.round(track.scrollLeft / track.clientWidth)]?.querySelector('[data-action="news"]')?.dataset.value;
  const currentIndex = Math.max(0, items.findIndex(({ id }) => id === previous));
  agenda.hidden = !items.length;
  dots.hidden = items.length < 2;
  if (!items.length) { track.replaceChildren(); dots.replaceChildren(); return; }
  const arrows = items.length > 1 ? `
    <button class="poster-edge" type="button" data-step="-1" aria-label="Предыдущая афиша" aria-controls="poster-track"></button>
    <button class="poster-edge" type="button" data-step="1" aria-label="Следующая афиша" aria-controls="poster-track"></button>` : '';
  track.innerHTML = items.map((item) => `<div class="poster-slide">
    <button class="poster-card${item.poster ? ' poster-illustrated' : ''}" type="button" aria-haspopup="dialog"
      data-action="news" data-value="${escape(item.id)}" aria-label="${escape([item.type, item.title, item.date].join(' · '))}">
      <img src="${escape(item.poster ?? item.photo)}" alt="" loading="lazy">
      ${item.poster ? '' : `<span class="poster-copy"><small>${escape(item.type)}</small><strong>${escape(item.title)}</strong><small>${escape(item.date)}</small></span>`}
    </button>
    ${arrows}
  </div>`).join('');
  dots.innerHTML = dots.hidden ? '' : items.map((item, index) => `<button class="poster-dot" type="button" data-slide="${index}"
    aria-label="${escape(item.title)}" aria-controls="poster-track" aria-current="${index === currentIndex}"></button>`).join('');

  function syncControls() {
    const index = Math.round(track.scrollLeft / track.clientWidth);
    const activeDot = dots.children[index];
    const currentDot = dots.querySelector('[aria-current="true"]');
    if (!activeDot || currentDot === activeDot) return;
    currentDot?.setAttribute('aria-current', 'false');
    activeDot.setAttribute('aria-current', 'true');
    updateTabStops(index);
  }
  function updateTabStops(active) {
    for (const [index, slide] of [...track.children].entries()) {
      for (const control of slide.querySelectorAll('button')) control.tabIndex = index === active ? 0 : -1;
    }
  }
  function goToPoster(index) {
    track.scrollTo({ left: track.children[index].offsetLeft });
  }
  updateTabStops(currentIndex);
  track.scrollTo({ left: track.children[currentIndex].offsetLeft, behavior: 'instant' });
  track.onscroll = syncControls;
  track.onkeydown = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const current = Math.round(track.scrollLeft / track.clientWidth);
    const index = (current + (event.key === 'ArrowLeft' ? -1 : 1) + items.length) % items.length;
    event.preventDefault();
    track.children[index].querySelector('.poster-card').focus({ preventScroll: true });
    goToPoster(index);
  };
  track.onclick = (event) => {
    const arrow = event.target.closest('.poster-edge');
    if (!arrow) return;
    const current = [...track.children].indexOf(arrow.closest('.poster-slide'));
    const index = (current + Number(arrow.dataset.step) + items.length) % items.length;
    if (document.activeElement === arrow) {
      track.children[index].querySelector(`[data-step="${arrow.dataset.step}"]`).focus({ preventScroll: true });
    }
    goToPoster(index);
  };
  dots.onclick = (event) => {
    const dot = event.target.closest('.poster-dot');
    if (dot) goToPoster(Number(dot.dataset.slide));
  };
}

function showAgenda(focus = '') {
  const items = currentNews();
  show('Афиша', `<div class="news-grid">${items.map(newsCard).join('') || '<p class="notice">Новых событий и акций пока нет.</p>'}</div>`);
  if (focus) body.querySelector(focus)?.focus();
}

function showContacts() {
  const config = brand();
  const addressQuery = encodeURIComponent(`${config.area}, ${config.address}`);
  show('Контакты', `<div class="contact-card">
    <p class="muted small">${escape(config.area)}</p>
    <address>${escape(config.address)}</address><p>${escape(config.hours)}</p>
    ${demo ? '' : `<a class="button outline" href="https://yandex.ru/maps/?text=${escape(addressQuery)}" target="_blank" rel="noopener noreferrer">Адрес на карте</a>`}
  </div>
  <img id="studio-photo" class="detail-photo contact-photo" src="${escape(config.hero)}" alt="Интерьер студии" width="1320" height="990">
  <div class="panel-actions contact-tools">${button('На экран «Домой»', 'install', 'quiet', 'aria-label="Добавить на экран «Домой»"')}
  ${demo ? '' : button('Кабинет студии', 'studio', 'quiet')}</div>
  <p class="muted small">Демо с вымышленными данными</p>`);
}

function show(heading, html, kicker = '', focus = '', bookingStep = false) {
  const previousScroll = panel.scrollTop;
  panel.classList.toggle('booking-panel', bookingStep);
  title.textContent = heading;
  caption.hidden = !kicker;
  caption.textContent = kicker;
  body.innerHTML = html;
  if (!panel.open) {
    panelOpener = document.activeElement;
    panel.show();
    shade.hidden = false;
    main.inert = true;
  }
  panel.scrollTop = focus ? previousScroll : 0;
  const target = (focus && body.querySelector(focus)) || title;
  target.focus({ preventScroll: true });
  if (focus) target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

async function startBooking(masterId = '', serviceId = '', until = '', offer = '') {
  const current = { masterId, serviceId, until, offer, month: nextDays(1, nowAtSalon())[0].slice(0, 7), day: '', time: '', name: '', phone: '' };
  draft = current;
  showBooking('Онлайн-запись', '<p class="muted small" role="status">Загружаем расписание…</p>');
  try {
    await refreshCalendar();
    if (draft !== current || !panel.open || !panel.classList.contains('booking-panel')) return;
    if (serviceId) selectService(serviceId);
    else chooseService();
  } catch {
    if (draft === current && panel.open && panel.classList.contains('booking-panel')) {
      showBooking('Расписание недоступно', button('Повторить', 'retry-calendar', 'primary'));
    }
  }
}

function showBooking(heading, html, focus = '') {
  show(heading, html, heading === 'Онлайн-запись' ? '' : 'Онлайн-запись', focus, true);
}

function bookingModes(mode) {
  return `<div class="booking-modes" role="group" aria-label="С чего начать запись">
    ${button('Услуги', 'mode-services', 'quiet', `aria-pressed="${mode === 'services'}"`)}
    ${button('Специалисты', 'mode-masters', 'quiet', `aria-pressed="${mode === 'masters'}"`)}
  </div>`;
}

function chooseMaster(focus = '') {
  const service = serviceById(draft.serviceId);
  const options = people().filter((person) => !service || serviceMasters(service).includes(person.id));
  showBooking(service ? 'Выберите мастера' : 'К кому запишемся?',
    `${service ? `<p class="booking-service-name">${escape(service.title)}</p>` : bookingModes('masters')}
    <div class="booking-masters${service ? ' master-rates' : ''}">${options.map((person) => `
    <button type="button" class="master-tile" data-action="choose-master" data-value="${person.id}">
      <img src="${escape(person.photo)}" alt="">
      <span><strong>${escape(person.name)}</strong><small>${escape(service ? person.level || person.role : masterRole(person))}</small></span>
      ${service ? `<span class="master-rate"><strong>${priceLabel(service, person.id)}</strong><small>${serviceDuration(service, person.id)} мин</small></span>` : ''}
    </button>`).join('')}</div>${service ? button('Сменить услугу', 'change-service', 'outline') : ''}`, focus);
}

function chooseService(focus = '') {
  const person = draft.masterId && masterById(draft.masterId);
  const options = services.filter((service) => !person || serviceMasters(service).includes(person.id));
  showBooking('Выберите услугу', `${person ? `<div class="booking-context"><strong>${escape(person.name)}</strong>
    ${button('Сменить мастера', 'mode-masters', 'outline')}</div>` : bookingModes('services')}
    <div class="service-choices">${options.map((option) => `
    <button class="service-tile" type="button" data-action="pick-service" data-value="${option.id}">
      <img src="${escape(servicePhoto(option))}" alt="" width="640" height="640" loading="lazy">
      <span><strong>${escape(option.title)}</strong><small>${priceLabel(option, person?.id)} · ${durationLabel(option, person?.id)} мин</small></span>
    </button>`).join('')}</div>${options.length ? '' : '<p class="notice">У мастера пока нет доступных услуг.</p>'}`, focus);
}

function selectService(id) {
  const eligible = serviceMasters(serviceById(id));
  draft.serviceId = id;
  draft.day = '';
  draft.time = '';
  if (!eligible.includes(draft.masterId)) draft.masterId = '';
  if (draft.masterId) chooseTime();
  else chooseMaster();
}

function chooseTime(message = '', focus = '') {
  const now = nowAtSalon();
  const today = nextDays(1, now)[0];
  const firstMonth = today.slice(0, 7);
  const lastDay = nextDays(30, now).at(-1);
  const deadline = draft.until && draft.until < lastDay ? draft.until : lastDay;
  const lastMonth = deadline.slice(0, 7);
  const person = masterById(draft.masterId);
  const service = serviceById(draft.serviceId);
  const duration = serviceDuration(service, person.id);
  const slotsFor = (day) => availableSlots({ day, duration, masterId: person.id,
    bookings: busySlots, now, windows: hoursFor(person.id, day) });
  const slots = draft.day ? slotsFor(draft.day) : [];
  const grid = monthGrid(draft.month);
  const weekCount = Math.ceil((grid.findLastIndex(Boolean) + 1) / 7);
  const dates = grid.slice(0, weekCount * 7).map((day) => day ? button(
    String(Number(day.slice(-2))), 'day', 'date-button',
    `data-value="${day}" aria-label="${fullDate.format(dateOf(day))}" aria-pressed="${day === draft.day}"
      ${day < today || day > deadline || !slotsFor(day).length ? 'disabled' : ''}`,
  ) : '<span aria-hidden="true"></span>').join('');
  const calendar = `<div class="month-nav">
      ${button('‹', 'month', 'icon outline', 'data-value="-1" aria-label="Предыдущий месяц"' + (draft.month <= firstMonth ? ' disabled' : ''))}
      <h3 id="month-label" tabindex="-1" aria-live="polite">${monthName.format(dateOf(draft.month + '-01'))} ${draft.month.slice(0, 4)}</h3>
      ${button('›', 'month', 'icon outline', 'data-value="1" aria-label="Следующий месяц"' + (draft.month >= lastMonth ? ' disabled' : ''))}
    </div>
    <div class="days" role="group" aria-labelledby="month-label">
      ${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => `<span class="weekday" aria-hidden="true">${day}</span>`).join('')}${dates}
    </div>`;
  const times = ['Утро', 'День', 'Вечер'].map((label, index) => {
    const group = slots.filter((time) => (time < '12:00' ? 0 : time < '17:00' ? 1 : 2) === index);
    if (!group.length) return '';
    return `<div class="slot-group" role="group" aria-label="${label}">
      <p>${label}</p><div class="time-grid">${group.map((time) => button(
        time, 'time', 'time-button', `data-value="${time}" aria-pressed="${draft.time === time}"`,
      )).join('')}</div></div>`;
  }).join('');
  const available = draft.day ? `<div class="booking-face slot-groups">
    <h3 id="times-heading" tabindex="-1">Свободное время · ${fullDate.format(dateOf(draft.day))}</h3>
    ${times || '<p class="notice">На эту дату свободных часов нет.</p>'}</div>` : '';
  const hasSlots = nextDays(30, now).some((day) => day <= deadline && slotsFor(day).length);
  showBooking('Дата и время', `<div class="booking-context">
    <div class="booking-person"><img src="${escape(person.photo)}" alt=""><div><strong>${escape(person.name)}</strong>
    <p>${escape(service.title)} · ${priceLabel(service, person.id)} · ${duration} мин</p></div></div>
  </div><div class="booking-face calendar-face">
    ${message ? `<p class="error" role="alert">${escape(message)}</p>` : ''}
    ${calendar}
    ${hasSlots ? '' : '<p class="notice">На ближайшие даты свободного времени нет.</p>'}
  </div>${available}<div class="panel-actions booking-back">
    ${draft.until ? '' : button('Сменить мастера', 'change-master', 'outline')}
    ${button('Сменить услугу', 'change-service', 'outline')}
  </div>`, focus);
}

function summary(visit) {
  const service = serviceById(visit.serviceId);
  return `<div class="summary">
    <strong>${fullDate.format(dateOf(visit.day))} в ${visit.time}</strong>
    <span>${escape(service.title)} · ${escape(masterById(visit.masterId).name)}</span>
    <span class="muted small">${visit.duration ?? serviceDuration(service, visit.masterId)} мин · ${money({ price: visit.price ?? servicePrice(service, visit.masterId) })}</span>
  </div>`;
}

function field(label, name, value, attributes = '') {
  return `<label class="field">${label}<input name="${name}" value="${escape(value)}" ${attributes}></label>`;
}

function contact(message = '') {
  const person = masterById(draft.masterId);
  const service = serviceById(draft.serviceId);
  showBooking('Подтвердите запись', `<div class="booking-face booking-recap">
    <div class="booking-person"><img src="${escape(person.photo)}" alt=""><div><strong>${escape(person.name)}</strong><p class="muted small">${escape(masterRole(person))}</p></div></div>
    ${summary(draft)}</div>
    <form class="stack" id="booking-form" autocomplete="off" data-price="${servicePrice(service, person.id)}" data-duration="${serviceDuration(service, person.id)}">
      ${field('Имя', 'name', demo ? demoName : draft.name, demo ? 'readonly' : 'required maxlength="50"')}
      ${field('Телефон', 'phone', demo ? demoPhone : draft.phone, (demo ? 'readonly ' : '') + 'type="tel" required maxlength="24" placeholder="+7 (900) 000-00-00" aria-describedby="form-error"')}
      <p class="notice">${demo ? 'Это пробная запись. Она сохранится в этом браузере.' : 'Демо. Введите вымышленные данные или заполните форму примером.'}</p>
      ${demo ? '' : button('Заполнить примером', 'sample', 'outline')}
      <p id="form-error" class="error" role="alert"${message ? '' : ' hidden'}>${escape(message)}</p>
      <div class="panel-actions">${button('Назад', 'back-time', 'quiet')}<button class="button primary" type="submit">Записаться</button></div>
    </form>`);
}

function showError(message) {
  const node = body.querySelector('#form-error');
  node.textContent = message;
  node.hidden = false;
}

async function submitBooking(form) {
  const submit = form.querySelector('[type="submit"]');
  const name = form.elements.name;
  const phone = form.elements.phone;
  name.removeAttribute('aria-invalid');
  phone.removeAttribute('aria-invalid');
  if (name.value.trim().length < 2 || !isValidPhone(phone.value)) {
    const invalid = name.value.trim().length < 2 ? name : phone;
    invalid.setAttribute('aria-invalid', 'true');
    showError(invalid === name ? 'Введите имя из двух или более символов.' : 'Введите номер в формате +7 (900) 000-00-00.');
    invalid.focus();
    return;
  }
  if (!navigator.onLine) return showError('Нет подключения. Повторите, когда появится сеть.');
  submit.disabled = true;
  const current = draft;
  const book = async () => {
    if (!form.isConnected || draft !== current) return;
    const service = serviceById(current.serviceId);
    const { day, time, masterId, serviceId } = current;
    const payload = { day, time, serviceId, masterId, name: name.value.trim(), phone: phone.value.trim(), offer: current.offer,
      expectedPrice: Number(form.dataset.price), expectedDuration: Number(form.dataset.duration) };
    const signature = JSON.stringify(payload);
    if (current.signature !== signature) {
      current.signature = signature;
      current.id = crypto.randomUUID();
    }
    const visit = await api('visits', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id: current.id }) });
    clientVisits = [...clientVisits.filter((entry) => entry.id !== visit.id), visit];
    refreshCalendar().catch(() => {});
    if (!form.isConnected || draft !== current) return;
    draft = undefined;
    refreshCount();
    const person = masterById(masterId);
    const config = brand();
    showBooking('Вы записаны', `<article class="visit-ticket">
      <div class="ticket-date"><strong>${fullDate.format(dateOf(day))}</strong><span>${time}</span></div>
      <div class="booking-person"><img src="${escape(person.photo)}" alt=""><div><strong>${escape(person.name)}</strong><p>${escape(service.title)} · ${visit.duration} мин · ${money(visit)}</p></div></div>
      <p class="ticket-address">${escape(config.address)}</p>
      </article>
      <div class="ticket-actions">${button('Мои записи', 'visits', 'primary')}
        ${demo ? '' : button('Скопировать ссылку на визит', 'copy-visit', 'outline', `data-value="${visit.shareToken}"`)}</div>
      <p id="copy-status" class="muted small" role="status" hidden></p>
      ${button('Новая запись', 'book', 'quiet')}`);
  };
  try {
    await book();
  } catch (error) {
    if (!form.isConnected) return;
    if (error.code === 'terms_changed' || error.message === '409') {
      try {
        await refreshCalendar();
        if (form.isConnected && draft === current) {
          if (error.code === 'terms_changed') contact(error.message);
          else chooseTime('Время уже занято. Выберите другое.');
        }
      } catch {
        if (form.isConnected) showError('Не удалось обновить расписание. Попробуйте ещё раз.');
      }
    } else showError(error.status === 429 ? error.message : 'Подтверждение не получено. Повторите отправку с теми же данными.');
  } finally {
    submit.disabled = false;
  }
}

function visitList(list, source, past = false) {
  if (!list.length) return '<p class="notice">Записей пока нет.</p>';
  const sorted = [...list].sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  if (past) sorted.reverse();
  const current = source === 'studio' ? nowAtSalon() : null;
  return `<div class="stack">${sorted.map((visit) => {
    const share = !demo && source === 'guest' && !past && visit.shareToken;
    const start = dateOf(visit.day, visit.time);
    const cancel = !past && visit.status === 'booked' && (!current || start > current);
    const status = visit.status === 'cancelled' ? 'Отменена' :
      past || (current && start.getTime() + visit.duration * 60_000 <= current.getTime()) ? 'Прошедшая' :
      current && start <= current ? 'Идёт' : 'Подтверждена';
    const when = source === 'studio' && !past
      ? `${visit.time}–${minuteLabel(timeMinutes(visit.time) + visit.duration)}`
      : `${fullDate.format(start)} в ${visit.time}`;
    return `<article class="visit">
      <div class="visit-heading"><strong>${when}</strong><span class="status">${status}</span></div>
      <p><strong>${escape(serviceById(visit.serviceId).title)}</strong><br><span class="muted small">${escape(masterById(visit.masterId).name)}</span></p>
      ${source === 'studio' ? `<p>${escape(visit.name)} · <a href="tel:${escape(visit.phone)}">${escape(visit.phone)}</a><br><span class="muted small">${visit.source === 'studio' ? 'По телефону' : 'Онлайн'}</span></p>` : ''}
      ${share || cancel ? `<div class="panel-actions visit-actions">
        ${share ? button('Скопировать ссылку', 'copy-visit', 'outline', `data-value="${visit.shareToken}"`) : ''}
        ${cancel && source === 'studio' ? button('Перенести', 'studio-visit', 'outline', `data-value="${visit.id}"`) : ''}
        ${cancel ? button('Отменить', 'confirm-cancel', 'danger', `data-value="${visit.id}" data-source="${source}"`) : ''}
      </div>` : ''}
      ${share ? '<p class="copy-status muted small" role="status" hidden></p>' : ''}
    </article>`;
  }).join('')}</div>`;
}

function studioDayPlan(person, visits, windows, now, today) {
  const load = workloadPercent(windows, visits);
  const count = visits.filter(({ status }) => status === 'booked').length;
  const services = studioCatalog.services.filter((service) => serviceMasters(service).includes(person.id));
  const service = services.find(({ id }) => id === studioBookingServiceId) ?? services[0];
  studioBookingServiceId = service?.id ?? '';
  const slots = service ? availableSlots({ day: studioDay, duration: serviceDuration(service, person.id),
    masterId: person.id, bookings: visits, now, windows }) : [];
  return `<section class="stack studio-day-plan" aria-labelledby="studio-day-heading">
    <div><h3 id="studio-day-heading" tabindex="-1">${fullDate.format(dateOf(studioDay))}</h3>
      <p class="muted small">${windows.length ? `Смена ${formatWindows(windows)}` : 'Выходной'}</p>
      <p class="small">Подтверждено: <strong>${count}</strong>${load === null ? '' : ` · Загрузка: <strong>${load}%</strong>`}</p></div>
    <div class="stack"><h4>Визиты за день</h4>${visitList(visits, 'studio')}</div>
    ${studioDay >= today && windows.length ? `<div class="booking-face">
      <h4>Свободные окна</h4>
      ${service ? `<label class="field">Услуга для записи<select id="studio-available-service">
        ${services.map((entry) => `<option value="${escape(entry.id)}" ${entry.id === service.id ? 'selected' : ''}>${escape(entry.title)} · ${serviceDuration(entry, person.id)} мин</option>`).join('')}
      </select></label>
      ${slots.length ? `<div class="time-grid" role="group" aria-label="Свободное время">${slots.map((time) =>
        button(time, 'studio-slot', 'time-button', `data-value="${time}" aria-label="Записать клиента на ${time}"`)).join('')}</div>` :
        '<p class="notice">Для этой услуги свободного времени нет.</p>'}` : '<p class="notice">У мастера пока нет услуг.</p>'}
      </div>` : ''}
  </section>`;
}

function studioCalendar() {
  const masters = people(studioCatalog);
  const person = masters.find(({ id }) => id === studioMasterId) ?? masters[0];
  if (!person) return '<p class="notice">Добавьте мастера, чтобы открыть его календарь.</p>';
  studioMasterId = person.id;
  const now = nowAtSalon();
  const days = nextDays(30, now);
  const today = days[0];
  const last = days.at(-1);
  const visitsByDay = new Map();
  for (const visit of staffVisits) {
    if (visit.masterId !== person.id) continue;
    if (!visitsByDay.has(visit.day)) visitsByDay.set(visit.day, []);
    visitsByDay.get(visit.day).push(visit);
  }
  const firstMonth = [today, ...visitsByDay.keys()].reduce((first, day) => day < first ? day : first).slice(0, 7);
  const lastMonth = last.slice(0, 7);
  if (!studioDay || studioDay < firstMonth + '-01' || studioDay > last) studioDay = today;
  const month = studioDay.slice(0, 7);
  const grid = monthGrid(month);
  const weekCount = Math.ceil((grid.findLastIndex(Boolean) + 1) / 7);
  const cells = grid.slice(0, weekCount * 7).map((day) => {
    if (!day) return '<span aria-hidden="true"></span>';
    const load = workloadPercent(hoursFor(person.id, day), visitsByDay.get(day) ?? []);
    const level = load === null ? 'off' : Math.ceil(load / 20);
    const caption = load === null ? 'Выходной' : `Загрузка ${load}%`;
    return button(`<span>${Number(day.slice(-2))}</span><small>${load === null ? '—' : load + '%'}</small>`, 'studio-date', 'date-button studio-date',
      `data-value="${day}" data-load="${level}" aria-label="${fullDate.format(dateOf(day))}, ${caption}" aria-pressed="${day === studioDay}"
      ${day === today ? 'aria-current="date"' : ''} ${day > last ? 'disabled' : ''}`);
  }).join('');
  return `<div class="studio-roster" role="group" aria-label="Мастер для календаря">
    ${masters.map(({ id, name, photo }) => button(`<img src="${escape(photo)}" alt=""><span>${escape(name)}</span>`,
      'studio-master', 'studio-master', `data-value="${escape(id)}" aria-pressed="${studioMasterId === id}"`)).join('')}
    </div><div class="booking-face studio-month">
      <div class="month-nav">
        ${button('‹', 'studio-month', 'icon outline', `data-value="-1" aria-label="Предыдущий месяц" ${month === firstMonth ? 'disabled' : ''}`)}
        <h3 id="studio-month-label" tabindex="-1">${monthName.format(dateOf(month + '-01'))} ${month.slice(0, 4)}</h3>
        ${button('›', 'studio-month', 'icon outline', `data-value="1" aria-label="Следующий месяц" ${month === lastMonth ? 'disabled' : ''}`)}
      </div>
      <div class="days" role="group" aria-labelledby="studio-month-label">
        ${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => `<span class="weekday" aria-hidden="true">${day}</span>`).join('')}${cells}
      </div>
      <div class="studio-load-key" aria-label="Загрузка от свободной до полной. Серый — выходной.">
        0% <span class="studio-load-scale" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map((level) => `<i data-load="${level}"></i>`).join('')}</span> 100%
        <span class="studio-load-off"><i data-load="off" aria-hidden="true"></i> Выходной</span>
      </div>
    </div>${studioDayPlan(person, visitsByDay.get(studioDay) ?? [], hoursFor(person.id, studioDay), now, today)}`;
}

function updateStudioCalendar(focus) {
  const view = $('#studio-calendar');
  const scrollLeft = view.querySelector('.studio-roster')?.scrollLeft ?? 0;
  view.innerHTML = studioCalendar();
  const roster = view.querySelector('.studio-roster');
  if (roster) roster.scrollLeft = scrollLeft;
  const target = focus && view.querySelector(focus);
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}

function showStudioVisit(id = '', slot = '') {
  const visit = id ? staffVisits.find((entry) => entry.id === id) : undefined;
  if (id && (!visit || visit.status !== 'booked' || !isUpcoming(visit))) return showStudio('Запись уже недоступна для переноса.');
  const dates = nextDays(30, nowAtSalon());
  show(visit ? 'Перенести запись' : 'Записать клиента', `<form class="stack" id="studio-visit-form"
    ${visit ? `data-visit="${visit.id}" data-from-day="${visit.day}" data-from-time="${visit.time}"` :
      slot ? `data-preferred-master="${escape(studioMasterId)}"` : ''}>
    ${visit ? summary(visit) : `<label class="field">Услуга<select name="serviceId" required>
      <option value="">Выберите услугу</option>
      ${services.map((service) => `<option value="${escape(service.id)}" ${slot && service.id === studioBookingServiceId ? 'selected' : ''}>${escape(service.title)}</option>`).join('')}
      </select></label><label class="field">Мастер<select name="masterId" required></select></label>`}
    ${field('Дата', 'day', visit?.day ?? (studioDay || dates[0]), `type="date" min="${dates[0]}" max="${dates.at(-1)}" required`)}
    <label class="field">Свободное время<select name="time" required></select></label>
    ${visit ? '' : `${field('Имя клиента', 'name', demo ? demoName : '', demo ? 'readonly' : 'required minlength="2" maxlength="50"')}
      ${field('Телефон клиента', 'phone', demo ? demoPhone : '', (demo ? 'readonly ' : '') + 'type="tel" required maxlength="24" placeholder="+7 (900) 000-00-00"')}`}
    <p id="form-error" class="error" role="alert" hidden></p><div class="panel-actions">
    ${button('К календарю', 'studio', 'quiet')}<button class="button primary" type="submit">${visit ? 'Перенести' : 'Сохранить запись'}</button></div>
  </form>`);
  updateStudioVisitForm($('#studio-visit-form'), slot);
}

function updateStudioVisitForm(form, slot = '') {
  const { serviceId, masterId, day, time } = form.elements;
  const visit = staffVisits.find(({ id }) => id === form.dataset.visit);
  const service = serviceId && serviceById(serviceId.value);
  if (masterId) {
    const eligible = service ? serviceMasters(service).map(masterById).filter(Boolean) : [];
    const selected = masterId.value || form.dataset.preferredMaster;
    delete form.dataset.preferredMaster;
    masterId.disabled = !eligible.length;
    masterId.innerHTML = `<option value="">${eligible.length ? 'Выберите мастера' : 'Сначала выберите услугу'}</option>` +
      eligible.map((person) => `<option value="${escape(person.id)}">${escape(person.name)} · ${priceLabel(service, person.id)} · ${serviceDuration(service, person.id)} мин</option>`).join('');
    masterId.value = eligible.length === 1 ? eligible[0].id : eligible.some(({ id }) => id === selected) ? selected : '';
  }
  const master = visit?.masterId ?? masterId?.value;
  const duration = visit?.duration ?? (master && service ? serviceDuration(service, master) : 0);
  const slots = availableSlots({ day: day.value, duration, masterId: master, now: nowAtSalon(),
    windows: master ? hoursFor(master, day.value) : [], bookings: staffVisits.filter(({ id }) => id !== visit?.id) })
    .filter((slot) => day.value !== form.dataset.fromDay || slot !== form.dataset.fromTime);
  const selected = slot || time.value;
  time.disabled = !slots.length;
  time.innerHTML = `<option value="">${slots.length ? 'Выберите время' : master ? 'Свободного времени нет' : 'Сначала выберите мастера'}</option>` +
    slots.map((slot) => `<option>${slot}</option>`).join('');
  time.value = slots.includes(selected) ? selected : '';
  form.querySelector('[type="submit"]').disabled = !slots.length || form.dataset.saving === 'true';
}

async function saveStudioVisit(form) {
  if (form.dataset.saving === 'true') return;
  const submit = form.querySelector('[type="submit"]');
  const { visit, fromDay, fromTime } = form.dataset;
  const input = Object.fromEntries(new FormData(form));
  if (visit) Object.assign(input, { fromDay, fromTime });
  else {
    if (!isValidPhone(input.phone)) return showError('Проверьте номер телефона клиента.');
    form.dataset.requestId ??= crypto.randomUUID();
    input.id = form.dataset.requestId;
  }
  const headers = { Authorization: 'Bearer ' + staffKey, 'Content-Type': 'application/json' };
  form.dataset.saving = 'true';
  submit.disabled = true;
  try {
    await api(visit ? 'studio/visits/' + visit : 'studio/visits', { method: visit ? 'PUT' : 'POST', headers, body: JSON.stringify(input) });
    refreshCalendar().catch(() => {});
    if (form.isConnected) {
      studioDay = input.day;
      if (input.masterId) studioMasterId = input.masterId;
      showStudio(visit ? 'Запись перенесена.' : 'Клиент записан.');
    }
  } catch (error) {
    if (!form.isConnected) return;
    showError(error.status === 409 ? (error.message === '409' ? 'Это время уже недоступно. Выберите другое.' : error.message) :
      error.status === 401 ? 'Войдите в кабинет заново.' :
      error.status === 400 ? 'Проверьте данные и дату записи.' : 'Не удалось сохранить запись. Повторите попытку.');
    if (error.status === 409) {
      try {
        staffVisits = await api('studio/visits', { headers });
        if (form.isConnected) updateStudioVisitForm(form);
      } catch { /* The conflict message remains visible, even if a reload fails. */ }
    }
  } finally {
    delete form.dataset.saving;
    if (form.isConnected) submit.disabled = form.elements.time.disabled;
  }
}

async function showVisits() {
  show('Мои записи', '<p role="status">Загружаем записи…</p>');
  try { await refreshCalendar(); }
  catch {
    if (panel.open && title.textContent === 'Мои записи') show('Мои записи', button('Повторить', 'visits'));
    return;
  }
  if (!panel.open || title.textContent !== 'Мои записи') return;
  const list = visits();
  const upcoming = list.filter((visit) => visit.status === 'booked' && isUpcoming(visit));
  const history = list.filter((visit) => !upcoming.includes(visit));
  show('Мои записи', `<div class="guest-visits">${upcoming.length ? visitList(upcoming, 'guest') : '<p class="notice">Предстоящих записей пока нет.</p>'}</div>
    ${history.length ? `<details class="visit-history"><summary>История записей (${history.length})</summary>${visitList(history, 'guest', true)}</details>` : ''}
    <div class="panel-actions">${button('Новая запись', 'book', 'primary')}</div>`);
}

function confirmCancel(id, source) {
  const visit = (source === 'studio' ? staffVisits : visits()).find((item) => item.id === id);
  if (!visit || visit.status !== 'booked') return source === 'studio' ? showStudio() : showVisits();
  show('Отменить запись?', `${summary(visit)}<p class="muted">Это время снова станет доступно для записи.</p>
    <p id="form-error" class="error" role="alert" hidden></p><div class="panel-actions">
    ${button('Оставить запись', source === 'studio' ? 'studio' : 'visits')}
    ${button('Отменить запись', 'cancel', 'danger outline', `data-value="${id}" data-source="${source}"`)}</div>`);
}

async function cancelVisit(id, source, control) {
  control.disabled = true;
  try {
    const studio = source === 'studio';
    await api((studio ? 'studio/' : '') + 'visits/' + id, {
      method: 'DELETE', headers: studio ? { Authorization: 'Bearer ' + staffKey } : {},
    });
    if (!control.isConnected || !panel.open) {
      refreshCalendar().catch(() => {});
      return;
    }
    if (source === 'studio') showStudio('Запись отменена.');
    else showVisits();
  } catch {
    if (control.isConnected && panel.open) showError('Не удалось сохранить отмену. Попробуйте ещё раз.');
  } finally {
    control.disabled = false;
  }
}

function showProfile(id) {
  const person = masterById(id);
  const week = nextDays(7, new Date(2026, 0, 5));
  const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' });
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label, index) => {
    const day = week[index];
    const works = workingHours(id, day, { schedule: person.schedule }).length > 0;
    return `<li data-working="${works}" aria-label="${weekday.format(dateOf(day))}, ${works ? 'работает' : 'выходной'}">
      ${label} <span aria-hidden="true">${works ? '✓' : '—'}</span></li>`;
  }).join('');
  const options = services.filter((service) => serviceMasters(service).includes(id));
  show(person.name, `<div class="profile-intro"><img src="${escape(person.photo)}" alt="" width="80" height="80">
    <p>${escape(person.bio)}</p></div>
    <section class="profile-section" aria-labelledby="profile-days"><h3 id="profile-days">Рабочие дни</h3>
      <ul class="profile-week" role="list">${days}</ul></section>
    <section class="profile-section" aria-labelledby="profile-services"><h3 id="profile-services">Услуги мастера</h3>
      <ul class="profile-services" role="list">${options.map((service) => `<li>
        <button class="button profile-service" type="button" data-action="service-book" data-master="${escape(id)}" data-value="${escape(service.id)}">
          <strong>${escape(service.title)}</strong><span>${priceLabel(service, id)} · ${serviceDuration(service, id)} мин</span>
        </button></li>`).join('')}</ul></section>
    <div class="panel-actions">
      ${button('Все мастера', 'masters', 'outline', `data-value="${id}"`)}
      ${button('Записаться к мастеру', 'master-book', 'primary', `data-value="${id}"`)}</div>`,
  masterRole(person));
}

function showNews(id) {
  const item = catalog.news.find((entry) => entry.id === id);
  if (!item) return showAgenda();
  const service = item.serviceId && serviceById(item.serviceId);
  show(item.title, `<img class="detail-photo" src="${escape(item.photo)}" alt="">
    <p class="news-detail-date">${escape(item.date)}</p><p>${escape(item.detail)}</p>
    <div class="panel-actions">${button('К афише', 'agenda', 'outline', `data-value="${id}"`)}
    ${service && item.until >= nextDays(1, nowAtSalon())[0] ? button('Записаться по акции', 'service-book', 'primary',
      `data-value="${escape(service.id)}" data-master="${escape(item.masterId ?? '')}" data-until="${escape(item.until)}" data-offer="${escape(item.id)}"`) : ''}</div>`, item.type);
}

function showInstall() {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = undefined;
    prompt.prompt().catch(() => showInstall());
    return;
  }
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    show('Приложение уже на экране «Домой»', '<p class="muted">Открывайте студию с иконки приложения.</p>');
    return;
  }
  show('Добавить на экран «Домой»', `
    <p><strong>На iPhone</strong></p>
    <ol><li>Откройте страницу в Safari.</li><li>В меню Safari нажмите «Поделиться».</li>
    <li>Выберите «На экран “Домой”». Если есть переключатель «Открыть как веб-приложение», включите его.</li><li>Нажмите «Добавить».</li></ol>
    <p class="muted">В Chrome и Edge ищите установку приложения в меню браузера. Для установки нужна страница на HTTPS или localhost.</p>
    ${button('К контактам', 'contacts')}`);
}

async function showSharedVisit() {
  const token = location.hash.match(/^#visit=([0-9a-f-]{36})$/i)?.[1];
  if (!token) return;
  show('Ваш визит', '<p role="status">Загружаем запись…</p>');
  try {
    const [visit, settings] = await Promise.all([api('shared-visit', { headers: { Authorization: 'Bearer ' + token } }), api('catalog')]);
    applyCatalog(settings);
    if (!panel.open || title.textContent !== 'Ваш визит') return;
    if (location.hash !== '#visit=' + token) return;
    show(visit.status === 'cancelled' ? 'Запись отменена' : 'Ваш визит',
      summary(visit) + `<p>${escape(brand().address)}</p>`);
  } catch {
    if (panel.open && title.textContent === 'Ваш визит' && location.hash === '#visit=' + token) {
      show('Запись недоступна', '<p>Проверьте ссылку и подключение к сети.</p>');
    }
  }
}

function fileField(label, name) {
  return `<label class="field">${label}<input name="${name}" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>`;
}

function brandForm() {
  const config = studioCatalog.brand;
  return `<form id="brand-form" class="stack">
    ${staffRole === 'owner' ? `${field('Название', 'name', config.name, 'required maxlength="26"')}
    ${field('Подпись в браузере', 'descriptor', config.descriptor, 'required maxlength="36"')}
    ${field('Район', 'area', config.area, 'required maxlength="55"')}
    ${field('Адрес', 'address', config.address, 'required maxlength="95"')}
    ${field('Часы работы', 'hours', config.hours, 'required maxlength="100"')}
    <div class="color-fields">
      ${field('Акцент', 'accent-picker', config.accent, 'type="color"')}
      ${field('Цвет HEX', 'accent', config.accent, 'required pattern="#[0-9a-fA-F]{6}" maxlength="7" spellcheck="false"')}
    </div>
    ${fileField('Логотип', 'logo')}${config.logo ? '<label><input type="checkbox" name="remove-logo"> Убрать текущий логотип</label>' : ''}` : ''}
    ${fileField('Фото студии в контактах', 'hero')}${demo ? '' : fileField('Иконка для экрана «Домой»', 'icon')}
    <p class="muted small">${demo ? 'Изменения сохраняются в этом браузере.' : 'После сохранения изменения увидят все посетители.'}</p>
    <p id="form-error" class="error" role="alert" hidden></p>
    <div class="panel-actions"><button type="submit" class="button primary">Сохранить оформление</button></div>
  </form>`;
}

function newsForm() {
  const { news, services } = studioCatalog;
  const post = studioNewsId === undefined ? news[0] : news.find(({ id }) => id === studioNewsId);
  return `<form id="news-form" class="stack">
    <label class="field">Публикация<select name="post" id="studio-news-select"><option value="">Новая публикация</option>
      ${news.map(({ id, title }) => `<option value="${escape(id)}" ${post?.id === id ? 'selected' : ''}>${escape(title)}</option>`).join('')}</select></label>
    <label class="field">Тип<select name="type">${['Новость', 'Событие', 'Акция'].map((type) =>
      `<option ${post?.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
    ${field('Заголовок', 'title', post?.title ?? '', 'required maxlength="70"')}
    ${field('Дата или подпись на афише', 'date', post?.date ?? '', 'required maxlength="80" placeholder="Например, 28 ноября, 12:00"')}
    ${field('Показывать до (включительно)', 'until', post?.until ?? '', 'type="date"')}
    <label class="field">Описание<textarea name="detail" maxlength="1200" required>${escape(post?.detail ?? '')}</textarea></label>
    ${fileField('Фото для афиши', 'photo')}
    <label class="field">Услуга для акции<select name="serviceId"><option value="">Без привязки</option>
      ${services.map(({ id, title }) => `<option value="${escape(id)}" ${post?.serviceId === id ? 'selected' : ''}>${escape(title)}</option>`).join('')}</select></label>
    <p class="muted small">Укажите срок, если по акции можно записаться напрямую.</p>
    <p id="form-error" class="error" role="alert" hidden></p>
    <div class="panel-actions">${post ? button('Удалить публикацию', 'remove-news', 'danger', `data-value="${escape(post.id)}"`) : ''}
      <button type="submit" class="button primary">Сохранить публикацию</button></div>
  </form>`;
}

function profileForm() {
  const masters = people(studioCatalog);
  const person = masters.find(({ id }) => id === profileId) ?? { name: '', role: '', bio: '' };
  const contacts = studioCatalog.masterContacts;
  const contact = Object.hasOwn(contacts, profileId) ? contacts[profileId] : '';
  return `<form class="stack" id="profile-form">
    <label class="field">Мастер<select name="profile" id="profile-select">
      <option value="">Добавить мастера</option>
      ${masters.map((entry) => `<option value="${entry.id}" ${entry.id === profileId ? 'selected' : ''}>${escape(entry.name)}</option>`).join('')}
    </select></label>
    ${field('Имя', 'name', person.name, 'required maxlength="40"')}
    ${field('Специализация', 'role', person.role, 'required maxlength="55"')}
    ${field('Уровень (по желанию)', 'level', person.level ?? '', 'maxlength="32" placeholder="Например, топ-мастер"')}
    <label class="field">О мастере<textarea name="bio" maxlength="360" required>${escape(person.bio)}</textarea></label>
    ${fileField('Фото мастера', 'photo')}
    ${demo ? '' : field('Рабочий контакт (только в кабинете)', 'contact', contact, 'maxlength="120" placeholder="Телефон, почта или @имя"')}
    <p id="form-error" class="error" role="alert" hidden></p>
    <div class="panel-actions"><button class="button primary" type="submit">Сохранить профиль</button></div>
  </form>`;
}

const weekLabels = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const weekDates = nextDays(7, new Date(2026, 0, 4));
const formatWindows = (windows) => windows.map(([start, end]) => `${minuteLabel(start)}–${minuteLabel(end)}`).join(', ');

function hoursInput(value) {
  if (!value.trim()) return [];
  return value.split(',').map((range) => {
    const match = range.trim().match(/^(\d{2}):([0-5]\d)\s*[-–]\s*(\d{2}):([0-5]\d)$/);
    if (!match || +match[1] > 23 || +match[3] > 24 || (+match[3] === 24 && +match[4])) {
      throw new Error('Укажите интервалы в формате 10:00–14:00, 14:30–20:00.');
    }
    return [+match[1] * 60 + +match[2], +match[3] * 60 + +match[4]];
  });
}

function catalogForm() {
  const masters = people(studioCatalog);
  const { services } = studioCatalog;
  const error = '<p id="form-error" class="error" role="alert" hidden></p>';
  if (studioTab === 'schedule') {
    const person = masters.find(({ id }) => id === profileId) ?? masters[0];
    if (!person) return '<p class="notice">Добавьте мастера, чтобы настроить его расписание.</p>' +
      button('Добавить мастера', 'studio-tab', 'primary', 'data-value="profiles"');
    const hours = person.schedule ?? weekDates.map((day) => workingHours(person.id, day));
    return `<form class="stack" id="schedule-form">
      <label class="field">Мастер<select id="profile-select" name="profile">${masters.map((entry) =>
        `<option value="${entry.id}" ${entry.id === person.id ? 'selected' : ''}>${escape(entry.name)}</option>`).join('')}</select></label>
      <p class="small muted">Пустое поле означает выходной. Перерыв задаётся двумя интервалами.</p>
      ${[1, 2, 3, 4, 5, 6, 0].map((day) => field(weekLabels[day], 'day' + day, formatWindows(hours[day]), 'placeholder="10:00–14:00, 14:30–20:00"')).join('')}
      <details><summary>Изменить часы на конкретную дату</summary>
        ${field('Дата', 'exceptionDay', '', 'type="date"')}
        ${field('Часы на эту дату', 'exceptionHours', '', 'placeholder="Пустое поле — выходной"')}
        <label><input type="checkbox" name="resetException"> Вернуть обычный график на эту дату</label>
        <ul>${Object.entries(person.exceptions ?? {}).sort().map(([day, windows]) =>
          `<li>${escape(day)} · ${formatWindows(windows) || 'Выходной'}</li>`).join('')}</ul>
      </details>${error}<button class="button primary" type="submit">Сохранить расписание</button></form>`;
  }
  const service = services.find(({ id }) => id === studioServiceId);
  return `<form class="stack" id="service-form">
    <label class="field">Услуга<select id="studio-service-select" name="service"><option value="">Добавить услугу</option>
    ${services.map((entry) => `<option value="${entry.id}" ${entry.id === studioServiceId ? 'selected' : ''}>${escape(entry.title)}</option>`).join('')}</select></label>
    ${field('Название', 'title', service?.title ?? '', 'required maxlength="65"')}
    <label class="field">Категория<select name="category">${categories.map(({ id, title }) =>
      `<option value="${id}" ${id === service?.category ? 'selected' : ''}>${title}</option>`).join('')}</select></label>
    ${field('Базовая цена, ₽', 'price', service?.price ?? '', 'type="number" min="0" max="1000000" required')}
    ${field('Базовая длительность, мин', 'duration', service?.duration ?? '', 'type="number" min="5" max="480" required')}
    ${fileField('Фото услуги', 'photo')}
    <fieldset class="stack"><legend>Исполнители</legend><p class="small muted">Если оставить поля пустыми, действуют базовые цена и длительность.</p>
      ${masters.map((person) => `<div><label><input type="checkbox" name="master" value="${person.id}"
        ${service && serviceMasters(service).includes(person.id) ? 'checked' : ''}> ${escape(person.name)}${person.level ? ' · ' + escape(person.level) : ''}</label>
        <div class="performer-fields">
          ${field('Цена для ' + escape(person.name) + ', ₽', 'price-' + person.id, service?.prices?.[person.id] ?? '', 'type="number" min="0" max="1000000"')}
          ${field('Длительность для ' + escape(person.name) + ', мин', 'minutes-' + person.id, service?.durations?.[person.id] ?? '', 'type="number" min="5" max="480"')}
        </div></div>`).join('')}
    </fieldset>${error}<button class="button primary" type="submit">Сохранить услугу</button></form>`;
}

async function saveCatalogForm(form) {
  const data = new FormData(form);
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  const draftCatalog = structuredClone(studioCatalog);
  try {
    if (form.id === 'profile-form') {
      const id = data.get('profile') || crypto.randomUUID();
      const previous = draftCatalog.masters.find((entry) => entry.id === id);
      const photo = await prepareImage(data.get('photo'), 680);
      const person = { ...previous, id, name: data.get('name').trim(), role: data.get('role').trim(),
        level: data.get('level').trim(), bio: data.get('bio').trim(), photo: photo || previous?.photo || salon.hero };
      if (previous) draftCatalog.masters = draftCatalog.masters.map((entry) => entry.id === id ? person : entry);
      else draftCatalog.masters.push(person);
      const contact = (data.get('contact') ?? '').trim();
      if (contact) draftCatalog.masterContacts[id] = contact;
      else delete draftCatalog.masterContacts[id];
    } else if (form.id === 'schedule-form') {
      const person = draftCatalog.masters.find((entry) => entry.id === data.get('profile'));
      person.schedule = weekLabels.map((_, i) => hoursInput(data.get('day' + i)));
      const day = data.get('exceptionDay');
      if (day) {
        person.exceptions ??= {};
        if (data.has('resetException')) delete person.exceptions[day];
        else person.exceptions[day] = hoursInput(data.get('exceptionHours'));
      }
    } else {
      const id = data.get('service') || crypto.randomUUID();
      const previous = draftCatalog.services.find((entry) => entry.id === id);
      const masterIds = data.getAll('master');
      if (!masterIds.length) throw new Error('Выберите хотя бы одного исполнителя.');
      const photo = await prepareImage(data.get('photo'), 680);
      const durations = Object.fromEntries(masterIds.filter((master) => data.get('minutes-' + master) !== '')
        .map((master) => [master, Number(data.get('minutes-' + master))]));
      const prices = Object.fromEntries(masterIds.filter((master) => data.get('price-' + master) !== '')
        .map((master) => [master, Number(data.get('price-' + master))]));
      const service = { ...previous, id, category: data.get('category'), title: data.get('title').trim(),
        price: Number(data.get('price')), duration: Number(data.get('duration')), masterIds, durations, prices,
        ...(photo ? { photo } : {}) };
      if (previous) draftCatalog.services = draftCatalog.services.map((entry) => entry.id === id ? service : entry);
      else draftCatalog.services.push(service);
    }
    if (!form.isConnected) return;
    await publishCatalog(draftCatalog);
    refreshCalendar().catch(() => {});
    if (form.isConnected) {
      if (form.id === 'profile-form') profileId = data.get('profile') || draftCatalog.masters.at(-1).id;
      if (form.id === 'service-form') studioServiceId = data.get('service') || draftCatalog.services.at(-1).id;
      showStudio('Изменения сохранены.');
    }
  } catch (error) {
    if (form.isConnected) showError(error.message);
  } finally {
    submit.disabled = false;
  }
}

async function showStudio(message = '', focus = '') {
  if (demo && !demoStudio) return;
  if (demoStudio && !staffRole) {
    staffKey = 'demo';
    staffRole = 'admin';
  }
  if (!staffKey) {
    show('Вход в кабинет', `<form class="stack" id="staff-form">
      ${field('Ключ доступа', 'key', '', 'type="password" required')}
      <p id="form-error" class="error" role="alert" hidden></p>
      <button type="submit" class="button primary">Войти</button></form>`);
    return;
  }
  if (studioTab === 'calendar') {
    show('Кабинет студии', '<p id="studio-loading" role="status">Загружаем календарь и настройки…</p>');
    const loading = $('#studio-loading');
    const key = staffKey;
    const headers = { Authorization: 'Bearer ' + key };
    try {
      const [visits, settings] = await Promise.all([api('studio/visits', { headers }), api('studio/catalog', { headers })]);
      if (!panel.open || !loading.isConnected || staffKey !== key) return;
      staffVisits = visits;
      applyStudioCatalog(settings);
    } catch (error) {
      if (!panel.open || !loading.isConnected || staffKey !== key) return;
      if (error.status === 401) {
        clearStudioAccess();
        showStudio();
      } else show('Кабинет студии', '<p role="alert">Не удалось загрузить кабинет.</p>' + button('Повторить', 'studio'));
      return;
    }
  }
  const tabs = [['calendar', 'Календарь'], ['news', 'Редактировать афишу']];
  const settings = [['profiles', 'Мастера'], ['services', 'Услуги'], ['schedule', 'Расписание'], ['brand', 'Студия']];
  const tabButton = ([id, label]) => button(label, 'studio-tab', 'filter', `data-value="${id}" aria-pressed="${studioTab === id}"`);
  const content = studioTab === 'calendar' ? `<div id="studio-calendar" class="stack">${studioCalendar()}</div>` :
    studioTab === 'brand' ? brandForm() : studioTab === 'news' ? newsForm() : studioTab === 'profiles' ? profileForm() : catalogForm();
  const control = demoStudio ? button('Сбросить демо', 'demo-reset', 'quiet') : button('Выйти', 'studio-logout', 'quiet');
  show('Кабинет студии', `<div class="studio-tabs" role="group" aria-label="Раздел кабинета">
    <div class="studio-tab-row">${tabs.map(tabButton).join('')}${control}</div>
    <div class="studio-tab-row">${settings.map(tabButton).join('')}</div>
    </div>${message ? `<p class="notice" role="status">${escape(message)}</p>` : ''}${content}`,
    demoStudio ? 'Демо · Администратор' : staffRole === 'owner' ? 'Владелец' : 'Администратор', focus);
}

async function prepareImage(file, maxSize, squareIcon = false) {
  if (!file.size) return '';
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 8_000_000) {
    throw new Error('Выберите изображение JPEG, PNG, WebP или AVIF размером до 8 МБ.');
  }
  const source = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = source;
    await image.decode();
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = squareIcon ? maxSize : Math.max(1, Math.round(image.width * scale));
    canvas.height = squareIcon ? maxSize : Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (squareIcon) {
      const side = Math.min(image.width, image.height);
      context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, maxSize, maxSize);
    } else context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return squareIcon ? canvas.toDataURL('image/png') : canvas.toDataURL('image/webp', .82);
  } catch { throw new Error('Не удалось открыть изображение. Попробуйте другой файл.'); }
  finally { URL.revokeObjectURL(source); }
}

async function publishCatalog(settings) {
  const key = staffKey;
  const result = await api('studio/catalog', { method: 'PUT', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + key,
  }, body: JSON.stringify(settings) });
  if (staffKey === key) applyStudioCatalog(result);
}

async function saveStudioForm(form) {
  const data = new FormData(form);
  const submit = form.querySelector('[type="submit"]');
  const isOwner = staffRole === 'owner';
  const textFields = isOwner ? ['name', 'descriptor', 'area', 'address', 'hours', 'accent'] : [];
  const values = Object.fromEntries(textFields.map((key) => [key, data.get(key).trim()]));
  if (Object.values(values).some((value) => !value)) return showError('Заполните все текстовые поля.');
  const settings = studioCatalog;
  submit.disabled = true;
  try {
    const hero = await prepareImage(data.get('hero'), 1280);
    const logo = isOwner ? await prepareImage(data.get('logo'), 256) : '';
    const icon = demo ? '' : await prepareImage(data.get('icon'), 512, true);
    if (!form.isConnected) return;
    await publishCatalog({ ...settings, brand: { ...settings.brand, ...values,
      hero: hero || settings.brand.hero, logo: logo || (data.has('remove-logo') ? '' : settings.brand.logo), icon: icon || settings.brand.icon } });
    if (form.isConnected) showStudio('Оформление опубликовано.');
  } catch (error) {
    if (form.isConnected) showError(error.message);
  } finally {
    submit.disabled = false;
  }
}

async function saveNewsForm(form) {
  const data = new FormData(form);
  const submit = form.querySelector('[type="submit"]');
  const settings = studioCatalog;
  const previous = settings.news.find(({ id }) => id === data.get('post'));
  const post = Object.fromEntries(['type', 'title', 'date', 'until', 'detail', 'serviceId'].map((key) => [key, data.get(key).trim()]));
  if (post.serviceId && (post.type !== 'Акция' || !post.until)) return showError('Привязать услугу можно к акции с указанным сроком.');
  if (!previous && settings.news.length >= 10) return showError('Можно хранить до 10 публикаций. Удалите одну из старых.');
  submit.disabled = true;
  try {
    const photo = await prepareImage(data.get('photo'), 1000);
    if (!form.isConnected) return;
    if (!photo && !previous) return showError('Добавьте фото для новой публикации.');
    post.id = previous?.id ?? crypto.randomUUID();
    post.photo = photo || previous.photo;
    if (previous?.poster && !photo && ['title', 'type', 'date'].every((key) => post[key] === previous[key])) post.poster = previous.poster;
    if (post.serviceId && post.serviceId === previous?.serviceId && previous.masterId) post.masterId = previous.masterId;
    const updated = previous ? settings.news.map((item) => item.id === post.id ? post : item) : [post, ...settings.news];
    await publishCatalog({ ...settings, news: updated });
    if (form.isConnected) { studioNewsId = post.id; showStudio('Публикация сохранена.'); }
  } catch (error) {
    if (form.isConnected) showError(error.message);
  } finally {
    submit.disabled = false;
  }
}

const actions = {
  'close-panel': () => panel.close(),
  book: () => startBooking(),
  'service-book': ({ value, master, until, offer }) => startBooking(master, value, until, offer),
  'retry-calendar': () => startBooking(draft.masterId, draft.serviceId, draft.until, draft.offer),
  'master-book': ({ value }) => startBooking(value),
  'choose-master': ({ value }) => {
    draft.masterId = value;
    if (draft.serviceId) chooseTime();
    else chooseService();
  },
  'mode-masters': () => {
    draft.masterId = '';
    draft.serviceId = '';
    draft.until = '';
    draft.offer = '';
    chooseMaster('[data-action="mode-masters"]');
  },
  'mode-services': () => {
    draft.masterId = '';
    draft.serviceId = '';
    draft.until = '';
    draft.offer = '';
    chooseService('[data-action="mode-services"]');
  },
  'back-time': () => chooseTime('', `[data-action="time"][data-value="${draft.time}"]`),
  'change-master': () => {
    draft.masterId = '';
    draft.day = '';
    draft.time = '';
    chooseMaster();
  },
  month: ({ value }) => {
    draft.month = shiftMonth(draft.month, Number(value));
    draft.day = '';
    draft.time = '';
    const days = nextDays(30, nowAtSalon());
    const last = draft.until && draft.until < days.at(-1) ? draft.until : days.at(-1);
    const boundary = (value === '-1' ? days[0] : last).slice(0, 7);
    chooseTime('', draft.month === boundary ? '#month-label' : `[data-action="month"][data-value="${value}"]`);
  },
  day: ({ value }) => {
    draft.day = value;
    draft.time = '';
    chooseTime('', '#times-heading');
  },
  'pick-service': ({ value }) => selectService(value),
  'change-service': () => {
    draft.masterId = '';
    draft.serviceId = '';
    draft.until = '';
    draft.offer = '';
    draft.day = '';
    draft.time = '';
    chooseService();
  },
  time: ({ value }) => {
    draft.time = value;
    contact();
  },
  sample: () => {
    const form = $('#booking-form');
    form.elements.name.value = draft.name = 'Анна';
    form.elements.phone.value = draft.phone = '+7 (900) 000-00-00';
    for (const input of form.querySelectorAll('[aria-invalid]')) input.removeAttribute('aria-invalid');
    $('#form-error').hidden = true;
    form.querySelector('[type="submit"]').focus();
  },
  filter: ({ value }) => {
    filter = value;
    renderServices();
    panel.scrollTop = 0;
    $(`#filters [data-value="${value}"]`).focus();
  },
  profile: ({ value }) => showProfile(value),
  services: showServices,
  masters: ({ value }) => showMasters(value ? `[data-value="${value}"]` : ''),
  agenda: ({ value }) => showAgenda(value ? `[data-value="${value}"]` : ''),
  contacts: showContacts,
  news: ({ value }) => showNews(value),
  visits: showVisits,
  'copy-visit': async ({ value }, control) => {
    const url = new URL('.', location.href);
    url.hash = 'visit=' + value;
    const feedback = control.closest('.visit')?.querySelector('.copy-status') ?? $('#copy-status');
    feedback.hidden = false;
    try {
      await navigator.clipboard.writeText(url.href);
      feedback.textContent = 'Ссылка скопирована.';
    } catch {
      const link = document.createElement('a');
      link.href = url.href;
      link.textContent = url.href;
      feedback.replaceChildren(link);
    }
  },
  'confirm-cancel': ({ value, source }) => confirmCancel(value, source),
  cancel: ({ value, source }, control) => cancelVisit(value, source, control),
  install: showInstall,
  studio: () => { studioTab = 'calendar'; showStudio(); },
  'demo-reset': () => {
    if (!demoStudio || !confirm('Сбросить изменения и пробные записи в этом браузере?')) return;
    demo.reset();
    location.reload();
  },
  'studio-visit': ({ value }) => showStudioVisit(value),
  'studio-master': ({ value }) => {
    studioMasterId = value;
    updateStudioCalendar(`.studio-master[data-value="${CSS.escape(value)}"]`);
  },
  'studio-date': ({ value }) => { studioDay = value; updateStudioCalendar('#studio-day-heading'); },
  'studio-month': ({ value }) => {
    studioDay = shiftMonth(studioDay.slice(0, 7), Number(value)) + '-01';
    updateStudioCalendar('#studio-month-label');
  },
  'studio-slot': ({ value }) => showStudioVisit('', value),
  'studio-tab': ({ value }) => { studioTab = value; showStudio('', `[data-value="${value}"]`); },
  'studio-logout': () => {
    clearStudioAccess();
    showStudio();
  },
  'remove-news': async ({ value }, control) => {
    if (!confirm('Удалить эту публикацию с сайта?')) return;
    control.disabled = true;
    try {
      await publishCatalog({ ...studioCatalog, news: studioCatalog.news.filter(({ id }) => id !== value) });
      if (control.isConnected) { studioNewsId = ''; showStudio('Публикация удалена.'); }
    } catch (error) {
      if (control.isConnected) showError(error.message);
    } finally {
      control.disabled = false;
    }
  },
};

document.addEventListener('click', (event) => {
  const control = event.target.closest('[data-action]');
  if (!control || control.disabled) return;
  const switching = panel.open && bottomNav?.contains(control);
  actions[control.dataset.action]?.(control.dataset, control);
  if (panel.open && !panel.contains(control) && control.isConnected) {
    panelOpener = control;
    bottomNav?.querySelector('[aria-expanded="true"]')?.setAttribute('aria-expanded', 'false');
    if (bottomNav?.contains(control)) control.setAttribute('aria-expanded', 'true');
  }
  if (switching && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    body.getAnimations().forEach((animation) => animation.cancel());
    body.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], {
      duration: 180, easing: 'ease-out',
    });
  }
});
shade.addEventListener('click', () => panel.close());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && panel.open) {
    event.preventDefault();
    panel.close();
  }
});
body.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (event.target.id === 'booking-form') {
    submitBooking(event.target);
    return;
  }
  if (event.target.id === 'studio-visit-form') { saveStudioVisit(event.target); return; }
  if (event.target.id === 'staff-form') {
    const form = event.target;
    const key = form.elements.key.value.trim();
    try {
      const { role } = await api('studio/access', { headers: { Authorization: 'Bearer ' + key } });
      if (!panel.open || !form.isConnected) return;
      staffKey = key;
      staffRole = role;
      studioTab = 'calendar';
      showStudio();
    } catch (error) {
      if (form.isConnected) showError(error.status === 429 ? error.message : 'Не удалось войти. Проверьте ключ доступа.');
    }
    return;
  }
  if (event.target.id === 'brand-form') saveStudioForm(event.target);
  else if (event.target.id === 'news-form') saveNewsForm(event.target);
  else saveCatalogForm(event.target);
});
body.addEventListener('input', ({ target }) => {
  if (target.form?.id === 'booking-form') draft[target.name] = target.value;
  if (target.form?.id === 'studio-visit-form') delete target.form.dataset.requestId;
  if (target.name === 'accent-picker') target.form.elements.accent.value = target.value;
  if (target.name === 'accent' && /^#[0-9a-f]{6}$/i.test(target.value)) {
    target.form.elements['accent-picker'].value = target.value;
  }
});
body.addEventListener('change', ({ target }) => {
  if (target.id === 'studio-available-service') {
    studioBookingServiceId = target.value;
    updateStudioCalendar('#studio-available-service');
  }
  if (target.form?.id === 'studio-visit-form' && ['serviceId', 'masterId', 'day'].includes(target.name)) updateStudioVisitForm(target.form);
  if (target.id === 'profile-select') { profileId = target.value; showStudio('', '#profile-select'); }
  if (target.id === 'studio-service-select') { studioServiceId = target.value; showStudio('', '#studio-service-select'); }
  if (target.id === 'studio-news-select') { studioNewsId = target.value; showStudio('', '#studio-news-select'); }
});
panel.addEventListener('close', () => {
  if (panel.open) return;
  if (demoStudio) { location.replace('./'); return; }
  shade.hidden = true;
  main.inert = false;
  bottomNav.querySelector('[aria-expanded="true"]')?.setAttribute('aria-expanded', 'false');
  draft = undefined;
  if (/^#visit=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  const opener = panelOpener?.matches('.home-service-card') && !panelOpener.isConnected
    ? homeServices.querySelector(`[data-value="${CSS.escape(panelOpener.dataset.value)}"]`) ?? $('.start-booking')
    : panelOpener;
  opener?.focus({ preventScroll: true });
  body.replaceChildren();
});
window.addEventListener('storage', ({ key }) => {
  if (demo && key === demoStorageKey) {
    if (demoStudio && $('#studio-calendar')) {
      staffVisits = demo.request('studio/visits');
      applyStudioCatalog(demo.request('studio/catalog'));
      updateStudioCalendar();
    } else if (!demoStudio) refreshCalendar().catch(() => {});
    return;
  }
  if (key !== storageKey) return;
  renderBrand();
  if (!demoStudio) renderMasters();
  refreshCount();
});
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; });

renderBrand();
if (demoStudio) showStudio();
else {
  renderPosters();
  renderHomeServices();
  refreshCount();
  refreshCalendar().catch(() => {});
  showSharedVisit();
  window.addEventListener('hashchange', showSharedVisit);
}
if (!demo && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
