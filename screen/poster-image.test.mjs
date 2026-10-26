import test from 'node:test';
import assert from 'node:assert/strict';
import { bindPoster } from './poster-image.js';

function fixture(candidates) {
  const image = Object.assign(new EventTarget(), {src:'',hidden:false,complete:false,naturalWidth:0});
  const retry = Object.assign(new EventTarget(), {hidden:true});
  const message = {hidden:false,textContent:''}, credit = {href:'',textContent:''};
  const ready = [];
  bindPoster({image,retry,message,credit,candidates,onReady:value=>ready.push(value)});
  return {image,retry,message,credit,ready};
}
test('a failed poster tries the real alternative and updates its source credit', () => {
  const f=fixture([{image:'https://one.test/poster.jpg',source:'https://one.test',caption:'One'},{image:'https://two.test/poster.jpg',source:'https://two.test',caption:'Two'}]);
  f.image.dispatchEvent(new Event('error'));
  assert.equal(f.image.src,'https://two.test/poster.jpg'); assert.equal(f.credit.href,'https://two.test');
  f.image.dispatchEvent(new Event('load'));
  assert.equal(f.message.hidden,true); assert.equal(f.image.hidden,false); assert.equal(f.ready.at(-1),true);
});
test('exhausted sources show an explicit failure and retry without replacing the poster with a drawing', () => {
  const f=fixture([{image:'https://one.test/poster.jpg',source:'https://one.test',caption:'One'}]);
  f.image.dispatchEvent(new Event('error'));
  assert.equal(f.image.hidden,true); assert.equal(f.retry.hidden,false); assert.equal(f.ready.at(-1),false);
  assert.match(f.message.textContent,/не загрузился/);
  f.retry.dispatchEvent(new Event('click'));
  assert.equal(f.image.hidden,false); assert.equal(f.retry.hidden,true); assert.equal(f.ready.at(-1),false);
  f.image.dispatchEvent(new Event('load')); assert.equal(f.message.hidden,true);
});
