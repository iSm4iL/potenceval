import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {streetViewUrl} from './maps.js';

test('street walks require a key and use documented Embed Street View parameters', () => {
  assert.equal(streetViewUrl([60.17,24.95], '', 'ru'), null);
  const url = new URL(streetViewUrl([60.17,24.95], 'test-key', 'en'));
  assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/embed/v1/streetview');
  assert.equal(url.searchParams.get('key'), 'test-key');
  assert.equal(url.searchParams.get('location'), '60.17,24.95');
  assert.equal(url.searchParams.get('language'), 'en');
  assert.equal(url.searchParams.get('source'), 'outdoor');
  assert.equal(url.searchParams.has('pb'), false);
});

test('the panorama is not covered and sends the origin for restricted keys', () => {
  const html = readFileSync(new URL('./index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html, /class="walk-cover"/);
  assert.match(html, /<iframe[^>]*referrerpolicy="strict-origin-when-cross-origin"[^>]*>/);
  assert.match(html, /<iframe[^>]*allowfullscreen[^>]*>/);
});
