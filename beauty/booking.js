const pad = (value) => String(value).padStart(2, '0');
export const timeMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const minuteLabel = (minute) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

export function monthGrid(month) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1, 1));
  const monthIdx = date.getUTCMonth();

  let dayOfWeek = date.getUTCDay();
  dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const start = new Date(Date.UTC(year, m - 1, 1 - dayOfWeek));
  const grid = [];

  for (let i = 0; i < 42; i++) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + i);

    if (current.getUTCMonth() === monthIdx) {
      grid.push(current.toISOString().split('T')[0]);
    } else {
      grid.push(null);
    }
  }
  return grid;
}

export function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  const y = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${mm}`;
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function nextDays(count, now = new Date()) {
  return Array.from({ length: count }, (_, offset) => {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    return dateKey(day);
  });
}

export function workloadPercent(windows, visits) {
  const shiftMinutes = windows.reduce((total, [open, close]) => total + close - open, 0);
  if (!shiftMinutes) return null;
  let occupied = 0;
  for (const visit of visits) {
    if (visit.status !== 'booked') continue;
    const start = timeMinutes(visit.time);
    const end = start + visit.duration;
    for (const [open, close] of windows) occupied += Math.max(0, Math.min(end, close) - Math.max(start, open));
  }
  return Math.min(100, Math.ceil(100 * occupied / shiftMinutes));
}

export function availableSlots({ day, duration, masterId, bookings, now = new Date(), windows = [[600, 1200]] }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(duration) || duration <= 0) return [];
  const date = new Date(`${day}T00:00:00`);
  const today = dateKey(now);
  if (dateKey(date) !== day || day < today) return [];

  const slots = [];
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const active = bookings.filter((visit) => (
    visit.masterId === masterId && visit.day === day && visit.status !== 'cancelled'
  ));

  for (const [open, close] of windows) for (let minute = open; minute + duration <= close; minute += 30) {
    if (day === today && minute <= currentMinute) continue;
    const overlaps = active.some(({ time, duration: visitDuration }) => {
      const start = timeMinutes(time);
      return minute < start + visitDuration && start < minute + duration;
    });
    if (!overlaps) slots.push(minuteLabel(minute));
  }
  return slots;
}

export function isValidPhone(phone) {
  return /^(?:\+7|8)[ -]*(?:\(\d{3}\)|\d{3})[ -]*\d{3}[ -]*\d{2}[ -]*\d{2}$/.test(phone.trim());
}
