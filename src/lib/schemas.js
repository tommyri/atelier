import { normalizeServerUrl, serverNameFromUrl } from './serverConfig.js';
import { validateRelayRecord } from './nostrRelayList.js';

const HASH_RE = /^[0-9a-f]{64}$/i;

export const DEFAULT_SETTINGS = Object.freeze({
  dark: false,
  accent: '#e8a4b8',
  autoOptimize: true,
  mirror: true,
  publishList: true,
  privacy: false,
  metadataWarnings: true,
  requireCleanImages: false,
  showHashes: false,
});

export const DEFAULT_SESSION = Object.freeze({
  loggedIn: true,
  mode: 'demo',
  pubkey: null,
  readonly: false,
  remoteSigner: null,
});

export const DEFAULT_PROFILE = Object.freeze({
  pubkey: '',
  npubShort: 'No account',
  hexShort: '',
  name: '',
  display_name: 'Anonymous',
  nip05: '',
  lud16: '',
  about: '',
  website: '',
  picture: '',
  banner: '',
  followers: 0,
  following: 0,
  notes: 0,
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function numberOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function booleanOr(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function requireObject(value, label) {
  if (!isObject(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

export function validateBlob(value) {
  const blob = requireObject(value, 'blob');
  const hash = requireString(blob.hash, 'blob.hash');
  if (!HASH_RE.test(hash)) throw new TypeError('blob.hash must be a sha256 hex string');
  const type = requireString(blob.type, 'blob.type');
  const uploaded = requireString(blob.uploaded, 'blob.uploaded');
  if (Number.isNaN(Date.parse(uploaded))) throw new TypeError('blob.uploaded must be an ISO date');
  return {
    ...blob,
    hash,
    type,
    size: numberOr(blob.size),
    name: requireString(blob.name, 'blob.name'),
    url: optionalString(blob.url, '#'),
    thumb: typeof blob.thumb === 'string' ? blob.thumb : null,
    uploaded,
    server: optionalString(blob.server, ''),
    servers: Array.isArray(blob.servers) ? blob.servers.filter((server) => typeof server === 'string') : undefined,
    replicas: Array.isArray(blob.replicas) ? blob.replicas.filter(isObject).map((replica) => ({
      server: optionalString(replica.server),
      url: optionalString(replica.url),
      checkedAt: typeof replica.checkedAt === 'string' ? replica.checkedAt : null,
      available: booleanOr(replica.available),
      status: replica.status == null ? undefined : numberOr(replica.status),
      size: replica.size == null ? undefined : numberOr(replica.size),
      type: optionalString(replica.type, type),
      reason: optionalString(replica.reason),
    })) : undefined,
    detailRefreshedAt: typeof blob.detailRefreshedAt === 'string' ? blob.detailRefreshedAt : null,
    source: optionalString(blob.source, 'local'),
    w: blob.w == null ? undefined : numberOr(blob.w),
    h: blob.h == null ? undefined : numberOr(blob.h),
    duration: blob.duration == null ? undefined : numberOr(blob.duration),
    pages: blob.pages == null ? undefined : numberOr(blob.pages),
  };
}

export function validateServer(value) {
  const server = requireObject(value, 'server');
  const url = normalizeServerUrl(requireString(server.url, 'server.url'));
  const status = ['online', 'degraded', 'offline'].includes(server.status) ? server.status : 'offline';
  return {
    ...server,
    url,
    name: optionalString(server.name, serverNameFromUrl(url)),
    status,
    latency: numberOr(server.latency),
    used: numberOr(server.used),
    quota: numberOr(server.quota),
    primary: booleanOr(server.primary),
    lastCheckedAt: typeof server.lastCheckedAt === 'string' ? server.lastCheckedAt : null,
    capabilities: isObject(server.capabilities) ? server.capabilities : {},
  };
}

export function validateCollection(value) {
  const list = requireObject(value, 'collection');
  return {
    ...list,
    id: requireString(list.id, 'collection.id'),
    name: requireString(list.name, 'collection.name'),
    emoji: optionalString(list.emoji, '🌸'),
    desc: optionalString(list.desc),
    kind: numberOr(list.kind, 30003),
    hashes: Array.isArray(list.hashes) ? list.hashes.filter((hash) => typeof hash === 'string') : [],
    d: optionalString(list.d, list.id),
    remoteEvent: isObject(list.remoteEvent) ? list.remoteEvent : null,
    eventUpdatedAt: list.eventUpdatedAt == null ? null : numberOr(list.eventUpdatedAt),
    publishedAt: typeof list.publishedAt === 'string' ? list.publishedAt : null,
    conflict: isObject(list.conflict) ? list.conflict : null,
  };
}

export function validateProfile(value) {
  const profile = isObject(value) ? value : {};
  return {
    ...profile,
    pubkey: optionalString(profile.pubkey),
    npubShort: optionalString(profile.npubShort, profile.pubkey || DEFAULT_PROFILE.npubShort),
    hexShort: optionalString(profile.hexShort),
    name: optionalString(profile.name),
    display_name: optionalString(profile.display_name, profile.name || 'Anonymous'),
    nip05: optionalString(profile.nip05),
    lud16: optionalString(profile.lud16),
    about: optionalString(profile.about),
    website: optionalString(profile.website),
    picture: optionalString(profile.picture),
    banner: optionalString(profile.banner),
    followers: numberOr(profile.followers),
    following: numberOr(profile.following),
    notes: numberOr(profile.notes),
    profileEvent: isObject(profile.profileEvent) ? profile.profileEvent : null,
    profileUpdatedAt: profile.profileUpdatedAt == null ? null : numberOr(profile.profileUpdatedAt),
    profilePublishedAt: typeof profile.profilePublishedAt === 'string' ? profile.profilePublishedAt : null,
    nip05Verified: booleanOr(profile.nip05Verified),
  };
}

export function validateUploadJob(value) {
  const job = requireObject(value, 'uploadJob');
  const state = ['hashing', 'queued', 'uploading', 'done', 'failed', 'cancelled'].includes(job.state) ? job.state : 'queued';
  return {
    ...job,
    id: optionalString(job.id, `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    name: requireString(job.name, 'uploadJob.name'),
    size: numberOr(job.size),
    progress: Math.max(0, Math.min(100, numberOr(job.progress))),
    state,
    type: optionalString(job.type, 'application/octet-stream'),
    strip: booleanOr(job.strip),
    stripBytes: job.stripBytes == null ? undefined : numberOr(job.stripBytes),
    metadata: isObject(job.metadata) ? {
      present: booleanOr(job.metadata.present),
      sensitive: booleanOr(job.metadata.sensitive),
      bytes: numberOr(job.metadata.bytes),
      sections: Array.isArray(job.metadata.sections) ? job.metadata.sections.filter((section) => typeof section === 'string') : [],
      type: optionalString(job.metadata.type),
    } : null,
    hash: typeof job.hash === 'string' ? job.hash : null,
    error: typeof job.error === 'string' ? job.error : null,
    serverResults: Array.isArray(job.serverResults) ? job.serverResults.filter(isObject).map((result) => ({
      server: optionalString(result.server),
      state: optionalString(result.state, 'queued'),
      status: result.status == null ? undefined : numberOr(result.status),
      error: typeof result.error === 'string' ? result.error : null,
    })) : [],
  };
}

export function validateSettings(value) {
  const settings = isObject(value) ? value : {};
  const accent = typeof settings.accent === 'string' && /^#[0-9a-f]{6}$/i.test(settings.accent) ? settings.accent : DEFAULT_SETTINGS.accent;
  return {
    ...DEFAULT_SETTINGS,
    dark: booleanOr(settings.dark, DEFAULT_SETTINGS.dark),
    accent,
    autoOptimize: booleanOr(settings.autoOptimize, DEFAULT_SETTINGS.autoOptimize),
    mirror: booleanOr(settings.mirror, DEFAULT_SETTINGS.mirror),
    publishList: booleanOr(settings.publishList, DEFAULT_SETTINGS.publishList),
    privacy: booleanOr(settings.privacy, DEFAULT_SETTINGS.privacy),
    metadataWarnings: booleanOr(settings.metadataWarnings, DEFAULT_SETTINGS.metadataWarnings),
    requireCleanImages: booleanOr(settings.requireCleanImages, DEFAULT_SETTINGS.requireCleanImages),
    showHashes: booleanOr(settings.showHashes, DEFAULT_SETTINGS.showHashes),
  };
}

export function validateSession(value) {
  const session = isObject(value) ? value : {};
  const mode = ['demo', 'nip07', 'nip46', 'readonly'].includes(session.mode) ? session.mode : 'demo';
  const remoteSigner = isObject(session.remoteSigner)
    ? {
        clientPubkey: optionalString(session.remoteSigner.clientPubkey),
        clientSecretKey: optionalString(session.remoteSigner.clientSecretKey),
        remoteSignerPubkey: optionalString(session.remoteSigner.remoteSignerPubkey),
        userPubkey: optionalString(session.remoteSigner.userPubkey),
        relays: Array.isArray(session.remoteSigner.relays) ? session.remoteSigner.relays.filter((relay) => typeof relay === 'string') : [],
        secret: typeof session.remoteSigner.secret === 'string' ? session.remoteSigner.secret : null,
        connectedAt: typeof session.remoteSigner.connectedAt === 'string' ? session.remoteSigner.connectedAt : null,
      }
    : null;
  return {
    ...DEFAULT_SESSION,
    loggedIn: booleanOr(session.loggedIn, DEFAULT_SESSION.loggedIn),
    mode,
    pubkey: typeof session.pubkey === 'string' ? session.pubkey : null,
    readonly: mode === 'readonly' || booleanOr(session.readonly),
    remoteSigner: mode === 'nip46' ? remoteSigner : null,
  };
}

export function validateArray(value, validator, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value.map(validator);
}

export function validateStoreSnapshot(value) {
  const snapshot = requireObject(value, 'storeSnapshot');
  return {
    session: validateSession(snapshot.session),
    profile: validateProfile(snapshot.profile),
    settings: validateSettings(snapshot.settings),
    servers: validateArray(snapshot.servers, validateServer, 'servers'),
    relays: validateArray(snapshot.relays || [], validateRelayRecord, 'relays'),
    blobs: validateArray(snapshot.blobs, validateBlob, 'blobs'),
    collections: validateArray(snapshot.collections, validateCollection, 'collections'),
    uploadJobs: validateArray(snapshot.uploadJobs || [], validateUploadJob, 'uploadJobs'),
  };
}
