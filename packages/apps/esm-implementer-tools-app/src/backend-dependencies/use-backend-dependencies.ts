import { useEffect, useState } from 'react';

import type { ResolvedDependenciesModule } from './openmrs-backend-dependencies';
import { checkModules, getBackendConnectionErrorMessage } from './openmrs-backend-dependencies';

export interface UseBackendDependenciesResult {
  modules: Array<ResolvedDependenciesModule>;
  error: string | null;
}

export function useBackendDependencies(): UseBackendDependenciesResult {
  const [modulesWithMissingBackendModules, setModulesWithMissingBackendModules] = useState<
    Array<ResolvedDependenciesModule>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // loading missing modules
    checkModules().then((modules) => {
      setModulesWithMissingBackendModules(modules);
      // Check if there was a connection error
      const errorMessage = getBackendConnectionErrorMessage();
      setError(errorMessage);
    });
  }, []);

  return { modules: modulesWithMissingBackendModules, error };
}
