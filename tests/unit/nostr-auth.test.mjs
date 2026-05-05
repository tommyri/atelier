import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectNip07Provider,
  hexFromNpub,
  npubFromHex,
  profileFromNostrPublicKey,
  profileFromReadonlyNpub,
  requestNip07PublicKey,
  shortNpub,
} from '../../src/lib/nostrAuth.js';

const PUBKEY = '0'.repeat(63) + '1';

test('detectNip07Provider returns provider with getPublicKey', () => {
  const provider = { getPublicKey() {} };
  assert.equal(detectNip07Provider({ nostr: provider }), provider);
  assert.equal(detectNip07Provider({}), null);
});

test('requestNip07PublicKey validates extension result', async () => {
  assert.equal(await requestNip07PublicKey({ nostr: { getPublicKey: async () => PUBKEY.toUpperCase() } }), PUBKEY);
  await assert.rejects(() => requestNip07PublicKey({ nostr: { getPublicKey: async () => 'bad' } }), /invalid public key/);
});

test('requestNip07PublicKey gives actionable missing extension error', async () => {
  await assert.rejects(() => requestNip07PublicKey({}), /No NIP-07 browser extension/);
});

test('npub derivation and profile defaults are stable', () => {
  const npub = npubFromHex(PUBKEY);
  assert.equal(npub, 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqshp52w2');
  assert.equal(shortNpub(npub), 'npub1qqqq…52w2');

  const profile = profileFromNostrPublicKey(PUBKEY, {});
  assert.equal(profile.pubkey, PUBKEY);
  assert.equal(profile.npubShort, 'npub1qqqq…52w2');
  assert.equal(profile.hexShort, '0000…0001');
});

test('readonly npub mode validates and derives a non-signing profile', () => {
  const npub = npubFromHex(PUBKEY);

  assert.equal(hexFromNpub(npub), PUBKEY);
  assert.equal(hexFromNpub(`nostr:${npub}`), PUBKEY);
  assert.throws(() => hexFromNpub('npub1bad'), /Invalid bech32/);

  const profile = profileFromReadonlyNpub(npub, { picture: 'https://example.test/avatar.jpg' });
  assert.equal(profile.pubkey, PUBKEY);
  assert.equal(profile.display_name, 'Read-only profile');
  assert.equal(profile.about, 'Viewing this public key without signing permissions.');
  assert.equal(profile.picture, 'https://example.test/avatar.jpg');
});
