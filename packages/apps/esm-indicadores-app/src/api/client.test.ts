import { logError, openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchJson, mutateJson, withMockFallback } from './client';
import { isDemoDataEnabled } from './config';
import { activateMockMode, reportBackendUnavailable, resetMockMode } from './mock-mode';

vi.mock('./config', () => ({ isDemoDataEnabled: vi.fn() }));
vi.mock('./mock-mode', () => ({
  activateMockMode: vi.fn(),
  reportBackendUnavailable: vi.fn(),
  resetMockMode: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockLogError = vi.mocked(logError);
const mockIsDemoDataEnabled = vi.mocked(isDemoDataEnabled);

describe('indicators API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoDataEnabled.mockResolvedValue(false);
  });

  it('returns backend data without enabling demo mode', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { value: 7 } } as never);

    await expect(fetchJson<{ value: number }>('/resource')).resolves.toEqual({ value: 7 });
    expect(activateMockMode).not.toHaveBeenCalled();
  });

  it.each([500, 502])('fails closed for read errors with status %s when demo is disabled', async (status) => {
    const error = Object.assign(new Error(`technical ${status}`), { response: { status } });
    const fallback = vi.fn(() => ({ fake: true }));
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(withMockFallback(() => fetchJson('/resource'), fallback)).rejects.toBe(error);
    expect(fallback).not.toHaveBeenCalled();
    expect(reportBackendUnavailable).toHaveBeenCalledWith(`technical ${status}`);
    expect(mockLogError).toHaveBeenCalledWith(error, 'Indicadores: consulta a reportes-sql');
  });

  it.each([
    401, 403, 404, 422,
  ])('never replaces an HTTP %s response with examples, even when demo is enabled', async (status) => {
    const error = Object.assign(new Error(`technical ${status}`), { response: { status } });
    const fallback = vi.fn(() => ({ fake: true }));
    mockIsDemoDataEnabled.mockResolvedValue(true);
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(withMockFallback(() => fetchJson('/resource'), fallback)).rejects.toBe(error);
    expect(fallback).not.toHaveBeenCalled();
    expect(activateMockMode).not.toHaveBeenCalled();
    expect(reportBackendUnavailable).not.toHaveBeenCalled();
  });

  it('uses example data for reads only when demo mode is explicitly enabled', async () => {
    const error = new Error('Network Error');
    const fallback = vi.fn(() => ({ demo: true }));
    mockIsDemoDataEnabled.mockResolvedValue(true);
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(withMockFallback(() => fetchJson('/resource'), fallback)).resolves.toEqual({ demo: true });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(activateMockMode).toHaveBeenCalledWith('Network Error');
  });

  it('never invokes a fallback for mutations, even when demo mode is enabled', async () => {
    const error = Object.assign(new Error('write rejected'), { response: { status: 422 } });
    mockIsDemoDataEnabled.mockResolvedValue(true);
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(mutateJson('/resource', { method: 'POST', body: { value: 1 } })).rejects.toBe(error);
    expect(activateMockMode).not.toHaveBeenCalled();
    expect(reportBackendUnavailable).not.toHaveBeenCalled();
  });

  it('resets backend state only after a successful mutation response', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { id: 'real-id' } } as never);

    await expect(mutateJson('/resource', { method: 'PUT', body: { value: 1 } })).resolves.toEqual({ id: 'real-id' });
    expect(resetMockMode).toHaveBeenCalledTimes(1);
  });
});
