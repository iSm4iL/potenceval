export function revealPaidClue(round, opened, key, cost) {
  if (round.done || opened.has(key) || !Number.isInteger(cost) || cost < 0 || round.score < cost) return false;
  opened.add(key);
  round.score -= cost;
  return true;
}

// Постер виден целиком, но размыт: каждая покупка делает его чётче. Размытие — в пикселях для кадра ~300px.
export const BLUR = [18, 12, 7, 3, 0];
export const SHARPEN = [10, 15, 20, 25];
