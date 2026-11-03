// Apply only repeatable failures from the fresh preview audit.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { confirmedFailure } from './audit_previews.mjs';
import { PACKS } from '../catalog.js';
import { selectCollection } from '../collection.js';

export function prunePreviews(catalog, config, review, report) {
  const removed = report.results.filter(row => confirmedFailure(row.attempts)).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
  const bad = new Set(removed.map(row => row.id));
  const result = structuredClone({ catalog, config, review });
  result.catalog.tracks = result.catalog.tracks.filter(t => !bad.has(t.deezerId));
  result.config.excludeTracks = [...new Set([...(result.config.excludeTracks || []), ...bad])].sort((a, b) => a - b);
  for (const source of result.config.sources) if (source.tracks) {
    source.tracks = source.tracks.filter(row => {
      const match = /^https:\/\/(?:www\.)?deezer\.com\/track\/(\d+)(?:[/?#]|$)/.exec(row.url || '');
      return !match || !bad.has(Number(match[1]));
    });
  }
  for (const [scope, allowed] of Object.entries(result.config.collectionTrackAllowlist || {})) {
    allowed.ids = allowed.ids.filter(id => !bad.has(id));
    const excludedHere = removed.filter(row => row.sources?.includes(scope)).map(row => row.id);
    allowed.excludedIds = [...new Set([...(allowed.excludedIds || []), ...excludedHere])].sort((a, b) => a - b);
  }
  if (result.review) for (const choices of Object.values(result.review.tracks || {})) {
    for (const id of bad) delete choices[`dz-${id}`];
  }
  for (const source of result.catalog.sources) source.count = result.catalog.tracks.filter(t => t.sources.some(s => s.id === source.id)).length;
  return { ...result, removed };
}

function atomicJSON(path, value) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  renameSync(temp, path);
}

function main() {
  const read = path => JSON.parse(readFileSync(path, 'utf8'));
  const catalog = read('music/data/catalog.json'), config = read('music/data/sources.json');
  const review = read('music/data/player-review.json');
  const report = read('output/music-preview-audit.json');
  const age = Date.now() - Date.parse(report.checkedAt);
  if (!Number.isFinite(age) || age < 0 || age > 6 * 3600000 || !Array.isArray(report.confirmed)) throw Error('A fresh completed audit is required');
  const expected = new Set(PACKS.flatMap(pack => selectCollection(catalog, pack.id).tracks.map(t => t.deezerId)));
  const results = new Map(report.results.map(row => [row.id, row]));
  if (results.size !== report.results.length || expected.size !== results.size || [...expected].some(id => !results.has(id))) throw Error('Audit inventory differs from current playable catalog');
  const updated = prunePreviews(catalog, config, review, report);
  const now = new Date().toISOString();
  updated.catalog.generatedAt = now;
  updated.review.catalogGeneratedAt = now;
  const receipt = { checkedAt: report.checkedAt, audited: expected.size, removed: updated.removed.map(row => ({
    id: row.id, title: row.title, collections: row.sources, reason: row.attempts.at(-1).status, attempts: row.attempts.slice(-2),
  })), unresolved: report.unresolved };
  atomicJSON('music/data/sources.json', updated.config);
  atomicJSON('music/data/catalog.json', updated.catalog);
  atomicJSON('music/data/player-review.json', updated.review);
  atomicJSON('music/data/unavailable-previews.json', receipt);
  console.log(JSON.stringify({ audited: expected.size, removed: receipt.removed.length, unresolved: receipt.unresolved.length }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
