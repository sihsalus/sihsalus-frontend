import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { useEffect, useState } from 'react';

import { type Config } from '../config-schema';

export interface IndicatorsHealthState {
  isChecking: boolean;
  isMockMode: boolean;
  errorMessage?: string;
}

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

export function useIndicatorsHealth(): IndicatorsHealthState {
  const config = useConfig<Config>();
  const [state, setState] = useState<IndicatorsHealthState>({
    isChecking: true,
    isMockMode: false,
  });

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const checkHealth = async () => {
      try {
        await openmrsFetch(`${config.indicatorsApiPath}/indicators`, {
          signal: controller.signal,
        });

        if (isMounted) {
          setState({
            isChecking: false,
            isMockMode: false,
          });
        }
      } catch (error) {
        if (isMounted && !controller.signal.aborted) {
          setState({
            isChecking: false,
            isMockMode: true,
            errorMessage: normalizeErrorMessage(error),
          });
        }
      }
    };

    checkHealth();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [config.indicatorsApiPath]);

  return state;
}
