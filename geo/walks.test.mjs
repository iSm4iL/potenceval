import test from 'node:test';
import assert from 'node:assert/strict';
import { WALKS } from './walks.js';

test('walks retain the country-to-coordinate-pairs contract', () => {
  for (const [iso, points] of Object.entries(WALKS)) {
    assert.match(iso, /^[A-Z]{2}$/);
    assert.ok(Array.isArray(points) && points.length > 0, iso);
    for (const point of points) {
      assert.equal(point.length, 2, iso);
      const [lat, lng] = point;
      assert.ok(Number.isFinite(lat) && Math.abs(lat) <= 90, iso);
      assert.ok(Number.isFinite(lng) && Math.abs(lng) <= 180, iso);
    }
  }
});

test('Namibia starts stay near Windhoek, never the namesake museum in Colombo', () => {
  for (const [lat, lng] of WALKS.NA) {
    // Local regression bound, not a general country-boundary or imagery check.
    assert.ok(lat > -22.7 && lat < -22.4 && lng > 16.9 && lng < 17.3,
      `NA start outside Windhoek: ${lat},${lng}`);
  }
  assert.deepEqual(WALKS.NA[0], [-22.567665, 17.087549]);
});
