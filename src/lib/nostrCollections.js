const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/i;
const HASH_RE = /^[0-9a-f]{64}$/i;
export const COLLECTION_KIND = 30003;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function hashFromUrl(url) {
  const match = String(url || '').match(/[0-9a-f]{64}/i);
  return match ? match[0].toLowerCase() : null;
}

export function createCollectionEvent(collection, blobs = [], pubkey = '', { createdAt = nowSeconds() } = {}) {
  const blobByHash = new Map(blobs.map((blob) => [blob.hash, blob]));
  const id = collection.d || collection.id;
  const tags = [
    ['d', id],
    ['title', collection.name],
  ];
  if (collection.desc) tags.push(['description', collection.desc]);
  for (const hash of collection.hashes || []) {
    const blob = blobByHash.get(hash);
    if (blob?.url && blob.url !== '#') tags.push(['r', blob.url]);
    tags.push(['x', hash]);
  }
  return {
    kind: collection.kind || COLLECTION_KIND,
    pubkey: HEX_PUBKEY_RE.test(pubkey || '') ? pubkey : '',
    created_at: createdAt,
    content: '',
    tags,
  };
}

export function parseCollectionEvent(input, existing = {}) {
  const event = typeof input === 'string' ? JSON.parse(input) : input;
  if (!event || typeof event !== 'object' || event.kind !== COLLECTION_KIND) {
    throw new TypeError('Paste a NIP-51 bookmark set event of kind 30003.');
  }
  const tags = Array.isArray(event.tags) ? event.tags : [];
  const d = tags.find((tag) => tag[0] === 'd')?.[1];
  if (!d) throw new TypeError('Collection event is missing its d tag.');
  const title = tags.find((tag) => tag[0] === 'title')?.[1] || existing.name || d;
  const desc = tags.find((tag) => tag[0] === 'description')?.[1] || '';
  const hashes = [];
  for (const tag of tags) {
    if (tag[0] === 'x' && HASH_RE.test(tag[1] || '')) hashes.push(tag[1].toLowerCase());
    if (tag[0] === 'r') {
      const hash = hashFromUrl(tag[1]);
      if (hash) hashes.push(hash);
    }
  }
  return {
    ...existing,
    id: existing.id || d,
    d,
    name: title,
    emoji: existing.emoji || '🌸',
    desc,
    kind: COLLECTION_KIND,
    hashes: Array.from(new Set(hashes)),
    remoteEvent: event,
    eventUpdatedAt: event.created_at || null,
    publishedAt: event.created_at ? new Date(event.created_at * 1000).toISOString() : null,
    conflict: null,
  };
}

export function applyRemoteCollectionEvent(collections, input) {
  const incoming = parseCollectionEvent(input);
  const index = collections.findIndex((collection) => (collection.d || collection.id) === incoming.d);
  if (index === -1) return [...collections, incoming];
  const current = collections[index];
  const currentUpdated = current.eventUpdatedAt || 0;
  const incomingUpdated = incoming.eventUpdatedAt || 0;
  if (currentUpdated > incomingUpdated) {
    return collections.map((collection, i) => i === index
      ? { ...collection, conflict: { remoteEvent: incoming.remoteEvent, remoteUpdatedAt: incomingUpdated, localUpdatedAt: currentUpdated } }
      : collection);
  }
  return collections.map((collection, i) => i === index ? { ...incoming, id: current.id, emoji: current.emoji || incoming.emoji } : collection);
}

export function markCollectionPublished(collection, event) {
  return {
    ...collection,
    d: event.tags.find((tag) => tag[0] === 'd')?.[1] || collection.d || collection.id,
    remoteEvent: event,
    eventUpdatedAt: event.created_at,
    publishedAt: event.created_at ? new Date(event.created_at * 1000).toISOString() : new Date().toISOString(),
    conflict: null,
  };
}

export async function collectionShareReference(collection, pubkey, relays = []) {
  const identifier = collection.d || collection.id;
  if (!HEX_PUBKEY_RE.test(pubkey || '')) {
    return `nostr:collection:${collection.kind || COLLECTION_KIND}:${identifier}`;
  }
  const { nip19 } = await import('nostr-tools');
  return `nostr:${nip19.naddrEncode({
    kind: collection.kind || COLLECTION_KIND,
    pubkey,
    identifier,
    relays,
  })}`;
}
