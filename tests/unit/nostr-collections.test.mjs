import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRemoteCollectionEvent,
  collectionShareReference,
  createCollectionEvent,
  markCollectionPublished,
  parseCollectionEvent,
} from '../../src/lib/nostrCollections.js';

const PUBKEY = 'a'.repeat(64);
const HASH = '1'.repeat(64);
const BLOBS = [{ hash: HASH, url: `https://cdn.example/${HASH}.jpg` }];
const COLLECTION = { id: 'photos', d: 'photos', name: 'Photos', desc: 'Best shots', kind: 30003, hashes: [HASH] };

test('createCollectionEvent emits NIP-51 bookmark set tags for Blossom blobs', () => {
  const event = createCollectionEvent(COLLECTION, BLOBS, PUBKEY, { createdAt: 1770000000 });
  assert.equal(event.kind, 30003);
  assert.equal(event.pubkey, PUBKEY);
  assert.deepEqual(event.tags.slice(0, 3), [
    ['d', 'photos'],
    ['title', 'Photos'],
    ['description', 'Best shots'],
  ]);
  assert.deepEqual(event.tags.slice(3), [
    ['r', `https://cdn.example/${HASH}.jpg`],
    ['x', HASH],
  ]);
});

test('parseCollectionEvent restores collection fields and hashes', () => {
  const event = createCollectionEvent(COLLECTION, BLOBS, PUBKEY, { createdAt: 1770000000 });
  const parsed = parseCollectionEvent(JSON.stringify(event));
  assert.equal(parsed.id, 'photos');
  assert.equal(parsed.name, 'Photos');
  assert.equal(parsed.desc, 'Best shots');
  assert.deepEqual(parsed.hashes, [HASH]);
  assert.equal(parsed.eventUpdatedAt, 1770000000);
});

test('applyRemoteCollectionEvent applies newer events and marks older conflicts', () => {
  const newer = createCollectionEvent({ ...COLLECTION, name: 'Remote Photos' }, BLOBS, PUBKEY, { createdAt: 200 });
  const older = createCollectionEvent({ ...COLLECTION, name: 'Old Photos' }, BLOBS, PUBKEY, { createdAt: 50 });
  const current = [{ ...COLLECTION, eventUpdatedAt: 100 }];

  const updated = applyRemoteCollectionEvent(current, newer);
  assert.equal(updated[0].name, 'Remote Photos');
  assert.equal(updated[0].eventUpdatedAt, 200);

  const conflicted = applyRemoteCollectionEvent(current, older);
  assert.equal(conflicted[0].name, 'Photos');
  assert.equal(conflicted[0].conflict.remoteUpdatedAt, 50);
});

test('published collections get event metadata and share references', async () => {
  const event = createCollectionEvent(COLLECTION, BLOBS, PUBKEY, { createdAt: 1770000000 });
  const published = markCollectionPublished(COLLECTION, { ...event, id: 'e'.repeat(64), sig: 'f'.repeat(128) });
  assert.equal(published.remoteEvent.kind, 30003);
  assert.equal(published.publishedAt, '2026-02-02T02:40:00.000Z');
  assert.match(await collectionShareReference(published, PUBKEY, ['wss://relay.example']), /^nostr:naddr/);
  assert.equal(await collectionShareReference(published, 'not-hex'), 'nostr:collection:30003:photos');
});
