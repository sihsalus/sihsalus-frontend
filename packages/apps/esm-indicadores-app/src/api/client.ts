import { type FetchConfig, type FetchResponse, logError, openmrsFetch } from '@openmrs/esm-framework';
import { translate } from '../i18n';

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error(translate('requestFailed', 'No se pudo completar la solicitud.'));
}

async function requestJson<T>(url: string, init: FetchConfig | undefined, logContext: string): Promise<T> {
  try {
    const response = (await openmrsFetch(url, { ...init, rejectOnAuthFailure: true })) as FetchResponse<T>;
    return response.data;
  } catch (error) {
    logError(error, logContext);
    throw normalizeError(error);
  }
}

export async function fetchJson<T>(url: string, init?: FetchConfig): Promise<T> {
  return requestJson(url, init, 'Indicadores: consulta a reportes-sql');
}

export async function mutateJson<T>(url: string, init?: FetchConfig): Promise<T> {
  return requestJson(url, init, 'Indicadores: mutación a reportes-sql');
}

export function toJsonBody(payload: unknown): Pick<FetchConfig, 'headers' | 'body'> {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  };
}
