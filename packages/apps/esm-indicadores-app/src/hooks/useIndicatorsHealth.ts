import { logError, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { useEffect } from 'react';

import { settleBackendOperation, startBackendOperation } from '../api/mock-mode';
import { type ConfigObject } from '../config-schema';
import { translate } from '../i18n';

const DEFAULT_ERROR = translate('indicatorsApiConnectionError', 'No se pudo conectar con el API de indicadores.');

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
  const config = useConfig<ConfigObject>();

  useEffect(() => {
    let settled = false;
    const controller = new AbortController();

    // Join the global batch so the health result is settled together with
    // any concurrent SWR reads, rather than racing/pisando the verdict they
    // produce. The health check never flips demo mode directly; it only
    // contributes its outcome (ok/fail) to the shared batch verdict.
    startBackendOperation();

    const checkHealth = async () => {
      try {
        await openmrsFetch(`${config.reportesSqlApiPath.replace(/\/+$/, '')}/health`, {
          signal: controller.signal,
          rejectOnAuthFailure: true,
        });
        if (!settled) {
          settled = true;
          settleBackendOperation(true);
        }
      } catch (error) {
        if (settled || controller.signal.aborted) {
          return;
        }
        settled = true;
        const message = normalizeErrorMessage(error);
        logError(error, 'Indicadores: health check de reportes-sql');
        // enableDemoData only affects whether data reads fall back to mock
        // payloads; the health check itself simply contributes "unhealthy"
        // to the batch verdict. The demo/unavailable decision is owned by
        // the data-read settle calls.
        settleBackendOperation(false, message);
      }
    };

    checkHealth();

    return () => {
      // If the component unmounts before the health check resolved (e.g.
      // navigation away during the request), still release the counter slot
      // so other in-flight reads can settle the store. Treat the aborted
      // check as neutral: contributing "ok" would lie — settle it as a
      // no-op success so the batch verdict only reflects the data reads.
      if (!settled) {
        settled = true;
        settleBackendOperation(true);
      }
      controller.abort();
    };
  }, [config.reportesSqlApiPath]);
}
