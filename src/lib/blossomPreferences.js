import { addServerRecord, ensurePrimaryServer, normalizeServerUrl } from './serverConfig.js';

export const BLOSSOM_SERVER_LIST_KIND = 10063;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function serverPreferenceTags(servers) {
  return ensurePrimaryServer(servers).map((server) => ['server', normalizeServerUrl(server.url)]);
}

export function createServerPreferenceEvent(servers, pubkey, { createdAt = Math.floor(Date.now() / 1000) } = {}) {
  return {
    kind: BLOSSOM_SERVER_LIST_KIND,
    pubkey: typeof pubkey === 'string' ? pubkey : '',
    created_at: createdAt,
    content: '',
    tags: serverPreferenceTags(servers),
  };
}

export function parseServerPreferenceEvent(event) {
  const parsed = typeof event === 'string' ? JSON.parse(event) : event;
  if (!isObject(parsed) || parsed.kind !== BLOSSOM_SERVER_LIST_KIND) {
    throw new TypeError('Paste a kind 10063 Blossom server list event.');
  }
  const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  const urls = tags
    .filter((tag) => Array.isArray(tag) && tag[0] === 'server' && typeof tag[1] === 'string')
    .map((tag) => tag[1]);
  if (urls.length === 0) throw new TypeError('Server list event must include at least one server tag.');
  return urls.reduce((servers, url) => {
    try {
      return addServerRecord(servers, url);
    } catch {
      return servers;
    }
  }, []);
}

export function validateServerPreferenceEvent(value) {
  if (value == null) return null;
  const event = isObject(value) ? value : JSON.parse(String(value));
  if (event.kind !== BLOSSOM_SERVER_LIST_KIND) throw new TypeError('serverPreferenceEvent must be kind 10063');
  parseServerPreferenceEvent(event);
  return {
    ...event,
    content: '',
    tags: serverPreferenceTags(parseServerPreferenceEvent(event)),
  };
}
