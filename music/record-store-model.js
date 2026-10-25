import { PACKS } from './catalog.js?v=dead-cover-20261025';

const art = new Map(PACKS.map(pack => [pack.id, pack.art || pack.id]));
export const recordArt = id => `assets/record-store/cover-${art.get(id) || 'new-wave'}.webp`;

export function shelfPage(items, page = 0) {
  const pages = Math.max(1, Math.ceil(items.length / 8));
  page = Math.max(0, Math.min(page, pages - 1));
  return { page, pages, items: items.slice(page * 8, page * 8 + 8), previous: page > 0, next: page < pages - 1 };
}

export function selectionPage(items, selected, previous, page) {
  return selected !== previous ? Math.max(0, Math.floor(items.findIndex(item => item.id === selected) / 8)) : shelfPage(items, page).page;
}
