import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { useEffect } from 'react';

import { activateMockMode, resetMockMode } from '../api/mock-mode';
import { type Config } from '../config-schema';

const DEFAULT_ERROR = 'No se pudo conectar con el API de indicadores.';

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return DEFAULT_ERROR;
}

/** Side-effect hook that checks backend health on mount and updates the mock-mode store. */
export function useIndicatorsHealth(): void {
  const config = useConfig<Config>();

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const checkHealth = async () => {
      try {
        await openmrsFetch(`${config.indicatorsApiPath.replace(/\/+$/, '')}/health`, {
          signal: controller.signal,
        });

        if (isMounted) {
          resetMockMode();
        }
      } catch (error) {
        if (isMounted && !controller.signal.aborted) {
          activateMockMode(normalizeErrorMessage(error));
        }
      }
    };

    checkHealth();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [config.indicatorsApiPath]);
}
