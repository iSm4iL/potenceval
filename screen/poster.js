export const START_TILE = 0;

export function tileCost(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 24) throw new RangeError('Invalid poster tile');
  const row = Math.floor(index / 4);
  const col = index % 4;
  const corner = (row === 0 || row === 5) && (col === 0 || col === 3);
  if (corner) return 6;
  const centre = (row === 2 || row === 3) && (col === 1 || col === 2);
  return centre ? 20 : 12;
}

export function revealTile(openTiles, index) {
  if (openTiles.has(index)) return { opened: false, cost: 0 };
  const cost = tileCost(index);
  openTiles.add(index);
  return { opened: true, cost };
}
