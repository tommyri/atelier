import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOSSOM_SERVER_LIST_KIND,
  createServerPreferenceEvent,
  parseServerPreferenceEvent,
  serverPreferenceTags,
  validateServerPreferenceEvent,
} from '../../src/lib/blossomPreferences.js';

const SERVERS = [
  { url: 'https://one.example', name: 'one.example', primary: true },
  { url: 'https://two.example/path', name: 'two.example', primary: false },
];

test('serverPreferenceTags creates ordered BUD-03 server tags', () => {
  assert.deepEqual(serverPreferenceTags(SERVERS), [
    ['server', 'https://one.example'],
    ['server', 'https://two.example'],
  ]);
});

test('createServerPreferenceEvent and parseServerPreferenceEvent roundtrip', () => {
  const event = createServerPreferenceEvent(SERVERS, 'a'.repeat(64), { createdAt: 1770000000 });
  assert.equal(event.kind, BLOSSOM_SERVER_LIST_KIND);
  assert.equal(event.content, '');
  assert.equal(event.created_at, 1770000000);
  assert.deepEqual(event.tags, [
    ['server', 'https://one.example'],
    ['server', 'https://two.example'],
  ]);

  const parsed = parseServerPreferenceEvent(JSON.stringify(event));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].url, 'https://one.example');
  assert.equal(parsed[0].primary, true);
  assert.equal(parsed[1].url, 'https://two.example');
});

test('validateServerPreferenceEvent rejects non server-list events', () => {
  assert.equal(validateServerPreferenceEvent(null), null);
  assert.throws(() => validateServerPreferenceEvent({ kind: 1, tags: [] }), /kind 10063/);
  assert.throws(() => parseServerPreferenceEvent({ kind: 10063, tags: [] }), /at least one server/);
});
