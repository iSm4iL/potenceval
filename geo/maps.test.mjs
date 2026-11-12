import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {streetViewUrl} from './maps.js';

test('embedded street walks use the shared panorama or configured Street View API', () => {
  const shared = new URL(streetViewUrl([60.17,24.95], '', 'ru'));
  assert.equal(shared.pathname, '/maps/embed');
  assert.equal(shared.searchParams.get('pb'), '!6m7!1m6!2m2!1d60.17!2d24.95!3f0!4f0!5f0.8');
  const url = new URL(streetViewUrl([60.17,24.95], 'test-key', 'en'));
  assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/embed/v1/streetview');
  assert.equal(url.searchParams.get('key'), 'test-key');
  assert.equal(url.searchParams.get('location'), '60.17,24.95');
  assert.equal(url.searchParams.get('language'), 'en');
  assert.equal(url.searchParams.get('source'), 'outdoor');
  assert.equal(url.searchParams.has('pb'), false);
});

test('the address is outside the visible panorama and iframe fullscreen cannot reveal it', () => {
  const html = readFileSync(new URL('./index.html',import.meta.url),'utf8');
  const css = readFileSync(new URL('./board-ui.css',import.meta.url),'utf8');
  assert.doesNotMatch(html, /class="walk-(?:cover|address-mask)"/);
  assert.match(html, /<iframe[^>]*referrerpolicy="strict-origin-when-cross-origin"[^>]*>/);
  assert.match(css, /\.walk-view\{[^}]*overflow:hidden/);
  assert.match(css, /#walkFrame\{[^}]*top:-(\d+)px;height:calc\(100% \+ \1px\)/);
  assert.match(html, /allow="fullscreen 'none'"/);
  assert.doesNotMatch(html, /<iframe[^>]*allowfullscreen/);
});
