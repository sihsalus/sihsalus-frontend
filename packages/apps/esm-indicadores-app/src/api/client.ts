import { type FetchConfig, type FetchResponse, logError, openmrsFetch } from '@openmrs/esm-framework';
import { translate } from '../i18n';
import { isDemoDataEnabled } from './config';
import { settleBackendOperation, startBackendOperation } from './mock-mode';

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error(translate('requestFailed', 'No se pudo completar la solicitud.'));
}

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { status?: number; statusCode?: number; response?: { status?: number } };
  return candidate.response?.status ?? candidate.status ?? candidate.statusCode;
}

function canUseDemoFallback(error: unknown): boolean {
  const status = getHttpStatus(error);
  if (status !== undefined) {
    return status >= 500;
  }

  // Only network-level failures qualify. Matching the message keeps genuine
  // fetch errors (e.g. "Failed to fetch", "fetch failed") covered while
  // excluding arbitrary TypeErrors thrown by application bugs — otherwise a
  // code defect would silently flip the whole app into demo mode.
  const message = normalizeError(error).message;
  return /network|failed to fetch|fetch failed|load failed/i.test(message);
}

export async function fetchJson<T>(url: string, init?: FetchConfig): Promise<T> {
  const response = (await openmrsFetch(url, { ...init, rejectOnAuthFailure: true })) as FetchResponse<T>;
  return response.data;
}

export async function withMockFallback<T>(request: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  startBackendOperation();
  try {
    const data = await request();
    settleBackendOperation(true);
    return data;
  } catch (error) {
    const normalized = normalizeError(error);
    logError(error, 'Indicadores: consulta a reportes-sql');
    const backendUnavailable = canUseDemoFallback(error);
    if (backendUnavailable && (await isDemoDataEnabled())) {
      // The batch verdict decides if demo mode flips on; settle now so a
      // later-successful sibling read cannot override this failure.
      settleBackendOperation(false, normalized.message, true);
      return fallback();
    }

    if (backendUnavailable) {
      settleBackendOperation(false, normalized.message, false);
    } else {
      // Non-qualifying error (4xx, app TypeError): do not flip the backend
      // verdict either way — let the rest of the batch decide.
      settleBackendOperation(true);
    }
    throw error;
  }
}

/**
 * Variant of `fetchJson` for mutating endpoints (POST/PUT/PATCH/DELETE).
 *
 * Unlike `withMockFallback`, this helper does NOT swallow backend failures
 * with a mock response — a real mutation that the backend rejected must
 * surface the error to the UI so the user does not believe a write
 * succeeded when it actually failed. The mock-mode store is still reset
 * on success so the rest of the app reflects a healthy backend.
 */
export async function mutateJson<T>(url: string, init?: FetchConfig): Promise<T> {
  startBackendOperation();
  try {
    const response = (await openmrsFetch(url, { ...init, rejectOnAuthFailure: true })) as FetchResponse<T>;
    settleBackendOperation(true);
    return response.data;
  } catch (error) {
    // Mutations never fall back to demo data, but they still feed the batch
    // verdict: a failing write means the backend is not healthy.
    const normalized = normalizeError(error);
    settleBackendOperation(false, normalized.message, false);
    throw error;
  }
}

export function toJsonBody(payload: unknown): Pick<FetchConfig, 'headers' | 'body'> {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  };
}
