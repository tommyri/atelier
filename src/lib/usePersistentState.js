'use client';

import React from 'react';
import { readStoredValue, scopedStorageName, writeStoredValue } from './storage.js';

const useStorageHydrationEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

export function usePersistentState(name, initialValue, validator, { scope = '' } = {}) {
  const storageName = scopedStorageName(name, scope);
  const [hydrated, setHydrated] = React.useState(false);
  const [value, setValue] = React.useState(() => validator(initialValue));

  useStorageHydrationEffect(() => {
    setValue(readStoredValue(storageName, validator(initialValue), validator));
    setHydrated(true);
  }, [storageName]);

  const setPersistentValue = React.useCallback((nextValue) => {
    setValue((previous) => {
      const next = typeof nextValue === 'function' ? nextValue(previous) : nextValue;
      return writeStoredValue(storageName, next, validator);
    });
  }, [storageName, validator]);

  return [value, setPersistentValue, hydrated];
}
