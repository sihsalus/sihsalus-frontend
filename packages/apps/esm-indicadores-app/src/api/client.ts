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

export async function fetchJson<T>(url: string, init?: FetchConfig): Promise<T> {
  try {
    const response = (await openmrsFetch(url, { ...init, rejectOnAuthFailure: true })) as FetchResponse<T>;
    return response.data;
  } catch (error) {
    logError(error, 'Indicadores: consulta a reportes-sql');
    throw normalizeError(error);
  }
}

export async function mutateJson<T>(url: string, init?: FetchConfig): Promise<T> {
  try {
    const response = (await openmrsFetch(url, { ...init, rejectOnAuthFailure: true })) as FetchResponse<T>;
    return response.data;
  } catch (error) {
    logError(error, 'Indicadores: mutación a reportes-sql');
    throw normalizeError(error);
  }
}

export function toJsonBody(payload: unknown): Pick<FetchConfig, 'headers' | 'body'> {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  };
}
