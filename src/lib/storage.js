const STORAGE_VERSION = 2;
const STORAGE_PREFIX = `atelier:v${STORAGE_VERSION}:`;

export function storageKey(name) {
  return `${STORAGE_PREFIX}${name}`;
}

export function scopedStorageName(name, scope = '') {
  return scope ? `${name}:${scope}` : name;
}

export function accountStorageScope(session = {}) {
  if (typeof session.pubkey === 'string' && session.pubkey.trim()) {
    return `pubkey:${session.pubkey.trim().toLowerCase()}`;
  }
  if (typeof session.mode === 'string' && session.mode.trim()) {
    return `mode:${session.mode.trim().toLowerCase()}`;
  }
  return 'mode:demo';
}

export function readStoredValue(name, fallback, validator = (value) => value, storage = globalThis.localStorage) {
  if (!storage) return fallback;
  const raw = storage.getItem(storageKey(name));
  if (!raw) return fallback;

  try {
    return validator(JSON.parse(raw));
  } catch (error) {
    console.warn(`Ignoring invalid stored Atelier value for ${name}`, error);
    return fallback;
  }
}

export function writeStoredValue(name, value, validator = (next) => next, storage = globalThis.localStorage) {
  if (!storage) return validator(value);
  const validated = validator(value);
  storage.setItem(storageKey(name), JSON.stringify(validated));
  return validated;
}

export function clearAtelierStorage(storage = globalThis.localStorage) {
  if (!storage) return;
  for (let i = storage.length - 1; i >= 0; i -= 1) {
    const key = storage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) storage.removeItem(key);
  }
}
