import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {banknoteFor,banknoteHTML,BANKNOTES} from './banknotes.js';
import {COUNTRIES} from './countries.js';
import {MONEY} from './content.js';

test('only reviewed local snippets are served and enlargement receives the same safe image',()=>{
  for(const c of COUNTRIES){
    const src=banknoteFor(c.id,MONEY[c.id]);
    if(!src){assert.equal(banknoteHTML(c.id,MONEY[c.id]),'');continue;}
    assert.ok(existsSync(new URL(src,import.meta.url)),c.id);
    const html=banknoteHTML(c.id,MONEY[c.id]);
    assert.ok(html.includes(`src="${src}"`));
    assert.doesNotMatch(html,/https?:|data-original|wikipedia|\.img|<a\b/);
  }
  assert.equal(banknoteFor('BO',MONEY.BO),'assets/banknotes/BO.webp');
  assert.equal(banknoteFor('TJ',MONEY.TJ),'assets/banknotes/TJ.webp');
  assert.equal(banknoteFor('FR',MONEY.FR),banknoteFor('SK',MONEY.SK));
  assert.equal(banknoteFor('HU',MONEY.HU),null);
});
test('crop manifest preserves source evidence and has reviewed bounded regions',()=>{
  const rows=JSON.parse(readFileSync(new URL('./data/banknotes.json',import.meta.url),'utf8'));
  assert.deepEqual(rows.map(r=>r.key).sort(),[...BANKNOTES,'EUR'].sort());
  for(const r of rows){
    const [x,y,right,bottom]=r.crop;
    assert.ok(x>=0&&y>=0&&right<=1&&bottom<=1&&right>x&&bottom>y,r.key);
    assert.match(r.url,/^https:\/\//);assert.ok(r.reviewed);
    assert.ok(existsSync(new URL('../'+r.asset,import.meta.url)),r.key);
  }
});
