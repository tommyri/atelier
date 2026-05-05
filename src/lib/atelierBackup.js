import { validateServerPreferenceEvent } from './blossomPreferences.js';
import { validateRelayListEvent, validateRelayRecord } from './nostrRelayList.js';
import {
  validateArray,
  validateBlob,
  validateCollection,
  validateProfile,
  validateServer,
  validateSession,
  validateSettings,
  validateUploadJob,
} from './schemas.js';
import { ensurePrimaryServer } from './serverConfig.js';

export const BACKUP_VERSION = 1;

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

export function validateBackupSnapshot(value) {
  const snapshot = requireObject(value, 'backup snapshot');
  return {
    session: validateSession(snapshot.session || {}),
    profile: validateProfile(snapshot.profile),
    settings: validateSettings(snapshot.settings),
    servers: ensurePrimaryServer(validateArray(snapshot.servers, validateServer, 'servers')),
    serverPreferenceEvent: validateServerPreferenceEvent(snapshot.serverPreferenceEvent),
    relays: validateArray(snapshot.relays || [], validateRelayRecord, 'relays'),
    relayListEvent: validateRelayListEvent(snapshot.relayListEvent),
    blobs: validateArray(snapshot.blobs || [], validateBlob, 'blobs'),
    collections: validateArray(snapshot.collections || [], validateCollection, 'collections'),
    uploadJobs: validateArray(snapshot.uploadJobs || [], validateUploadJob, 'uploadJobs'),
  };
}

export function createAtelierBackup(snapshot, { createdAt = new Date().toISOString() } = {}) {
  return {
    app: 'atelier',
    version: BACKUP_VERSION,
    createdAt,
    snapshot: validateBackupSnapshot(snapshot),
  };
}

export function parseAtelierBackup(input) {
  const backup = typeof input === 'string' ? JSON.parse(input) : input;
  requireObject(backup, 'backup');
  if (backup.app !== 'atelier') throw new TypeError('Backup is not an Atelier backup.');
  if (backup.version !== BACKUP_VERSION) throw new TypeError(`Unsupported Atelier backup version ${backup.version}.`);
  return createAtelierBackup(validateBackupSnapshot(backup.snapshot), { createdAt: backup.createdAt || new Date().toISOString() });
}
