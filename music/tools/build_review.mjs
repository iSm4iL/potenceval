// Generates one self-contained file, with all metadata and editable choices inline.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PACKS } from '../catalog.js';
import { artistKey, setArtistChoice } from '../review-model.js';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const catalog = JSON.parse(read('data/catalog.json')), config = JSON.parse(read('data/sources.json'));
const output = new URL('review.html', root);
let priorTracks = [];
const baseline = process.argv[2];
if (baseline) priorTracks = JSON.parse(readFileSync(baseline, 'utf8')).tracks.filter(t => t.genres.includes('new-wave'));
else if (existsSync(output)) {
  const match = readFileSync(output, 'utf8').match(/id="review-catalog">([\s\S]*?)<\/script>/);
  if (match) priorTracks = JSON.parse(match[1]).collections.find(c => c.id === 'new-wave')?.tracks || [];
}
const compact = track => ({ id: track.id, deezerId: track.deezerId, title: track.title,
  artistIds: track.artistIds, artistNames: track.artistIds.map((id, i) => config.artistDisplayNames?.[id] || track.artistNames[i]) });
const data = { generatedAt: catalog.generatedAt, collections: PACKS.map(pack => {
  const tracks = new Map((pack.id === 'new-wave' ? priorTracks : []).map(t => [t.id, compact(t)]));
  for (const t of catalog.tracks.filter(t => t.genres.includes(pack.id))) tracks.set(t.id, compact(t));
  return { id: pack.id, title: pack.title, tracks: [...tracks.values()], notice: pack.id === 'new-wave'
    ? 'Ваши удаления уже отмечены красным; эти треки оставлены здесь для проверки, но убраны из игры. Платина, Voskresenskii, kizaru, Markul, OBLADAET и PHARAOH отмечены «Больше». MONEYKEN и Витя АК — оставить. Seven H: точного совпадения нет, требуется уточнить имя.' : '' };
}) };
const state = { version: 1, catalogGeneratedAt: data.generatedAt, updatedAt: 0, tracks: {}, artists: {} };
const tracks = data.collections.find(c => c.id === 'new-wave').tracks;
for (const name of ['Платина', 'Voskresenskii', 'kizaru', 'Markul', 'OBLADAET', 'PHARAOH']) {
  setArtistChoice(state, 'new-wave', artistKey(name), tracks, 'more', true);
}
for (const name of ['MONEYKEN', 'Vitja AK']) setArtistChoice(state, 'new-wave', artistKey(name), tracks, 'status', 'keep');
for (const name of config.collectionExcludeArtists?.['new-wave'] || []) {
  setArtistChoice(state, 'new-wave', artistKey(name), tracks, 'status', 'remove');
  for (const t of tracks.filter(t => t.artistNames.some(n => artistKey(n) === artistKey(name)))) state.tracks['new-wave'][t.id].more = false;
}
state.updatedAt = 0;
const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c');
const model = read('review-model.js').replace(/^export /gm, '');
const app = read('review-app.js').replace(/^import .*\r?\n/gm, '');
const html = read('tools/review-template.html')
  .replace('__CATALOG_DATA__', () => safeJSON(data))
  .replace('__REVIEW_STATE__', () => safeJSON(state))
  .replace('__MODEL_SOURCE__', () => model)
  .replace('__APP_SOURCE__', () => app);
writeFileSync(output, html);
console.log(`Built ${output.pathname}: ${data.collections.length} collections, ${html.length} characters`);
