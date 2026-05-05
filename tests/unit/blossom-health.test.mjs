import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBlossomServer } from '../../src/lib/blossomHealth.js';

function response(status, headers = {}) {
  return {
    status,
    headers: {
      get(name) {
        const key = Object.keys(headers).find((header) => header.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
  };
}

test('inspectBlossomServer detects BUD endpoint capabilities', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, method: options.method });
    if (url.endsWith('/upload')) return response(401, { 'X-Reason': 'Authorization required' });
    if (url.endsWith('/mirror')) return response(204, { Allow: 'OPTIONS, PUT' });
    if (url.endsWith('/media')) return response(200);
    return response(404);
  };

  const inspected = await inspectBlossomServer(
    { url: 'https://media.example.test', name: 'media.example.test', primary: true },
    { fetcher, now: new Date('2026-05-05T12:00:00Z') },
  );

  assert.equal(inspected.status, 'online');
  assert.equal(inspected.lastCheckedAt, '2026-05-05T12:00:00.000Z');
  assert.equal(inspected.capabilities.retrieve, true);
  assert.equal(inspected.capabilities.upload, true);
  assert.equal(inspected.capabilities.uploadPreflight, true);
  assert.equal(inspected.capabilities.requiresAuth, true);
  assert.equal(inspected.capabilities.mirror, true);
  assert.equal(inspected.capabilities.media, true);
  assert.equal(calls.length, 4);
});

test('inspectBlossomServer records offline failures', async () => {
  const inspected = await inspectBlossomServer(
    { url: 'https://offline.example.test', name: 'offline.example.test' },
    { fetcher: async () => { throw new Error('Network failed'); } },
  );

  assert.equal(inspected.status, 'offline');
  assert.equal(inspected.capabilities.retrieve, false);
  assert.match(inspected.lastReason, /Network failed/);
});
