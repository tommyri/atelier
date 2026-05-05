import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addServerRecord,
  ensurePrimaryServer,
  markPrimaryServer,
  moveServerRecord,
  normalizeServerUrl,
  removeServerRecord,
} from '../../src/lib/serverConfig.js';

const SERVERS = [
  { url: 'https://one.example', name: 'one.example', status: 'online', latency: 1, used: 0, quota: 10, primary: true },
  { url: 'https://two.example', name: 'two.example', status: 'offline', latency: 0, used: 0, quota: 10, primary: false },
];

test('normalizeServerUrl accepts bare hosts and strips paths', () => {
  assert.equal(normalizeServerUrl(' blossom.example/upload?x=1 '), 'https://blossom.example');
  assert.equal(normalizeServerUrl('http://localhost:3000/'), 'http://localhost:3000');
  assert.throws(() => normalizeServerUrl('ftp://example.com'), /http or https/);
});

test('server operations preserve one primary ranked first', () => {
  const added = addServerRecord(SERVERS, 'https://three.example/files');
  assert.equal(added.length, 3);
  assert.equal(added[0].primary, true);
  assert.equal(added[2].url, 'https://three.example');

  assert.throws(() => addServerRecord(added, 'three.example'), /already/);

  const moved = moveServerRecord(added, 'https://three.example', -1);
  assert.equal(moved[1].url, 'https://three.example');
  assert.equal(moved[0].primary, true);
  assert.equal(moved.filter((server) => server.primary).length, 1);

  const primary = markPrimaryServer(added, 'https://three.example');
  assert.equal(primary[0].url, 'https://three.example');
  assert.equal(primary[0].primary, true);
  assert.equal(primary.filter((server) => server.primary).length, 1);

  const removed = removeServerRecord(primary, 'https://three.example');
  assert.equal(removed[0].url, 'https://one.example');
  assert.equal(removed[0].primary, true);
});

test('ensurePrimaryServer normalizes stale stored primary flags', () => {
  const normalized = ensurePrimaryServer(SERVERS.map((server) => ({ ...server, primary: false })));
  assert.equal(normalized[0].primary, true);
  assert.equal(normalized[1].primary, false);
  assert.throws(() => removeServerRecord([SERVERS[0]], SERVERS[0].url), /at least one/);
});
