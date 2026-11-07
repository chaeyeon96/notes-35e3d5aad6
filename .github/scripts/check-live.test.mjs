import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {verifyLive} from './check-live.mjs';

const current = Buffer.from('current encrypted bytes');
const sha = crypto.createHash('sha256').update(current).digest('hex');
const expected = ['index.html', 'offline-list.json', 'sw.js', 'f/image.bin'].map(rel => ({rel, sha}));

test('stale homepage stops before downloading images', async () => {
  const requested = [];
  await assert.rejects(verifyLive(expected, {
    fetchFile: async url => { requested.push(url); return new Response('old deployment'); },
    probeTimeout: 0, log() {},
  }), /New deployment visibility failed/);
  assert.equal(requested.length, 3);
  assert.ok(requested.every(url => !url.includes('image.bin')));
});

test('after probes match, only failed ciphertext is retried', async () => {
  const counts = new Map();
  const result = await verifyLive(expected, {
    fetchFile: async url => {
      const count = (counts.get(url) || 0) + 1;
      counts.set(url, count);
      return new Response(url.includes('image.bin') && count === 1 ? 'old bytes' : current);
    },
    wait: async () => {}, log() {},
  });
  assert.equal(result.files, 4);
  assert.equal(result.bytes, current.length * 4);
  for (const [url, count] of counts) assert.equal(count, url.includes('image.bin') ? 2 : 1);
});
