import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { refreshOfflineCacheEntry } from './offline-cache';

describe('refreshOfflineCacheEntry', () => {
  let cachePut: ReturnType<typeof vi.fn>;
  let cachedResponses: Map<string, Response>;

  beforeEach(() => {
    cachedResponses = new Map();
    cachePut = vi.fn(async (request: RequestInfo | URL, response: Response) => {
      const key = request instanceof Request ? request.url : request.toString();
      cachedResponses.set(key, response.clone());
    });
    vi.stubGlobal('caches', {
      open: vi.fn(async () => ({
        put: cachePut,
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a stale offline fallback, preserves it, and replaces it only after a fresh response', async () => {
    const stableUrl = 'https://example.test/openmrs/ws/rest/v1/form/form-uuid?v=full';
    cachedResponses.set(stableUrl, new Response('stale form data', { status: 200 }));
    let networkAvailable = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const requestUrl = input instanceof Request ? input.url : input.toString();

      if (!networkAvailable) {
        return cachedResponses.get(requestUrl)?.clone() ?? new Response(null, { status: 503 });
      }

      return new Response('fresh form data', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const failedAttempt = refreshOfflineCacheEntry(stableUrl);
    await expect(failedAttempt).rejects.toThrow('The offline resource could not be refreshed from the network.');
    await expect(failedAttempt).rejects.not.toThrow(/example\.test|form-uuid|503/);
    expect(cachePut).not.toHaveBeenCalled();
    await expect(cachedResponses.get(stableUrl)?.clone().text()).resolves.toBe('stale form data');

    const firstRefreshCall = fetchMock.mock.calls[0];
    expect(firstRefreshCall?.[0].toString()).toContain('_openmrsOfflineRefresh=');
    expect(firstRefreshCall?.[1]).toMatchObject({
      cache: 'no-store',
      headers: { 'x-omrs-offline-caching-strategy': 'network-only-or-cache-only' },
    });

    networkAvailable = true;
    const abortController = new AbortController();
    await expect(refreshOfflineCacheEntry(stableUrl, abortController.signal)).resolves.toBeUndefined();

    const secondRefreshCall = fetchMock.mock.calls[1];
    expect(secondRefreshCall?.[0].toString()).not.toBe(firstRefreshCall?.[0].toString());
    expect(secondRefreshCall?.[1]).toMatchObject({ signal: abortController.signal });
    expect(cachePut).toHaveBeenCalledOnce();
    expect(cachePut).toHaveBeenCalledWith(stableUrl, expect.any(Response));
    await expect(cachedResponses.get(stableUrl)?.clone().text()).resolves.toBe('fresh form data');
  });

  it('does not start a request for an already-aborted refresh', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const abortController = new AbortController();
    abortController.abort();

    await expect(refreshOfflineCacheEntry('https://example.test/resource', abortController.signal)).rejects.toThrow(
      'The offline resource could not be refreshed from the network.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cachePut).not.toHaveBeenCalled();
  });
});
