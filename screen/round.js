export function revealPaidClue(round, opened, key, cost) {
  if (round.done || opened.has(key) || !Number.isInteger(cost) || cost < 0 || round.score < cost) return false;
  opened.add(key);
  round.score -= cost;
  return true;
}
