const DEFAULT_QUOTA_MB = 1024;

export function normalizeServerUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new TypeError('Enter a Blossom server URL.');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new TypeError('Enter a valid Blossom server URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError('Blossom server URL must use http or https.');
  }
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = '';
  return parsed.toString().replace(/\/$/, '');
}

export function serverNameFromUrl(url) {
  const parsed = new URL(normalizeServerUrl(url));
  return parsed.hostname.replace(/^www\./, '');
}

export function createServerRecord(input, overrides = {}) {
  const url = normalizeServerUrl(input);
  return {
    url,
    name: overrides.name || serverNameFromUrl(url),
    status: overrides.status || 'offline',
    latency: Number.isFinite(overrides.latency) ? overrides.latency : 0,
    used: Number.isFinite(overrides.used) ? overrides.used : 0,
    quota: Number.isFinite(overrides.quota) ? overrides.quota : DEFAULT_QUOTA_MB,
    primary: Boolean(overrides.primary),
    lastCheckedAt: overrides.lastCheckedAt || null,
    capabilities: overrides.capabilities && typeof overrides.capabilities === 'object' ? overrides.capabilities : {},
  };
}

export function ensurePrimaryServer(servers) {
  if (!Array.isArray(servers) || servers.length === 0) return [];
  const normalized = servers.map((server, index) => ({
    ...server,
    url: normalizeServerUrl(server.url),
    name: server.name || serverNameFromUrl(server.url),
    primary: index === 0,
  }));
  return normalized;
}

export function addServerRecord(servers, input) {
  const next = createServerRecord(input);
  const existing = new Set(servers.map((server) => normalizeServerUrl(server.url)));
  if (existing.has(next.url)) throw new TypeError('That server is already in your list.');
  return ensurePrimaryServer([...servers, next]);
}

export function removeServerRecord(servers, url) {
  if (servers.length <= 1) throw new TypeError('Keep at least one Blossom server.');
  const target = normalizeServerUrl(url);
  const next = servers.filter((server) => normalizeServerUrl(server.url) !== target);
  if (next.length === servers.length) return ensurePrimaryServer(servers);
  return ensurePrimaryServer(next);
}

export function moveServerRecord(servers, url, direction) {
  const target = normalizeServerUrl(url);
  const index = servers.findIndex((server) => normalizeServerUrl(server.url) === target);
  const nextIndex = index + direction;
  if (index === -1 || nextIndex < 0 || nextIndex >= servers.length) return ensurePrimaryServer(servers);
  const next = [...servers];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return ensurePrimaryServer(next);
}

export function markPrimaryServer(servers, url) {
  const target = normalizeServerUrl(url);
  const index = servers.findIndex((server) => normalizeServerUrl(server.url) === target);
  if (index === -1) return ensurePrimaryServer(servers);
  const next = [...servers];
  const [primary] = next.splice(index, 1);
  return ensurePrimaryServer([primary, ...next]);
}
