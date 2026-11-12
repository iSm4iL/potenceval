import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {banknoteFor,banknoteHTML} from './banknotes.js';
import {PHOTO_CREDITS} from './media-credits.js';
import {COUNTRIES} from './countries.js';
import {MONEY} from './content.js';

test('every country has a local photograph or specimen of its currency with source credit',()=>{
  for(const c of COUNTRIES){
    const currency=MONEY[c.id];
    const src=banknoteFor(c.id,currency);
    const html=banknoteHTML(c.id,currency);
    assert.ok(src,c.id);
    assert.ok(html.includes(`src="${src}"`));
    assert.match(html,/data-zoom/);
    assert.doesNotMatch(html,/https?:|data-original|wikipedia|\.img|<a\b/);
    assert.match(src,/^assets\/banknotes\//);
    assert.ok(existsSync(new URL(src,import.meta.url)),c.id);
    assert.ok(PHOTO_CREDITS[src],c.id);
  }
  assert.notEqual(banknoteFor('RU',MONEY.RU),banknoteFor('BY',MONEY.BY));
  assert.equal(banknoteFor('CH',MONEY.CH),banknoteFor('LI',MONEY.LI));
  assert.equal(banknoteFor('US',MONEY.US),banknoteFor('EC',MONEY.EC));
  assert.equal(banknoteFor('GB',MONEY.GB),'assets/banknotes/sterling-detail.webp');
});
test('the shared euro specimen is the unchanged official ECB file',()=>{
  const src=banknoteFor('FR',MONEY.FR);
  assert.equal(src,'assets/banknotes/EUR-ecb-72dpi.jpg');
  const hash=createHash('sha256').update(readFileSync(new URL(src,import.meta.url))).digest('hex');
  assert.equal(hash,'4b9b34aedd9e53ab8e8607d7e590b239c39b2fda614b8e57c122cd1355b0f657');
});
test('crop manifest preserves source evidence and has reviewed bounded regions',()=>{
  const rows=JSON.parse(readFileSync(new URL('./data/banknotes.json',import.meta.url),'utf8'));
  assert.ok(rows.some(r=>r.asset===`geo/${banknoteFor('GB',MONEY.GB)}`));
  for(const r of rows){
    const [x,y,right,bottom]=r.crop;
    assert.ok(x>=0&&y>=0&&right<=1&&bottom<=1&&right>x&&bottom>y,r.key);
    assert.match(r.url,/^https:\/\//);assert.ok(r.reviewed);
    assert.ok(existsSync(new URL('../'+r.asset,import.meta.url)),r.key);
  }
});
