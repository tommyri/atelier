const HASH_RE = /^[0-9a-f]{64}$/i;
const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/i;

function serverBase(server) {
  return server.url.replace(/\/$/, '');
}

function extensionName(url, fallbackHash) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').filter(Boolean).at(-1) || fallbackHash;
    return decodeURIComponent(last);
  } catch {
    return fallbackHash;
  }
}

function toIsoDate(uploaded) {
  if (typeof uploaded === 'number') return new Date(uploaded * 1000).toISOString();
  if (typeof uploaded === 'string' && /^\d+$/.test(uploaded)) return new Date(Number(uploaded) * 1000).toISOString();
  if (typeof uploaded === 'string' && !Number.isNaN(Date.parse(uploaded))) return new Date(uploaded).toISOString();
  return new Date().toISOString();
}

export function normalizeBlobDescriptor(descriptor, server) {
  const hash = String(descriptor.sha256 || descriptor.hash || '').toLowerCase();
  if (!HASH_RE.test(hash)) throw new TypeError('Blob descriptor is missing a sha256 hash.');
  const url = descriptor.url || `${serverBase(server)}/${hash}`;
  const type = descriptor.type || descriptor.mime || descriptor.content_type || 'application/octet-stream';
  const size = Number.isFinite(descriptor.size) ? descriptor.size : Number(descriptor.size) || 0;
  const name = descriptor.name || descriptor.filename || extensionName(url, hash);
  return {
    hash,
    type,
    size,
    name,
    url,
    thumb: typeof descriptor.thumb === 'string' ? descriptor.thumb : null,
    uploaded: toIsoDate(descriptor.uploaded),
    server: server.name,
    servers: [server.name],
    replicas: [{
      server: server.name,
      url,
      checkedAt: new Date().toISOString(),
      available: true,
      size,
      type,
    }],
    w: descriptor.width || descriptor.w,
    h: descriptor.height || descriptor.h,
    duration: descriptor.duration,
    pages: descriptor.pages,
    source: 'blossom',
  };
}

export function dedupeBlobDescriptors(blobs) {
  const byHash = new Map();
  for (const blob of blobs) {
    const current = byHash.get(blob.hash);
    if (!current) {
      byHash.set(blob.hash, blob);
      continue;
    }
    const replicas = [...(current.replicas || []), ...(blob.replicas || [])];
    byHash.set(blob.hash, {
      ...current,
      uploaded: new Date(blob.uploaded) > new Date(current.uploaded) ? blob.uploaded : current.uploaded,
      server: current.server || blob.server,
      servers: Array.from(new Set([...(current.servers || [current.server]), ...(blob.servers || [blob.server])].filter(Boolean))),
      replicas,
    });
  }
  return Array.from(byHash.values());
}

export async function fetchServerBlobList(server, pubkey, { fetcher = globalThis.fetch } = {}) {
  if (!HEX_PUBKEY_RE.test(pubkey || '')) throw new TypeError('A hex nostr public key is required to list blobs.');
  const response = await fetcher(`${serverBase(server)}/list/${pubkey}`, { method: 'GET', cache: 'no-store' });
  if (!response.ok) {
    const reason = response.headers?.get?.('x-reason') || `${response.status} ${response.statusText || 'error'}`;
    throw new Error(`${server.name}: ${reason}`);
  }
  const descriptors = await response.json();
  if (!Array.isArray(descriptors)) throw new TypeError(`${server.name}: list response must be an array.`);
  return descriptors.map((descriptor) => normalizeBlobDescriptor(descriptor, server));
}

export async function loadBlossomLibrary({ servers, pubkey, fetcher = globalThis.fetch }) {
  if (!HEX_PUBKEY_RE.test(pubkey || '')) {
    return { blobs: [], errors: ['Sign in with a hex nostr public key to load server blobs.'] };
  }
  const activeServers = servers.filter((server) => server.status !== 'offline');
  if (activeServers.length === 0) return { blobs: [], errors: ['No online Blossom servers are configured.'] };
  const settled = await Promise.allSettled(activeServers.map((server) => fetchServerBlobList(server, pubkey, { fetcher })));
  const blobs = dedupeBlobDescriptors(settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []));
  const errors = settled
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || 'Server list failed.');
  return { blobs, errors };
}

export async function refreshBlobReplicas(blob, servers, { fetcher = globalThis.fetch, now = new Date() } = {}) {
  const checks = await Promise.allSettled(servers.map(async (server) => {
    const response = await fetcher(`${serverBase(server)}/${blob.hash}`, { method: 'HEAD', cache: 'no-store' });
    const type = response.headers?.get?.('content-type') || blob.type;
    const size = Number(response.headers?.get?.('content-length')) || blob.size;
    return {
      server: server.name,
      url: `${serverBase(server)}/${blob.hash}`,
      checkedAt: now.toISOString(),
      available: [200, 206, 307, 308].includes(response.status),
      status: response.status,
      size,
      type,
      reason: response.headers?.get?.('x-reason') || '',
    };
  }));
  const replicas = checks.map((result, index) => result.status === 'fulfilled'
    ? result.value
    : {
        server: servers[index].name,
        url: `${serverBase(servers[index])}/${blob.hash}`,
        checkedAt: now.toISOString(),
        available: false,
        status: 0,
        size: blob.size,
        type: blob.type,
        reason: result.reason?.message || 'Request failed',
      });
  const availableReplicas = replicas.filter((replica) => replica.available);
  return {
    ...blob,
    replicas,
    servers: availableReplicas.map((replica) => replica.server),
    server: availableReplicas[0]?.server || blob.server,
    detailRefreshedAt: now.toISOString(),
  };
}
