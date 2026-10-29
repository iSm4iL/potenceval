import test from 'node:test';
import assert from 'node:assert/strict';
import { spherePoint } from './globe.js';
test('sphere maps equator, poles and horizon to equirectangular coordinates', () => {
  assert.equal(spherePoint(0, 0, 0).u, .5);
  assert.equal(spherePoint(0, 0, 0).v, .5);
  assert.equal(spherePoint(0, -1, 0).v, 0);
  assert.equal(spherePoint(0, 1, 0).v, 1);
  assert.equal(spherePoint(-1, 0, 0).u, .25);
  assert.equal(spherePoint(1, 0, 0).u, .75);
  assert.equal(spherePoint(1, 1), null);
  for (let y = -.9; y <= .9; y += .1) for (let x = -.9; x <= .9; x += .1) {
    const p = spherePoint(x, y);
    if (p) assert.ok(p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1 && p.light >= .48 && p.light <= 1.01);
  }
});
