import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PHOTO_CREDITS} from './media-credits.js';
import {PHOTOS,PERSON_PHOTOS} from './photos.js';
import {COUNTRIES} from './countries.js';
import {localizeCountry} from './i18n.js';
import {BRANDS} from './brands.js';
import {BRAND_MEDIA} from './brand-media.js';

test('every brand has a local logo and individual source record',()=>{
 const records=JSON.parse(readFileSync(new URL('./data/brand-logos.json',import.meta.url),'utf8'));
 const html=readFileSync(new URL('./brand-credits.html',import.meta.url),'utf8');
 for(const id of Object.keys(BRANDS)){
  const photo=BRAND_MEDIA[id];
  assert.ok(photo,`${id}: logo required`);
  assert.match(photo[0],/^assets\/brand-logos\//,id);
  const bytes=readFileSync(new URL(photo[0],import.meta.url));
  if(photo[0].endsWith('.svg')){
   assert.match(bytes.toString('utf8'),/<svg\b/,id);
   assert.doesNotMatch(bytes.toString('utf8'),/<script\b|\bonload\s*=|javascript:/i,id);
  }else{
   assert.equal(bytes.toString('ascii',0,4),'RIFF',id);
   assert.equal(bytes.toString('ascii',8,12),'WEBP',id);
  }
  const source=records.find(r=>r.id===id);
  assert.equal(source?.kind,'logo',id);
  assert.match(photo[2],/^#[a-f\d]{6}$/i,id);
  assert.match(source?.sourcePage||'',/^https:\/\//,id);
  assert.ok(source.author,id);
  assert.ok(html.includes(`<article id="${id}">`),id);
 }
});

test('all currently used photos have an existing individual attribution record',()=>{
 const html=readFileSync(new URL('./credits.html',import.meta.url),'utf8');
 for(const raw of COUNTRIES){
  const c=localizeCountry(raw,'ru');
  for(const src of [PHOTOS[c.food[1]],PERSON_PHOTOS[c.id]]){
   if(!src)continue;
   const id=PHOTO_CREDITS[src];
   assert.ok(id,src);assert.ok(html.includes(`<article id="${id}">`),src);
   assert.ok(readFileSync(new URL(src,import.meta.url)).length>0,src);
  }
  if(c.person)assert.ok(PERSON_PHOTOS[c.id],c.id);
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
 const rows=JSON.parse(readFileSync(new URL('./data/clue-photos.json',import.meta.url),'utf8'));
 const file=key=>rows.find(r=>r.asset===PHOTOS[key])?.file;
 assert.match(file('Тажин'),/Moroccan.*Tagine/);
 assert.doesNotMatch(file('Лакса'),/Chicken.curry/);
 assert.doesNotMatch(file('en:Cuisine of Papua New Guinea'),/Sago.pancake/);
 assert.equal(file('en:Omani cuisine'),'وجبة الشواء العماني.jpg');
});

test('attribution preserves supplied notices and links HTTP Creative Commons licences over HTTPS',()=>{
 const rows=JSON.parse(readFileSync(new URL('./data/clue-photos.json',import.meta.url),'utf8'));
 const html=readFileSync(new URL('./credits.html',import.meta.url),'utf8');
 const fish=rows.find(r=>r.file==='Fish and chips.jpg');
 const entry=html.match(new RegExp(`<article id="${PHOTO_CREDITS[fish.asset]}">([\\s\\S]*?)</article>`))[1];
 assert.match(entry,/©\s+Andrew Dunn/);
 assert.match(entry,/andrewdunnphoto\.com/);
 for(const row of rows){
  const license=row.licenseUrl;
  if(!license)continue;
  assert.doesNotMatch(license,/^http:/);
  const record=html.match(new RegExp(`<article id="${PHOTO_CREDITS[row.asset]}">([\\s\\S]*?)</article>`))[1];
  assert.ok(record.includes(`href="${license}"`),row.file);
 }
});
