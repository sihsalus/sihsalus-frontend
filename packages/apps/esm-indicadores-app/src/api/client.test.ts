import { logError, openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchJson, mutateJson, withMockFallback } from './client';
import { isDemoDataEnabled } from './config';
import { settleBackendOperation, startBackendOperation } from './mock-mode';

vi.mock('./config', () => ({ isDemoDataEnabled: vi.fn() }));
vi.mock('./mock-mode', () => ({
  settleBackendOperation: vi.fn(),
  startBackendOperation: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockLogError = vi.mocked(logError);
const mockIsDemoDataEnabled = vi.mocked(isDemoDataEnabled);
const mockStart = vi.mocked(startBackendOperation);
const mockSettle = vi.mocked(settleBackendOperation);

describe('indicators API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoDataEnabled.mockResolvedValue(false);
  });

  it('returns backend data through fetchJson without touching the batch verdict', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { value: 7 } } as never);

    await expect(fetchJson<{ value: number }>('/resource')).resolves.toEqual({ value: 7 });
    // fetchJson is a bare transport helper; only withMockFallback/mutateJson
    // join the batch verdict.
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it.each(['read', 'write'])('rejects an expired session instead of leaving a %s pending', async (operation) => {
    const error = Object.assign(new Error('session expired'), { response: { status: 401 } });
    mockOpenmrsFetch.mockRejectedValue(error);

    const request = operation === 'read' ? fetchJson('/resource') : mutateJson('/resource', { method: 'POST' });

    await expect(request).rejects.toBe(error);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith('/resource', expect.objectContaining({ rejectOnAuthFailure: true }));
  });

  it.each([500, 502])('fails closed for read errors with status %s when demo is disabled', async (status) => {
    const error = Object.assign(new Error(`technical ${status}`), { response: { status } });
    const fallback = vi.fn(() => ({ fake: true }));
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(withMockFallback(() => fetchJson('/resource'), fallback)).rejects.toBe(error);
    expect(fallback).not.toHaveBeenCalled();
    expect(mockSettle).toHaveBeenCalledWith(false, `technical ${status}`, false);
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
    // 4xx does not flip the batch verdict either way.
    expect(mockSettle).toHaveBeenCalledWith(true);
    expect(mockSettle).not.toHaveBeenCalledWith(false, expect.anything(), expect.anything());
  });

  it('uses example data for reads only when demo mode is explicitly enabled', async () => {
    const error = new Error('Network Error');
    const fallback = vi.fn(() => ({ demo: true }));
    mockIsDemoDataEnabled.mockResolvedValue(true);
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(withMockFallback(() => fetchJson('/resource'), fallback)).resolves.toEqual({ demo: true });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(mockSettle).toHaveBeenCalledWith(false, 'Network Error', true);
  });

  it('never treats an arbitrary application TypeError as a network failure', async () => {
    const error = new TypeError('Cannot read properties of undefined (reading "items")');
    const fallback = vi.fn(() => ({ demo: true }));
    mockIsDemoDataEnabled.mockResolvedValue(true);
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(withMockFallback(() => fetchJson('/resource'), fallback)).rejects.toBe(error);
    expect(fallback).not.toHaveBeenCalled();
    expect(mockSettle).toHaveBeenCalledWith(true);
    expect(mockSettle).not.toHaveBeenCalledWith(false, expect.anything(), expect.anything());
  });

  it('never invokes a fallback for mutations, even when demo mode is enabled', async () => {
    const error = Object.assign(new Error('write rejected'), { response: { status: 422 } });
    mockIsDemoDataEnabled.mockResolvedValue(true);
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(mutateJson('/resource', { method: 'POST', body: { value: 1 } })).rejects.toBe(error);
    // The mutation does not request a demo flip, only contributes unavailable.
    expect(mockSettle).toHaveBeenCalledWith(false, 'write rejected', false);
  });

  it('settles the batch as healthy only after a successful mutation response', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { id: 'real-id' } } as never);

    await expect(mutateJson('/resource', { method: 'PUT', body: { value: 1 } })).resolves.toEqual({ id: 'real-id' });
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockSettle).toHaveBeenCalledTimes(1);
    expect(mockSettle).toHaveBeenCalledWith(true);
  });

  it('uses example data when a qualifying 5xx failure and concurrent successful read share the batch (interaction-level guard)', async () => {
    // This case is exercised by mock-mode.test.ts at the store level. Here we
    // only assert that withMockFallback reports `false / usesDemo=true` to the
    // store on a qualifying failure; the store batches the verdict.
    const error = Object.assign(new Error('boom'), { response: { status: 503 } });
    const fallback = vi.fn(() => ({ demo: true }));
    mockIsDemoDataEnabled.mockResolvedValue(true);
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(withMockFallback(() => fetchJson('/resource'), fallback)).resolves.toEqual({ demo: true });
    expect(mockSettle).toHaveBeenCalledWith(false, 'boom', true);
  });
});
