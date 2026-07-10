import { makeUrl, openmrsFetch } from '@openmrs/esm-framework';

import { revalidateFuaRequestCaches } from './useFuaRequests';
import { FuaGenerationError, generateFuaFromVisit, generateFuasFromVisits } from './useVisit';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  makeUrl: vi.fn((path: string) => `/openmrs${path}`),
  openmrsFetch: vi.fn(),
}));

vi.mock('./useFuaRequests', () => ({
  revalidateFuaRequestCaches: vi.fn(),
}));

const mockFetch = vi.fn<typeof window.fetch>();
const mockMakeUrl = vi.mocked(makeUrl);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockRevalidateFuaRequestCaches = vi.mocked(revalidateFuaRequestCaches);

describe('FUA generation requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    mockRevalidateFuaRequestCaches.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handles a 401 locally instead of delegating to the redirecting OpenMRS fetcher', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Contract mismatch' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(generateFuaFromVisit('visit/unsafe?value')).rejects.toEqual(
      expect.objectContaining({
        name: 'FuaGenerationError',
        status: 401,
        responseBody: { error: { message: 'Contract mismatch' } },
      }),
    );

    expect(mockMakeUrl).toHaveBeenCalledWith('/ws/module/fua/generateFromVisit/visit%2Funsafe%3Fvalue');
    expect(mockFetch).toHaveBeenCalledWith(
      '/openmrs/ws/module/fua/generateFromVisit/visit%2Funsafe%3Fvalue',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'manual',
      }),
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(mockRevalidateFuaRequestCaches).not.toHaveBeenCalled();
  });

  it('returns the response and revalidates FUA caches after a successful generation', async () => {
    const response = new Response(JSON.stringify({ uuid: 'fua-uuid' }), { status: 200 });
    mockFetch.mockResolvedValueOnce(response);

    await expect(generateFuaFromVisit('visit-uuid')).resolves.toBe(response);

    expect(mockRevalidateFuaRequestCaches).toHaveBeenCalledTimes(1);
  });

  it('converts network failures into a recoverable FUA generation error', async () => {
    const networkError = new TypeError('Network request failed');
    mockFetch.mockRejectedValueOnce(networkError);

    await expect(generateFuaFromVisit('visit-uuid')).rejects.toEqual(
      expect.objectContaining({
        name: 'FuaGenerationError',
        status: null,
        responseBody: networkError,
      }),
    );
    expect(mockRevalidateFuaRequestCaches).not.toHaveBeenCalled();
  });

  it('reports partial bulk failures without redirecting or rejecting the whole operation', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ uuid: 'fua-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('Invalid visit payload', { status: 422 }));

    await expect(generateFuasFromVisits(['visit-1', 'visit-2'])).resolves.toEqual({ successful: 1, failed: 1 });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(mockRevalidateFuaRequestCaches).toHaveBeenCalledTimes(1);
  });

  it('preserves the HTTP status and non-JSON response body for diagnostics', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }));

    const error = await generateFuaFromVisit('visit-uuid').catch((caughtError) => caughtError);

    expect(error).toBeInstanceOf(FuaGenerationError);
    expect(error).toMatchObject({ status: 503, responseBody: 'Service unavailable' });
  });
});
