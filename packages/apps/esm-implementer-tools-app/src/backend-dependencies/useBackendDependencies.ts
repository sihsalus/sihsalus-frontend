import { useCallback, useEffect, useRef, useState } from 'react';

import type { ResolvedDependenciesModule } from './openmrs-backend-dependencies';
import {
  checkModules,
  getBackendConnectionErrorMessage,
  getBackendConnectionErrorStatus,
} from './openmrs-backend-dependencies';

export interface UseBackendDependenciesResult {
  modules: Array<ResolvedDependenciesModule>;
  error: string | null;
  errorStatus: number | null;
  isRetrying: boolean;
  retry(): Promise<void>;
}

export function useBackendDependencies(): UseBackendDependenciesResult {
  const [modulesWithMissingBackendModules, setModulesWithMissingBackendModules] = useState<
    Array<ResolvedDependenciesModule>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const activeRequestId = useRef(0);

  const loadBackendDependencies = useCallback(async (forceRefresh = false) => {
    const requestId = activeRequestId.current + 1;
    activeRequestId.current = requestId;
    setIsRetrying(true);

    try {
      const modules = await checkModules({ forceRefresh });
      if (activeRequestId.current !== requestId) {
        return;
      }

      setModulesWithMissingBackendModules(modules);
      setError(null);
      setErrorStatus(null);
    } catch (loadError) {
      if (activeRequestId.current !== requestId) {
        return;
      }

      const errorMessage =
        getBackendConnectionErrorMessage() ??
        (loadError instanceof Error ? loadError.message : 'Unknown error fetching backend modules');
      setError(errorMessage);
      setErrorStatus(getBackendConnectionErrorStatus());
    } finally {
      if (activeRequestId.current === requestId) {
        setIsRetrying(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadBackendDependencies();

    return () => {
      activeRequestId.current += 1;
    };
  }, [loadBackendDependencies]);

  const retry = useCallback(() => loadBackendDependencies(true), [loadBackendDependencies]);

  return { modules: modulesWithMissingBackendModules, error, errorStatus, isRetrying, retry };
}
