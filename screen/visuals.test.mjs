import test from 'node:test';
import assert from 'node:assert/strict';
import { TITLES } from './catalog.js';
import { EXTRA_TITLES } from './catalog.extra.js';
import { visualFor } from './visuals.js';

test('every playable title has a real poster and source instead of a code illustration', () => {
  for (const title of [...TITLES, ...EXTRA_TITLES]) {
    const visual = visualFor(title);
    assert.match(visual.image || '', /^https:\/\//, title.title);
    assert.match(visual.source || '', /^https:\/\//, title.title);
  }
});
test('anime use anime posters rather than manga volume covers', () => {
  for (const title of [...TITLES, ...EXTRA_TITLES].filter(x => x.category === 'anime')) {
    assert.ok(visualFor(title).image.includes('anilist.co'), title.title);
    for (const alternate of visualFor(title).alternatives || []) {
      assert.ok(!/manga|volume|vol_|tankobon/i.test(alternate.image), `${title.title}: manga fallback`);
    }
  }
});
