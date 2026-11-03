import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPcm, confirmedFailure } from './audit_previews.mjs';

test('temporary failure followed by two matching permanent failures confirms removal', () => {
  assert.equal(confirmedFailure(['transient', 'http404', 'http404'].map(status => ({ status }))), true);
  for (const statuses of [['http404'], ['http404', 'playable', 'http404', 'http404'], ['http403', 'http404'], ['transient', 'transient']]) {
    assert.equal(confirmedFailure(statuses.map(status => ({ status }))), false);
  }
});

test('decoded previews must contain sound and a complete longest game snippet', () => {
  const pcm = Buffer.alloc(16 * 8000 * 4);
  for (let i = 0; i < 16 * 8000; i++) pcm.writeFloatLE(.2 * Math.sin(i / 8), i * 4);
  assert.equal(inspectPcm(pcm).status, 'playable');
  assert.equal(inspectPcm(pcm.subarray(0, 14 * 8000 * 4)).status, 'too_short');
  assert.equal(inspectPcm(Buffer.alloc(pcm.length)).status, 'silent');
});
