// Natural Earth 1:110m land v5.1.2. Input: ne_110m_land.geojson (public domain).
import { readFileSync, writeFileSync } from 'node:fs';
const world = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const ring = points => points.map(([x, y], i) => `${i ? 'L' : 'M'}${((x + 180) / 360 * 2048).toFixed(1)},${((90 - y) / 180 * 1024).toFixed(1)}`).join('') + 'Z';
const land = world.features.map(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map(p => p.map(ring).join('')).join('')).join('');
const lines = Array.from({length:11}, (_, i) => `<path d="M${(i + 1) * 2048 / 12} 0V1024"/>`).join('') + Array.from({length:5}, (_, i) => `<path d="M0 ${(i + 1) * 1024 / 6}H2048"/>`).join('');
writeFileSync(new URL('../assets/world-map.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 2048 1024"><!-- Natural Earth v5.1.2, public domain; equirectangular projection. --><rect width="2048" height="1024" fill="#386c70"/><path d="${land}" fill="#dfc591" stroke="#9f915e" stroke-width="1.2" fill-rule="evenodd"/><g fill="none" stroke="#f6e4b1" stroke-opacity=".24" stroke-width="1.3">${lines}</g></svg>`);
