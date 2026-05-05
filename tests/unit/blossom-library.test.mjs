import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeBlobDescriptors,
  fetchServerBlobList,
  loadBlossomLibrary,
  normalizeBlobDescriptor,
  refreshBlobReplicas,
} from '../../src/lib/blossomLibrary.js';

const PUBKEY = 'a'.repeat(64);
const HASH_A = '1'.repeat(64);
const HASH_B = '2'.repeat(64);
const SERVER_A = { url: 'https://one.example', name: 'One', status: 'online' };
const SERVER_B = { url: 'https://two.example', name: 'Two', status: 'online' };

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

test('normalizeBlobDescriptor maps Blossom descriptors to app blobs', () => {
  const blob = normalizeBlobDescriptor({
    sha256: HASH_A,
    url: `https://one.example/${HASH_A}.jpg`,
    size: 123,
    type: 'image/jpeg',
    uploaded: 1770000000,
  }, SERVER_A);

  assert.equal(blob.hash, HASH_A);
  assert.equal(blob.name, `${HASH_A}.jpg`);
  assert.equal(blob.uploaded, '2026-02-02T02:40:00.000Z');
  assert.deepEqual(blob.servers, ['One']);
  assert.equal(blob.replicas[0].available, true);
});

test('loadBlossomLibrary fetches and dedupes lists across servers', async () => {
  const fetcher = async (url) => {
    assert.match(url, new RegExp(`/list/${PUBKEY}$`));
    if (url.startsWith('https://one.example')) {
      return response(200, [{ sha256: HASH_A, url: `https://one.example/${HASH_A}.jpg`, size: 100, type: 'image/jpeg', uploaded: 1770000000 }]);
    }
    return response(200, [
      { sha256: HASH_A, url: `https://two.example/${HASH_A}.jpg`, size: 100, type: 'image/jpeg', uploaded: 1770000000 },
      { sha256: HASH_B, url: `https://two.example/${HASH_B}.mp3`, size: 200, type: 'audio/mpeg', uploaded: 1770001000 },
    ]);
  };

  const { blobs, errors } = await loadBlossomLibrary({ servers: [SERVER_A, SERVER_B], pubkey: PUBKEY, fetcher });
  assert.deepEqual(errors, []);
  assert.equal(blobs.length, 2);
  assert.deepEqual(blobs.find((blob) => blob.hash === HASH_A).servers, ['One', 'Two']);
  assert.equal(blobs.find((blob) => blob.hash === HASH_A).replicas.length, 2);
});

test('fetchServerBlobList and dedupe handle server failures explicitly', async () => {
  await assert.rejects(
    () => fetchServerBlobList(SERVER_A, PUBKEY, { fetcher: async () => response(500, [], { 'X-Reason': 'down' }) }),
    /One: down/,
  );
  assert.equal(dedupeBlobDescriptors([]).length, 0);
});

test('refreshBlobReplicas records availability per server', async () => {
  const refreshed = await refreshBlobReplicas(
    { hash: HASH_A, type: 'image/jpeg', size: 100, server: 'One', uploaded: '2026-01-01T00:00:00.000Z' },
    [SERVER_A, SERVER_B],
    {
      now: new Date('2026-05-05T10:00:00Z'),
      fetcher: async (url) => url.startsWith('https://one.example')
        ? response(200, null, { 'Content-Type': 'image/jpeg', 'Content-Length': '100' })
        : response(404, null, { 'X-Reason': 'missing' }),
    },
  );

  assert.equal(refreshed.detailRefreshedAt, '2026-05-05T10:00:00.000Z');
  assert.deepEqual(refreshed.servers, ['One']);
  assert.equal(refreshed.replicas[0].available, true);
  assert.equal(refreshed.replicas[1].available, false);
  assert.equal(refreshed.replicas[1].reason, 'missing');
});
