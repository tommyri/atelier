import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuthorizationHeader,
  createBlossomAuthEvent,
  preflightUpload,
  sha256File,
  uploadAndMirrorFile,
  validateUploadFile,
} from '../../src/lib/blossomUpload.js';
import { stripImageMetadata } from '../../src/lib/metadataPrivacy.js';

const PUBKEY = 'a'.repeat(64);
const HASH = '3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7';
const PRIMARY = { url: 'https://one.example', name: 'One' };
const MIRROR = { url: 'https://two.example', name: 'Two' };

function response(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      get(name) {
        const key = Object.keys(headers).find((header) => header.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
    async json() {
      return body;
    },
  };
}

test('sha256File hashes exact file bytes and validates constraints', async () => {
  const file = new File(['data'], 'demo.txt', { type: 'text/plain' });
  assert.equal(await sha256File(file), HASH);
  assert.equal(validateUploadFile(file), true);
  assert.throws(() => validateUploadFile(new File([''], 'empty.txt')), /empty/);
});

test('createAuthorizationHeader creates a BUD-11 Nostr header', async () => {
  const event = createBlossomAuthEvent({ pubkey: PUBKEY, hash: HASH, serverUrl: PRIMARY.url, now: 1000 });
  assert.equal(event.kind, 24242);
  assert.deepEqual(event.tags, [
    ['t', 'upload'],
    ['expiration', '1600'],
    ['x', HASH],
    ['server', 'one.example'],
  ]);

  const headers = await createAuthorizationHeader({
    pubkey: PUBKEY,
    hash: HASH,
    serverUrl: PRIMARY.url,
    signEvent: async (unsigned) => ({ ...unsigned, id: '1'.repeat(64), sig: '2'.repeat(128) }),
  });
  assert.match(headers.Authorization, /^Nostr /);
});

test('preflightUpload surfaces server policy errors', async () => {
  const file = new File(['data'], 'demo.txt', { type: 'text/plain' });
  const rejected = await preflightUpload({
    file,
    hash: HASH,
    server: PRIMARY,
    pubkey: PUBKEY,
    fetcher: async () => response(413, null, { 'X-Reason': 'too large' }),
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'too large');
});

test('uploadAndMirrorFile uploads primary and mirrors successful replicas', async () => {
  const file = new File(['data'], 'demo.txt', { type: 'text/plain' });
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, method: options.method });
    if (url.endsWith('/upload') && options.method === 'HEAD') return response(200);
    if (url.endsWith('/upload') && options.method === 'PUT') {
      return response(201, { sha256: HASH, url: `https://one.example/${HASH}.txt`, size: 4, type: 'text/plain', uploaded: 1770000000 });
    }
    if (url.endsWith('/mirror')) {
      return response(201, { sha256: HASH, url: `https://two.example/${HASH}.txt`, size: 4, type: 'text/plain', uploaded: 1770000000 });
    }
    if (url.includes(HASH)) return response(200, null, { 'Content-Type': 'text/plain', 'Content-Length': '4' });
    return response(404);
  };

  const result = await uploadAndMirrorFile({ file, hash: HASH, server: PRIMARY, mirrors: [MIRROR], pubkey: PUBKEY, fetcher });
  assert.equal(result.hash, HASH);
  assert.equal(result.blob.hash, HASH);
  assert.deepEqual(result.blob.servers, ['One', 'Two']);
  assert.equal(result.mirrorResults[0].status, 'fulfilled');
  assert.deepEqual(calls.map((call) => call.method), ['HEAD', 'PUT', 'PUT', 'HEAD', 'HEAD']);
});

test('metadata stripping produces a smaller upload candidate with a new hash', async () => {
  const exif = Buffer.from('Exif\0\0GPSLatitude=10');
  const file = new File([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, exif.length + 2]),
    exif,
    Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]),
  ], 'gps.jpg', { type: 'image/jpeg' });
  const stripped = await stripImageMetadata(file);

  assert.equal(stripped.changed, true);
  assert.ok(stripped.file.size < file.size);
  assert.notEqual(await sha256File(file), await sha256File(stripped.file));
});
