import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  validateArray,
  validateBlob,
  validateProfile,
  validateStoreSnapshot,
  validateServer,
  validateSettings,
  validateUploadJob,
} from '../../src/lib/schemas.js';
import { ATELIER_SERVERS } from '../../src/data.js';

const SAMPLE_BLOB = {
  hash: '7a3f2b1c8d4e5f60a91b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071',
  type: 'image/jpeg',
  size: 100,
  name: 'sample.jpg',
  url: 'https://media.example/sample.jpg',
  uploaded: '2026-05-05T00:00:00.000Z',
  server: 'media.example',
};

test('static server suggestions and empty profile satisfy runtime schemas', () => {
  assert.equal(validateArray(ATELIER_SERVERS, validateServer, 'servers').length, ATELIER_SERVERS.length);
  assert.equal(validateProfile({}).display_name, 'Anonymous');
  assert.equal(validateProfile({}).pubkey, '');
});

test('settings schema fills missing booleans from defaults', () => {
  assert.deepEqual(validateSettings({ mirror: false }), {
    ...DEFAULT_SETTINGS,
    mirror: false,
  });
  assert.equal(validateSettings({ metadataWarnings: false }).metadataWarnings, false);
  assert.equal(validateSettings({ requireCleanImages: true }).requireCleanImages, true);
});

test('blob schema rejects invalid hashes', () => {
  assert.throws(() => validateBlob({ ...SAMPLE_BLOB, hash: 'not-a-hash' }), /sha256/);
});

test('server schema normalizes trailing slashes and default names', () => {
  const server = validateServer({ url: 'example.com/path?ignored=1', status: 'online' });
  assert.equal(server.url, 'https://example.com');
  assert.equal(server.name, 'example.com');
  assert.equal(server.primary, false);
});

test('upload job schema clamps progress', () => {
  const job = validateUploadJob({
    name: 'demo.jpg',
    type: 'image/jpeg',
    size: 10,
    progress: 140,
    state: 'uploading',
  });
  assert.equal(job.progress, 100);
  assert.equal(job.state, 'uploading');
});

test('store snapshot schema accepts relay list state', () => {
  const snapshot = validateStoreSnapshot({
    session: {},
    profile: {},
    settings: {},
    servers: [],
    relays: [{ url: 'relay.example', read: true, write: false }],
    blobs: [],
    collections: [],
    uploadJobs: [],
  });
  assert.equal(snapshot.relays[0].url, 'wss://relay.example');
  assert.equal(snapshot.relays[0].read, true);
  assert.equal(snapshot.relays[0].write, false);
});
