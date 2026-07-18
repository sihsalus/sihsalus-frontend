import { makeUrl, openmrsFetch } from '@openmrs/esm-framework';
import {
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
} from '@openmrs/esm-patient-common-lib';

import { resolveFuaGeneratorEndpoint } from '../constant';

import { revalidateFuaRequestCaches } from './useFuaRequests';
import {
  FuaGenerationError,
  generateFuaFromVisit,
  generateFuasFromVisits,
  getVisitAccreditationStatusUuid,
  getVisitFinanciadorDisplay,
  getVisitFinanciadorUuid,
  isSisFinanciador,
  type VisitSummary,
} from './useVisit';

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

describe('visit financiador helpers', () => {
  const sisConceptUuid = 'sis-concept-uuid';
  const legacySisUuids = ['legacy-gratuito-uuid', 'legacy-semicontributivo-uuid'];

  const visit: VisitSummary = {
    uuid: 'visit-uuid',
    attributes: [
      {
        uuid: 'attr-financiador',
        attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
        value: { uuid: sisConceptUuid, display: 'SIS' },
      },
      {
        uuid: 'attr-acreditacion',
        attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
        value: { uuid: 'vigente-concept-uuid', display: 'Vigente' },
      },
    ],
  };

  it('reads the financiador and accreditation status from the visit attributes', () => {
    expect(getVisitFinanciadorUuid(visit)).toBe(sisConceptUuid);
    expect(getVisitFinanciadorDisplay(visit)).toBe('SIS');
    expect(getVisitAccreditationStatusUuid(visit)).toBe('vigente-concept-uuid');
  });

  it('returns null when the visit has no financiador or accreditation attributes', () => {
    const bareVisit: VisitSummary = { uuid: 'visit-uuid', attributes: [] };

    expect(getVisitFinanciadorUuid(bareVisit)).toBeNull();
    expect(getVisitFinanciadorDisplay(bareVisit)).toBeNull();
    expect(getVisitAccreditationStatusUuid(bareVisit)).toBeNull();
    expect(getVisitFinanciadorUuid({ uuid: 'visit-uuid' })).toBeNull();
  });

  it('treats the canonical SIS concept and legacy SIS products as SIS', () => {
    expect(isSisFinanciador(sisConceptUuid, sisConceptUuid, legacySisUuids)).toBe(true);
    expect(isSisFinanciador('legacy-gratuito-uuid', sisConceptUuid, legacySisUuids)).toBe(true);
    expect(isSisFinanciador('private-concept-uuid', sisConceptUuid, legacySisUuids)).toBe(false);
    expect(isSisFinanciador(null, sisConceptUuid, legacySisUuids)).toBe(false);
  });
});

describe('resolveFuaGeneratorEndpoint', () => {
  it('falls back to the relative gateway path when no endpoint is configured', () => {
    expect(resolveFuaGeneratorEndpoint('')).toBe('/services/fua-generator');
    expect(resolveFuaGeneratorEndpoint('   ')).toBe('/services/fua-generator');
    expect(resolveFuaGeneratorEndpoint(undefined)).toBe('/services/fua-generator');
  });

  it('keeps an explicitly configured absolute endpoint', () => {
    expect(resolveFuaGeneratorEndpoint('https://example.org/fua')).toBe('https://example.org/fua');
  });
});
