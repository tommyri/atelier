import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtelierBackup, parseAtelierBackup } from '../../src/lib/atelierBackup.js';

const PUBKEY = 'a'.repeat(64);
const HASH = '1'.repeat(64);

const SNAPSHOT = {
  session: { loggedIn: true, mode: 'nip07', pubkey: PUBKEY, readonly: false },
  profile: { pubkey: PUBKEY, name: 'mira', display_name: 'Mira' },
  settings: { dark: true, accent: '#112233', autoOptimize: false },
  servers: [{ url: 'https://media.example', name: 'Media', status: 'online', latency: 10, used: 1, quota: 2, primary: true }],
  serverPreferenceEvent: null,
  relays: [{ url: 'wss://relay.example', name: 'relay.example', read: true, write: true }],
  relayListEvent: null,
  blobs: [{ hash: HASH, type: 'image/png', size: 4, name: 'avatar.png', url: 'https://media.example/avatar.png', uploaded: '2026-05-05T00:00:00.000Z', server: 'Media' }],
  collections: [{ id: 'profile', name: 'Profile', hashes: [HASH] }],
  uploadJobs: [{ id: 'job', name: 'avatar.png', size: 4, progress: 100, state: 'done', type: 'image/png' }],
};

test('Atelier backups roundtrip through runtime schemas', () => {
  const backup = createAtelierBackup(SNAPSHOT, { createdAt: '2026-05-05T12:00:00.000Z' });
  assert.equal(backup.app, 'atelier');
  assert.equal(backup.version, 1);
  assert.equal(backup.snapshot.settings.dark, true);
  assert.equal(backup.snapshot.settings.accent, '#112233');

  const parsed = parseAtelierBackup(JSON.stringify(backup));
  assert.equal(parsed.createdAt, '2026-05-05T12:00:00.000Z');
  assert.equal(parsed.snapshot.servers[0].url, 'https://media.example');
  assert.equal(parsed.snapshot.relays[0].url, 'wss://relay.example');
  assert.equal(parsed.snapshot.blobs[0].hash, HASH);
});

test('parseAtelierBackup rejects incompatible backup documents', () => {
  assert.throws(() => parseAtelierBackup(JSON.stringify({ app: 'other', version: 1, snapshot: SNAPSHOT })), /not an Atelier backup/);
  assert.throws(() => parseAtelierBackup(JSON.stringify({ app: 'atelier', version: 99, snapshot: SNAPSHOT })), /Unsupported/);
});
