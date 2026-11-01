// Read-only inventory of the images that the current localized game can display.
// Run with network access: node geo/tools/audit-media.mjs
import { writeFileSync } from 'node:fs';
import { COUNTRIES } from '../countries.js';
import { localizeCountry } from '../i18n.js';
import { PHOTOS } from '../photos.js';

const rows = [];
for (const country of COUNTRIES) {
  const c = localizeCountry(country, 'ru');
  for (const [kind, article] of [['food', c.food[1]], ['person', c.person?.[2]]]) {
    if (!article || !PHOTOS[article]) continue;
    const url = new URL(PHOTOS[article]);
    const parts = url.pathname.split('/');
    const index = parts.indexOf('thumb');
    const file = decodeURIComponent(index < 0 ? parts.at(-1) : parts[index + 3]);
    rows.push({ country: c.id, kind, article, url: PHOTOS[article], file,
      repository: url.pathname.includes('/commons/') ? 'commons' : url.pathname.split('/')[2] });
  }
}
const records = new Map();
for (const repository of [...new Set(rows.map(r => r.repository))]) {
  const files = [...new Set(rows.filter(r => r.repository === repository).map(r => r.file))];
  for (let i = 0; i < files.length; i += 20) {
    const endpoint = repository === 'commons' ? 'commons.wikimedia.org' : `${repository}.wikipedia.org`;
    const url = `https://${endpoint}/w/api.php?` + new URLSearchParams({ action:'query', prop:'imageinfo', iiprop:'url|extmetadata', titles:files.slice(i,i+20).map(f => `File:${f}`).join('|'), format:'json', redirects:'1' });
    const response = await fetch(url, {headers:{'User-Agent':'potenceval-media-review/1.0'}});
    if (!response.ok) throw new Error(`${endpoint}: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    for (const page of Object.values(data.query.pages)) {
      const info = page.imageinfo?.[0];
      if (info) records.set(`${repository}:${page.title.replace(/^File:/,'').replaceAll('_',' ')}`, info);
    }
  }
}
const result = rows.map(row => {
  const info = records.get(`${row.repository}:${row.file.replaceAll('_',' ')}`);
  return {...row, checked:'2026-10-30', sourcePage:info?.descriptionurl || null,
    metadata:info?.extmetadata || null, status:info ? 'metadata-retrieved-not-legally-cleared' : 'unresolved',
    changes:'Wikipedia thumbnail resized by provider; CSS object-fit may crop in the card. Zoom uses the same URL.',
    personalityRights:row.kind === 'person' ? 'Separate assessment required; no endorsement or model release established.' : null,
    replacement:row.kind === 'food' ? 'Commission an original photograph of this dish, with written commercial reuse permission.' : 'Keep this named text clue; commission a portrait with written rights clearance, including the subject where required.'};
});
writeFileSync(new URL('../data/media-audit.json',import.meta.url), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({uses:result.length,files:records.size,unresolved:result.filter(r=>!r.metadata).length}));
