import test from 'node:test';
import assert from 'node:assert/strict';
import { accountStorageScope, clearAtelierStorage, readStoredValue, scopedStorageName, storageKey, writeStoredValue } from '../../src/lib/storage.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

test('storage helpers roundtrip validated values', () => {
  const storage = createMemoryStorage();
  const validate = (value) => ({ enabled: Boolean(value.enabled) });

  writeStoredValue('settings', { enabled: 1 }, validate, storage);
  assert.deepEqual(readStoredValue('settings', { enabled: false }, validate, storage), { enabled: true });
});

test('invalid stored json falls back', () => {
  const storage = createMemoryStorage();
  storage.setItem(storageKey('broken'), '{');
  assert.deepEqual(readStoredValue('broken', { ok: true }, (value) => value, storage), { ok: true });
});

test('clearAtelierStorage only clears versioned Atelier keys', () => {
  const storage = createMemoryStorage();
  storage.setItem(storageKey('session'), '{}');
  storage.setItem('other-app:key', '{}');

  clearAtelierStorage(storage);
  assert.equal(storage.getItem(storageKey('session')), null);
  assert.equal(storage.getItem('other-app:key'), '{}');
});

test('scoped storage names isolate per-account values', () => {
  const storage = createMemoryStorage();
  const validate = (value) => ({ accent: String(value.accent) });
  const alice = scopedStorageName('settings', accountStorageScope({ pubkey: 'A'.repeat(64) }));
  const bob = scopedStorageName('settings', accountStorageScope({ pubkey: 'B'.repeat(64) }));

  writeStoredValue(alice, { accent: '#111111' }, validate, storage);
  writeStoredValue(bob, { accent: '#222222' }, validate, storage);

  assert.deepEqual(readStoredValue(alice, {}, validate, storage), { accent: '#111111' });
  assert.deepEqual(readStoredValue(bob, {}, validate, storage), { accent: '#222222' });
});
