import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES } from './countries.js';
import { WALKS } from './walks.js';

test('walks retain the country-to-coordinate-pairs contract', () => {
  assert.deepEqual(Object.keys(WALKS).sort(), COUNTRIES.map(({ id }) => id).sort());
  for (const [iso, points] of Object.entries(WALKS)) {
    assert.match(iso, /^[A-Z]{2}$/);
    assert.ok(Array.isArray(points) && points.length >= 2, iso);
    assert.equal(new Set(points.map(point => point.join(','))).size, points.length, iso);
    for (const point of points) {
      assert.equal(point.length, 2, iso);
      const [lat, lng] = point;
      assert.ok(Number.isFinite(lat) && Math.abs(lat) <= 90, iso);
      assert.ok(Number.isFinite(lng) && Math.abs(lng) <= 180, iso);
    }
  }
});

test('Namibia stays in Windhoek and Paris stays away from the Eiffel Tower', () => {
  assert.ok(WALKS.NA.every(([lat, lng]) => lat > -22.59 && lat < -22.54 && lng > 17.06 && lng < 17.11));
  assert.ok(WALKS.FR.every(([lat, lng]) => lat > 48.84 && lat < 48.9 && lng > 2.31 && lng < 2.4));
});
