export const NOSTR_RELAY_LIST_KIND = 10002;

export const DEFAULT_NOSTR_RELAYS = Object.freeze([
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeRelayUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new TypeError('Relay URL is required.');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^wss?:\/\//i.test(raw)) {
    throw new TypeError('Relay URL must use ws:// or wss://.');
  }
  const withProtocol = /^wss?:\/\//i.test(raw) ? raw : `wss://${raw}`;
  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new TypeError('Relay URL must be a valid ws:// or wss:// URL.');
  }
  if (!['ws:', 'wss:'].includes(parsed.protocol)) {
    throw new TypeError('Relay URL must use ws:// or wss://.');
  }
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';
  parsed.search = '';
  if ((parsed.protocol === 'wss:' && parsed.port === '443') || (parsed.protocol === 'ws:' && parsed.port === '80')) {
    parsed.port = '';
  }
  return parsed.toString().replace(/\/$/, '');
}

function relayNameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function createRelayRecord(input, options = {}) {
  const url = normalizeRelayUrl(input);
  return {
    url,
    name: typeof options.name === 'string' && options.name.trim() ? options.name.trim() : relayNameFromUrl(url),
    read: options.read !== false,
    write: options.write !== false,
  };
}

export function validateRelayRecord(value) {
  const relay = isObject(value) ? value : { url: value };
  const url = normalizeRelayUrl(relay.url);
  const read = typeof relay.read === 'boolean' ? relay.read : true;
  const write = typeof relay.write === 'boolean' ? relay.write : true;
  return {
    ...relay,
    url,
    name: typeof relay.name === 'string' && relay.name.trim() ? relay.name.trim() : relayNameFromUrl(url),
    read: read || !write,
    write,
  };
}

export function dedupeRelayRecords(relays) {
  const byUrl = new Map();
  relays.map(validateRelayRecord).forEach((relay) => {
    const current = byUrl.get(relay.url);
    if (!current) {
      byUrl.set(relay.url, relay);
      return;
    }
    byUrl.set(relay.url, {
      ...current,
      read: current.read || relay.read,
      write: current.write || relay.write,
    });
  });
  return Array.from(byUrl.values());
}

export function addRelayRecord(relays, input) {
  const next = createRelayRecord(input);
  if (relays.some((relay) => normalizeRelayUrl(relay.url) === next.url)) {
    throw new TypeError('That relay is already in your list.');
  }
  return [...relays, next];
}

export function removeRelayRecord(relays, url) {
  const target = normalizeRelayUrl(url);
  return relays.filter((relay) => normalizeRelayUrl(relay.url) !== target);
}

export function moveRelayRecord(relays, url, direction) {
  const target = normalizeRelayUrl(url);
  const index = relays.findIndex((relay) => normalizeRelayUrl(relay.url) === target);
  const nextIndex = index + direction;
  if (index === -1 || nextIndex < 0 || nextIndex >= relays.length) return relays;
  const next = [...relays];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function relayListTags(relays) {
  return dedupeRelayRecords(relays)
    .filter((relay) => relay.read || relay.write)
    .map((relay) => {
      if (relay.read && relay.write) return ['r', relay.url];
      return ['r', relay.url, relay.read ? 'read' : 'write'];
    });
}

export function createRelayListEvent(relays, pubkey, { createdAt = Math.floor(Date.now() / 1000) } = {}) {
  return {
    kind: NOSTR_RELAY_LIST_KIND,
    pubkey: typeof pubkey === 'string' ? pubkey : '',
    created_at: createdAt,
    content: '',
    tags: relayListTags(relays),
  };
}

export function parseRelayListEvent(event) {
  const parsed = typeof event === 'string' ? JSON.parse(event) : event;
  if (!isObject(parsed) || parsed.kind !== NOSTR_RELAY_LIST_KIND) {
    throw new TypeError('Paste a kind 10002 Nostr relay list event.');
  }
  const relays = [];
  for (const tag of Array.isArray(parsed.tags) ? parsed.tags : []) {
    if (!Array.isArray(tag) || tag[0] !== 'r' || typeof tag[1] !== 'string') continue;
    const marker = tag[2];
    try {
      relays.push(createRelayRecord(tag[1], {
        read: marker === 'write' ? false : true,
        write: marker === 'read' ? false : true,
      }));
    } catch {
      // Ignore invalid relay tags while preserving the valid part of the event.
    }
  }
  if (relays.length === 0) throw new TypeError('Relay list event must include at least one r tag.');
  return dedupeRelayRecords(relays);
}

export function validateRelayListEvent(value) {
  if (value == null) return null;
  const event = isObject(value) ? value : JSON.parse(String(value));
  if (event.kind !== NOSTR_RELAY_LIST_KIND) throw new TypeError('relayListEvent must be kind 10002');
  const relays = parseRelayListEvent(event);
  return {
    ...event,
    content: '',
    tags: relayListTags(relays),
  };
}

export function relayPublishUrls(relays) {
  return dedupeRelayRecords(relays)
    .filter((relay) => relay.write)
    .map((relay) => relay.url);
}

export function relayReadUrls(relays) {
  return dedupeRelayRecords(relays)
    .filter((relay) => relay.read)
    .map((relay) => relay.url);
}

export async function publishRelayListEvent(event, relays, { maxWait = 4000 } = {}) {
  if (!event?.sig || !event?.id) throw new TypeError('Sign the relay list event before publishing.');
  const urls = relayPublishUrls(relays);
  if (urls.length === 0) throw new TypeError('Add at least one write relay before publishing.');
  const { SimplePool } = await import('nostr-tools/pool');
  const pool = new SimplePool();
  try {
    const settled = await Promise.allSettled(pool.publish(urls, event, { maxWait }));
    return urls.map((url, index) => {
      const result = settled[index];
      return result?.status === 'fulfilled'
        ? { url, ok: true, message: result.value }
        : { url, ok: false, message: result?.reason?.message || 'Publish failed' };
    });
  } finally {
    pool.destroy();
  }
}

export async function fetchRelayListEvent(pubkey, relays, { maxWait = 3000 } = {}) {
  if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) {
    throw new TypeError('A hex nostr public key is required to load relay lists.');
  }
  const urls = relayReadUrls(relays).length > 0 ? relayReadUrls(relays) : DEFAULT_NOSTR_RELAYS;
  const { SimplePool } = await import('nostr-tools/pool');
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(urls, { kinds: [NOSTR_RELAY_LIST_KIND], authors: [pubkey], limit: 1 }, { maxWait });
    return events.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0] || null;
  } finally {
    pool.destroy();
  }
}
