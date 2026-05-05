import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProfileEvent,
  parseProfileEvent,
  profileMetadataFromProfile,
  validateProfileFields,
  verifyNip05,
} from '../../src/lib/nostrProfile.js';

const PUBKEY = 'a'.repeat(64);

test('profile metadata maps editable fields into kind 0 content', () => {
  const profile = {
    name: 'mira',
    display_name: 'Mira',
    about: 'Builder',
    picture: 'https://cdn.example/avatar.jpg',
    banner: 'https://cdn.example/banner.jpg',
    nip05: 'mira@example.com',
    lud16: 'mira@getalby.com',
    website: 'https://mira.example',
  };
  assert.deepEqual(profileMetadataFromProfile(profile), profile);
  const event = createProfileEvent(profile, PUBKEY, { createdAt: 1770000000 });
  assert.equal(event.kind, 0);
  assert.equal(event.pubkey, PUBKEY);
  assert.equal(event.created_at, 1770000000);
  assert.deepEqual(JSON.parse(event.content), profile);
});

test('parseProfileEvent restores editable profile fields', () => {
  const event = createProfileEvent({
    name: 'mira',
    display_name: 'Mira Voss',
    about: 'Open media tools',
    picture: 'https://cdn.example/avatar.jpg',
    banner: 'https://cdn.example/banner.jpg',
    nip05: 'mira@example.com',
    lud16: 'mira@getalby.com',
    website: 'https://mira.example',
  }, PUBKEY, { createdAt: 1770000000 });
  const profile = parseProfileEvent(JSON.stringify(event), { followers: 3 });
  assert.equal(profile.pubkey, PUBKEY);
  assert.equal(profile.display_name, 'Mira Voss');
  assert.equal(profile.followers, 3);
  assert.equal(profile.profileEvent.kind, 0);
  assert.equal(profile.profileUpdatedAt, 1770000000);
  assert.equal(profile.nip05Verified, false);
});

test('validateProfileFields returns inline profile validation errors', () => {
  const errors = validateProfileFields({
    name: 'bad name',
    about: 'x'.repeat(501),
    nip05: 'mira',
    lud16: 'mira',
    website: 'ftp://example.com',
    picture: 'blob:avatar',
    banner: '/banner.jpg',
  });
  assert.deepEqual(Object.keys(errors).sort(), ['about', 'banner', 'lud16', 'name', 'nip05', 'picture', 'website']);
  assert.deepEqual(validateProfileFields({
    name: 'mira.voss',
    about: 'ok',
    nip05: 'mira@example.com',
    lud16: 'mira@getalby.com',
    website: 'https://example.com',
    picture: 'https://example.com/avatar.jpg',
    banner: 'https://example.com/banner.jpg',
  }), {});
});

test('verifyNip05 resolves the well-known Nostr name document', async () => {
  const calls = [];
  const ok = await verifyNip05({ nip05: 'mira@example.com' }, PUBKEY, {
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({ names: { mira: PUBKEY } }),
      };
    },
  });
  assert.equal(ok, true);
  assert.equal(calls[0].url, 'https://example.com/.well-known/nostr.json?name=mira');
  assert.equal(calls[0].options.redirect, 'manual');
});
