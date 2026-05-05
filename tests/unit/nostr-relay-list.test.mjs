import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOSTR_RELAY_LIST_KIND,
  addRelayRecord,
  createRelayListEvent,
  moveRelayRecord,
  normalizeRelayUrl,
  parseRelayListEvent,
  relayListTags,
  relayPublishUrls,
  removeRelayRecord,
  validateRelayListEvent,
  validateRelayRecord,
} from '../../src/lib/nostrRelayList.js';

test('relay URLs normalize to WebSocket relay URLs', () => {
  assert.equal(normalizeRelayUrl('relay.example.com/'), 'wss://relay.example.com');
  assert.equal(normalizeRelayUrl('WSS://Relay.Example.Com:443/path/?q=1'), 'wss://relay.example.com/path');
  assert.throws(() => normalizeRelayUrl('https://relay.example.com'), /ws/);
});

test('relay list tags encode read and write markers', () => {
  const relays = [
    validateRelayRecord({ url: 'wss://both.example', read: true, write: true }),
    validateRelayRecord({ url: 'wss://read.example', read: true, write: false }),
    validateRelayRecord({ url: 'wss://write.example', read: false, write: true }),
  ];
  assert.deepEqual(relayListTags(relays), [
    ['r', 'wss://both.example'],
    ['r', 'wss://read.example', 'read'],
    ['r', 'wss://write.example', 'write'],
  ]);
  assert.deepEqual(relayPublishUrls(relays), ['wss://both.example', 'wss://write.example']);
});

test('relay list events roundtrip through NIP-65 kind 10002', () => {
  const event = createRelayListEvent([
    { url: 'wss://both.example', read: true, write: true },
    { url: 'wss://read.example', read: true, write: false },
  ], 'a'.repeat(64), { createdAt: 1770000000 });

  assert.equal(event.kind, NOSTR_RELAY_LIST_KIND);
  assert.equal(event.content, '');
  assert.deepEqual(event.tags, [
    ['r', 'wss://both.example'],
    ['r', 'wss://read.example', 'read'],
  ]);

  const parsed = parseRelayListEvent(JSON.stringify(event));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].read, true);
  assert.equal(parsed[0].write, true);
  assert.equal(parsed[1].read, true);
  assert.equal(parsed[1].write, false);
});

test('relay record list operations preserve order and uniqueness', () => {
  let relays = [];
  relays = addRelayRecord(relays, 'one.example');
  relays = addRelayRecord(relays, 'two.example');
  assert.throws(() => addRelayRecord(relays, 'wss://one.example'), /already/);
  assert.equal(moveRelayRecord(relays, 'two.example', -1)[0].url, 'wss://two.example');
  assert.deepEqual(removeRelayRecord(relays, 'one.example').map(relay => relay.url), ['wss://two.example']);
});

test('relay list event validation rejects incompatible events', () => {
  assert.equal(validateRelayListEvent(null), null);
  assert.throws(() => validateRelayListEvent({ kind: 1, tags: [] }), /kind 10002/);
  assert.throws(() => parseRelayListEvent({ kind: 10002, tags: [] }), /at least one r tag/);
});
