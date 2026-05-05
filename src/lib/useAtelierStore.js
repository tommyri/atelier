'use client';

import React from 'react';
import { accountStorageScope, clearAtelierStorage, scopedStorageName, writeStoredValue } from './storage.js';
import { ensurePrimaryServer } from './serverConfig.js';
import { validateServerPreferenceEvent } from './blossomPreferences.js';
import { validateRelayListEvent, validateRelayRecord } from './nostrRelayList.js';
import { validateBackupSnapshot } from './atelierBackup.js';
import { usePersistentState } from './usePersistentState.js';
import {
  DEFAULT_SESSION,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  validateArray,
  validateBlob,
  validateCollection,
  validateProfile,
  validateServer,
  validateSession,
  validateSettings,
  validateUploadJob,
} from './schemas.js';

const validateServers = (value) => ensurePrimaryServer(validateArray(value, validateServer, 'servers'));
const validateBlobs = (value) => validateArray(value, validateBlob, 'blobs');
const validateCollections = (value) => validateArray(value, validateCollection, 'collections');
const validateUploadJobs = (value) => validateArray(value, validateUploadJob, 'uploadJobs');
const validateRelays = (value) => validateArray(value, validateRelayRecord, 'relays');

export function useAtelierStore({ initialLoggedIn = true, initialSettings = {} } = {}) {
  const [session, setSession] = usePersistentState('session', {
    ...DEFAULT_SESSION,
    loggedIn: initialLoggedIn,
  }, validateSession);
  const accountScope = React.useMemo(() => accountStorageScope(session), [session.mode, session.pubkey]);
  const [profile, setProfile] = usePersistentState('profile', DEFAULT_PROFILE, validateProfile);
  const [settings, setSettings] = usePersistentState('settings', { ...DEFAULT_SETTINGS, ...initialSettings }, validateSettings, { scope: accountScope });
  const [servers, setServers] = usePersistentState('servers', [], validateServers, { scope: accountScope });
  const [serverPreferenceEvent, setServerPreferenceEvent] = usePersistentState('serverPreferenceEvent', null, validateServerPreferenceEvent, { scope: accountScope });
  const [relays, setRelays] = usePersistentState('relays', [], validateRelays, { scope: accountScope });
  const [relayListEvent, setRelayListEvent] = usePersistentState('relayListEvent', null, validateRelayListEvent, { scope: accountScope });
  const [blobs, setBlobs] = usePersistentState('blobs', [], validateBlobs);
  const [collections, setCollections] = usePersistentState('collections', [], validateCollections);
  const [uploadJobs, setUploadJobs] = usePersistentState('uploadJobs', [], validateUploadJobs);

  React.useEffect(() => {
    if (initialLoggedIn === false) {
      setSession((current) => current.loggedIn ? { ...current, loggedIn: false } : current);
    }
  }, [initialLoggedIn, setSession]);

  const logIn = React.useCallback((mode = 'demo') => {
    setSession((current) => validateSession({ ...current, loggedIn: true, mode }));
  }, [setSession]);

  const logOut = React.useCallback(() => {
    clearAtelierStorage();
    setSession(validateSession({ ...DEFAULT_SESSION, loggedIn: false }));
    setProfile(validateProfile(DEFAULT_PROFILE));
    setSettings(DEFAULT_SETTINGS);
    setServers([]);
    setServerPreferenceEvent(null);
    setRelays([]);
    setRelayListEvent(null);
    setBlobs([]);
    setCollections([]);
    setUploadJobs([]);
  }, [setBlobs, setCollections, setProfile, setRelayListEvent, setRelays, setServerPreferenceEvent, setServers, setSession, setSettings, setUploadJobs]);

  const resetLocalState = React.useCallback(() => {
    clearAtelierStorage();
    setSession({ ...DEFAULT_SESSION, loggedIn: initialLoggedIn });
    setProfile(validateProfile(DEFAULT_PROFILE));
    setSettings(DEFAULT_SETTINGS);
    setServers([]);
    setServerPreferenceEvent(null);
    setRelays([]);
    setRelayListEvent(null);
    setBlobs([]);
    setCollections([]);
    setUploadJobs([]);
  }, [initialLoggedIn, setBlobs, setCollections, setProfile, setRelayListEvent, setRelays, setServerPreferenceEvent, setServers, setSession, setSettings, setUploadJobs]);

  const restoreSnapshot = React.useCallback((snapshot) => {
    const next = validateBackupSnapshot(snapshot);
    const nextScope = accountStorageScope(next.session);
    writeStoredValue(scopedStorageName('settings', nextScope), next.settings, validateSettings);
    writeStoredValue(scopedStorageName('servers', nextScope), next.servers, validateServers);
    writeStoredValue(scopedStorageName('serverPreferenceEvent', nextScope), next.serverPreferenceEvent, validateServerPreferenceEvent);
    writeStoredValue(scopedStorageName('relays', nextScope), next.relays, validateRelays);
    writeStoredValue(scopedStorageName('relayListEvent', nextScope), next.relayListEvent, validateRelayListEvent);
    setSession(next.session);
    setProfile(next.profile);
    setSettings(next.settings);
    setServers(next.servers);
    setServerPreferenceEvent(next.serverPreferenceEvent);
    setRelays(next.relays);
    setRelayListEvent(next.relayListEvent);
    setBlobs(next.blobs);
    setCollections(next.collections);
    setUploadJobs(next.uploadJobs);
  }, [setBlobs, setCollections, setProfile, setRelayListEvent, setRelays, setServerPreferenceEvent, setServers, setSession, setSettings, setUploadJobs]);

  return {
    session,
    setSession,
    logIn,
    logOut,
    profile,
    setProfile,
    settings,
    setSettings,
    servers,
    setServers,
    serverPreferenceEvent,
    setServerPreferenceEvent,
    relays,
    setRelays,
    relayListEvent,
    setRelayListEvent,
    blobs,
    setBlobs,
    lists: collections,
    setLists: setCollections,
    uploadJobs,
    setUploadJobs,
    resetLocalState,
    restoreSnapshot,
  };
}
