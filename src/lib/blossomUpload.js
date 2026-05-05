import { normalizeBlobDescriptor, refreshBlobReplicas } from './blossomLibrary.js';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const AUTH_KIND = 24242;

function base64Url(text) {
  const bytes = new TextEncoder().encode(text);
  if (typeof btoa !== 'function' && typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function serverDomain(url) {
  return new URL(url).hostname.toLowerCase();
}

export async function sha256File(file) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validateUploadFile(file, { maxBytes = MAX_UPLOAD_BYTES } = {}) {
  if (!file) throw new TypeError('Choose a file to upload.');
  if (file.size <= 0) throw new TypeError(`${file.name} is empty.`);
  if (file.size > maxBytes) throw new TypeError(`${file.name} exceeds the 100 MB upload limit.`);
  return true;
}

export function createUploadJob(file, { hash = null, strip = false } = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    size: file.size,
    progress: hash ? 12 : 0,
    state: hash ? 'queued' : 'hashing',
    type: file.type || 'application/octet-stream',
    strip: Boolean(strip),
    hash,
    metadata: null,
    error: null,
    serverResults: [],
  };
}

export function createBlossomAuthEvent({ action = 'upload', pubkey, hash, serverUrl, now = Math.floor(Date.now() / 1000), expiresIn = 600 }) {
  if (!pubkey) throw new TypeError('A nostr public key is required for Blossom authorization.');
  return {
    kind: AUTH_KIND,
    pubkey,
    created_at: now,
    tags: [
      ['t', action],
      ['expiration', String(now + expiresIn)],
      ['x', hash],
      ['server', serverDomain(serverUrl)],
    ],
    content: `${action === 'media' ? 'Transform' : 'Upload'} Blob`,
  };
}

export async function createAuthorizationHeader({ action = 'upload', pubkey, hash, serverUrl, signEvent }) {
  if (typeof signEvent !== 'function' || !pubkey) return {};
  const event = createBlossomAuthEvent({ action, pubkey, hash, serverUrl });
  const signed = await signEvent(event);
  if (!signed) return {};
  return { Authorization: `Nostr ${base64Url(JSON.stringify(signed))}` };
}

export async function preflightUpload({ file, hash, server, pubkey, signEvent, fetcher = globalThis.fetch }) {
  const authHeaders = await createAuthorizationHeader({ action: 'upload', pubkey, hash, serverUrl: server.url, signEvent });
  const response = await fetcher(`${server.url}/upload`, {
    method: 'HEAD',
    cache: 'no-store',
    headers: {
      ...authHeaders,
      'X-SHA-256': hash,
      'X-Content-Type': file.type || 'application/octet-stream',
      'X-Content-Length': String(file.size),
    },
  });
  if ([200, 201, 401, 403].includes(response.status)) {
    return { ok: true, status: response.status, requiresAuth: [401, 403].includes(response.status), reason: response.headers.get('x-reason') || '' };
  }
  return { ok: false, status: response.status, reason: response.headers.get('x-reason') || `${response.status} ${response.statusText || 'preflight failed'}` };
}

export async function uploadFileToServer({ file, hash, server, pubkey, signEvent, fetcher = globalThis.fetch }) {
  const authHeaders = await createAuthorizationHeader({ action: 'upload', pubkey, hash, serverUrl: server.url, signEvent });
  const response = await fetcher(`${server.url}/upload`, {
    method: 'PUT',
    cache: 'no-store',
    headers: {
      ...authHeaders,
      'Content-Type': file.type || 'application/octet-stream',
      'X-SHA-256': hash,
    },
    body: file,
  });
  if (![200, 201].includes(response.status)) {
    throw new Error(response.headers.get('x-reason') || `${server.name}: upload failed with ${response.status}`);
  }
  const descriptor = await response.json();
  if (descriptor.sha256 !== hash) throw new Error(`${server.name}: uploaded hash did not match local SHA-256.`);
  return normalizeBlobDescriptor(descriptor, server);
}

export async function mirrorBlobToServer({ blob, targetServer, pubkey, signEvent, fetcher = globalThis.fetch }) {
  const authHeaders = await createAuthorizationHeader({ action: 'upload', pubkey, hash: blob.hash, serverUrl: targetServer.url, signEvent });
  const response = await fetcher(`${targetServer.url}/mirror`, {
    method: 'PUT',
    cache: 'no-store',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: blob.url }),
  });
  if (![200, 201].includes(response.status)) {
    throw new Error(response.headers.get('x-reason') || `${targetServer.name}: mirror failed with ${response.status}`);
  }
  const descriptor = await response.json();
  if (descriptor.sha256 !== blob.hash) throw new Error(`${targetServer.name}: mirrored hash did not match upload hash.`);
  return normalizeBlobDescriptor(descriptor, targetServer);
}

export async function uploadAndMirrorFile({ file, hash: knownHash = null, server, mirrors = [], pubkey, signEvent, fetcher = globalThis.fetch }) {
  validateUploadFile(file);
  const hash = knownHash || await sha256File(file);
  const preflight = await preflightUpload({ file, hash, server, pubkey, signEvent, fetcher });
  if (!preflight.ok) throw new Error(preflight.reason);
  const uploaded = await uploadFileToServer({ file, hash, server, pubkey, signEvent, fetcher });
  const mirrorResults = await Promise.allSettled(mirrors.map((targetServer) => mirrorBlobToServer({ blob: uploaded, targetServer, pubkey, signEvent, fetcher })));
  const refreshed = await refreshBlobReplicas(uploaded, [server, ...mirrors], { fetcher }).catch(() => uploaded);
  return {
    hash,
    blob: {
      ...uploaded,
      replicas: refreshed.replicas || uploaded.replicas,
      servers: refreshed.servers || uploaded.servers,
    },
    mirrorResults,
  };
}
