import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBunkerUri, summarizeBunkerUri } from '../../src/lib/nip46Auth.js';
import { validateSession } from '../../src/lib/schemas.js';

const PUBKEY = 'a'.repeat(64);

test('parseBunkerUri extracts signer pubkey, relays, and secret', () => {
  const parsed = parseBunkerUri(`bunker://${PUBKEY}?relay=wss%3A%2F%2Frelay.example.com&relay=wss://relay2.example.com&secret=abc123`);

  assert.equal(parsed.pubkey, PUBKEY);
  assert.deepEqual(parsed.relays, ['wss://relay.example.com', 'wss://relay2.example.com']);
  assert.equal(parsed.secret, 'abc123');
});

test('parseBunkerUri rejects missing relays and invalid pubkeys', () => {
  assert.throws(() => parseBunkerUri(`bunker://${PUBKEY}`), /relay/);
  assert.throws(() => parseBunkerUri('bunker://not-a-pubkey?relay=wss://relay.example.com'), /public key/);
});

test('summarizeBunkerUri provides safe display metadata', () => {
  const summary = summarizeBunkerUri(`bunker://${PUBKEY}?relay=wss://relay.example.com&secret=abc123`);

  assert.deepEqual(summary, {
    remoteSigner: 'aaaaaaaa…aaaa',
    relays: ['wss://relay.example.com'],
    hasSecret: true,
  });
});

test('session schema persists remote signer session only for nip46 mode', () => {
  const session = validateSession({
    loggedIn: true,
    mode: 'nip46',
    pubkey: 'b'.repeat(64),
    remoteSigner: {
      clientPubkey: 'c'.repeat(64),
      clientSecretKey: 'd'.repeat(64),
      remoteSignerPubkey: PUBKEY,
      userPubkey: 'b'.repeat(64),
      relays: ['wss://relay.example.com'],
      secret: 'abc123',
      connectedAt: '2026-05-05T00:00:00.000Z',
    },
  });

  assert.equal(session.remoteSigner.remoteSignerPubkey, PUBKEY);
  assert.equal(validateSession({ ...session, mode: 'nip07' }).remoteSigner, null);
});
