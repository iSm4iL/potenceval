import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PHOTO_CREDITS} from './media-credits.js';
import {PHOTOS} from './photos.js';
import {COUNTRIES} from './countries.js';
import {localizeCountry} from './i18n.js';

test('all currently used photos have an existing individual attribution record',()=>{
 const html=readFileSync(new URL('./credits.html',import.meta.url),'utf8');
 for(const raw of COUNTRIES){
  const c=localizeCountry(raw,'ru');
  for(const article of [c.food[1],c.person?.[2]]){
   if(!PHOTOS[article])continue;
   const id=PHOTO_CREDITS[PHOTOS[article]];
   assert.ok(id,article);assert.ok(html.includes(`<article id="${id}">`),article);
  }
 }
 assert.match(html,/article\{display:none\}article:target\{display:block\}/);
 assert.doesNotMatch(html,/<script\b|onerror=/i);
});

test('the official ECB specimen remains the unchanged low-resolution source file',()=>{
 const image=readFileSync(new URL('./assets/banknotes/EUR-ecb-72dpi.jpg',import.meta.url));
 assert.equal(createHash('sha256').update(image).digest('hex'),'4b9b34aedd9e53ab8e8607d7e590b239c39b2fda614b8e57c122cd1355b0f657');
 assert.equal(PHOTO_CREDITS['assets/banknotes/EUR-ecb-72dpi.jpg'],'ecb');
});

test('food photos use explicit reviewed files instead of ambiguous article thumbnails',()=>{
 assert.match(PHOTOS['Тажин'],/Moroccan.*Tagine/);
 assert.doesNotMatch(PHOTOS['Лакса'],/Chicken_curry/);
 assert.doesNotMatch(PHOTOS['en:Cuisine of Papua New Guinea'],/Sago_pancake/);
 assert.equal(PHOTOS['en:Omani cuisine'],null);
});

test('attribution preserves supplied notices and links HTTP Creative Commons licences over HTTPS',()=>{
 const rows=JSON.parse(readFileSync(new URL('./data/media-audit.json',import.meta.url),'utf8'));
 const html=readFileSync(new URL('./credits.html',import.meta.url),'utf8');
 const fish=rows.find(r=>r.file==='Fish_and_chips.jpg');
 const entry=html.match(new RegExp(`<article id="${PHOTO_CREDITS[fish.url]}">([\\s\\S]*?)</article>`))[1];
 assert.match(entry,/© Andrew Dunn/);
 assert.match(entry,/andrewdunnphoto\.com/);
 for(const row of rows){
  const license=row.metadata.LicenseUrl?.value;
  if(!/^http:\/\/creativecommons\.org\//.test(license || ''))continue;
  const record=html.match(new RegExp(`<article id="${PHOTO_CREDITS[row.url]}">([\\s\\S]*?)</article>`))[1];
  assert.ok(record.includes(`href="${license.replace('http:','https:')}"`),row.file);
 }
});
