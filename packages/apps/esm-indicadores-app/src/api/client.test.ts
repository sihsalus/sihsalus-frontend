import { logError, openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchJson, mutateJson } from './client';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockLogError = vi.mocked(logError);

describe('indicators API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns backend data through fetchJson', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { value: 7 } } as never);

    await expect(fetchJson<{ value: number }>('/resource')).resolves.toEqual({ value: 7 });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith('/resource', expect.objectContaining({ rejectOnAuthFailure: true }));
  });

  it.each(['read', 'write'])('rejects an expired session instead of leaving a %s pending', async (operation) => {
    const error = Object.assign(new Error('session expired'), { response: { status: 401 } });
    mockOpenmrsFetch.mockRejectedValue(error);

    const request = operation === 'read' ? fetchJson('/resource') : mutateJson('/resource', { method: 'POST' });

    await expect(request).rejects.toBe(error);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith('/resource', expect.objectContaining({ rejectOnAuthFailure: true }));
  });

  it.each([500, 502])('propagates read errors with status %s to the caller', async (status) => {
    const error = Object.assign(new Error(`technical ${status}`), { response: { status } });
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(fetchJson('/resource')).rejects.toBe(error);
    expect(mockLogError).toHaveBeenCalledWith(error, 'Indicadores: consulta a reportes-sql');
  });

  it.each([401, 403, 404, 422])('propagates HTTP %s responses to the caller', async (status) => {
    const error = Object.assign(new Error(`technical ${status}`), { response: { status } });
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(fetchJson('/resource')).rejects.toBe(error);
  });

  it('propagates network errors for reads', async () => {
    const error = new TypeError('Failed to fetch');
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(fetchJson('/resource')).rejects.toBe(error);
  });

  it('never treats an arbitrary application TypeError as a backend response', async () => {
    const error = new TypeError('Cannot read properties of undefined (reading "items")');
    mockOpenmrsFetch.mockResolvedValue({ data: undefined } as never);
    mockOpenmrsFetch.mockRejectedValueOnce(error);

    await expect(fetchJson('/resource')).rejects.toBe(error);
  });

  it('propagates mutation failures to the caller', async () => {
    const error = Object.assign(new Error('write rejected'), { response: { status: 422 } });
    mockOpenmrsFetch.mockRejectedValue(error);

    await expect(mutateJson('/resource', { method: 'POST', body: { value: 1 } })).rejects.toBe(error);
    expect(mockLogError).toHaveBeenCalledWith(error, 'Indicadores: mutación a reportes-sql');
  });

  it('returns the backend payload on a successful mutation', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { id: 'real-id' } } as never);

    await expect(mutateJson('/resource', { method: 'PUT', body: { value: 1 } })).resolves.toEqual({ id: 'real-id' });
  });
});
