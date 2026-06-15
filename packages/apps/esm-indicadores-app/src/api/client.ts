import { openmrsFetch, type FetchConfig, type FetchResponse } from '@openmrs/esm-framework';

import { activateMockMode, resetMockMode } from './mock-mode';

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error('No se pudo completar la solicitud.');
}

export async function fetchJson<T>(url: string, init?: FetchConfig): Promise<T> {
  const response = (await openmrsFetch(url, init)) as FetchResponse<T>;
  return response.data;
}

export async function withMockFallback<T>(request: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  try {
    const data = await request();
    resetMockMode();
    return data;
  } catch (error) {
    const normalized = normalizeError(error);
    activateMockMode(normalized.message);
    return fallback();
  }
}

export function toJsonBody(payload: unknown): Pick<FetchConfig, 'headers' | 'body'> {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  };
}
