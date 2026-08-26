import { openmrsFetch } from '@openmrs/esm-framework';

import { personDocumentNumberAttributeTypeUuid, personDocumentTypeAttributeTypeUuid } from './identity-documents';
import {
  fetchFreshPatientIdentityByUuid,
  freshPatientIdentityErrorMessage,
  isPersonAlreadyPatient,
  searchLocalIdentityByDocument,
} from './identity-search.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  makeUrl: (path: string) => (path.startsWith('http') ? path : `${globalThis.openmrsBase}${path}`),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('searchLocalIdentityByDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches the number only within the requested document type', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: 'patient-with-hce',
              display: 'HCE collision',
              identifiers: [{ identifier: '11111111', identifierType: { uuid: 'hce-type' } }],
            },
            {
              uuid: 'patient-with-dni',
              display: 'DNI match',
              identifiers: [{ identifier: '11111111', identifierType: { uuid: 'dni-type' } }],
            },
            {
              uuid: 'patient-with-person-dni',
              display: 'Patient with legacy document attributes',
              identifiers: [{ identifier: '22222222', identifierType: { uuid: 'hce-type' } }],
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: 'person-with-passport',
              display: 'Passport collision',
              attributes: [
                { attributeType: { uuid: personDocumentNumberAttributeTypeUuid }, value: '11111111' },
                { attributeType: { uuid: personDocumentTypeAttributeTypeUuid }, value: { uuid: 'passport-concept' } },
              ],
            },
            {
              uuid: 'legacy-person-without-type',
              display: 'Legacy document match',
              attributes: [{ attributeType: { uuid: personDocumentNumberAttributeTypeUuid }, value: '11111111' }],
            },
            {
              uuid: 'patient-with-person-dni',
              display: 'Patient with legacy document attributes',
              attributes: [
                { attributeType: { uuid: personDocumentNumberAttributeTypeUuid }, value: '11111111' },
                { attributeType: { uuid: personDocumentTypeAttributeTypeUuid }, value: { uuid: 'dni-concept' } },
              ],
            },
          ],
        },
      } as never);

    const matches = await searchLocalIdentityByDocument('11111111', undefined, {
      patientIdentifierTypeUuid: 'dni-type',
      personDocumentTypeConceptUuid: 'dni-concept',
    });

    expect(matches).toEqual([
      expect.objectContaining({ kind: 'patient', uuid: 'patient-with-dni', identifierTypeUuid: 'dni-type' }),
      expect.objectContaining({ kind: 'person', uuid: 'legacy-person-without-type' }),
      expect.objectContaining({ kind: 'patient', uuid: 'patient-with-person-dni' }),
    ]);
  });

  it('requires fresh network responses for clinical creation preflight', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] }, ok: true } as never);

    await searchLocalIdentityByDocument(
      '11111111',
      undefined,
      { patientIdentifierTypeUuid: 'dni-type' },
      { requireFreshNetwork: true },
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    const requestUrls = mockOpenmrsFetch.mock.calls.map(([url]) => new URL(String(url), globalThis.location.origin));
    expect(new Set(requestUrls.map((url) => url.pathname))).toEqual(
      new Set(['/openmrs/ws/rest/v1/patient', '/openmrs/ws/rest/v1/person']),
    );
    for (const [url, options] of mockOpenmrsFetch.mock.calls) {
      const requestUrl = new URL(String(url), globalThis.location.origin);
      expect(String(url)).toMatch(/^https?:\/\//);
      expect(requestUrl.origin).toBe(globalThis.location.origin);
      expect(requestUrl.searchParams.has('_bulkPatientImportCheck')).toBe(true);
      expect(options).toEqual(
        expect.objectContaining({
          cache: 'no-store',
          headers: { 'x-omrs-offline-caching-strategy': 'network-only-or-cache-only' },
          rejectOnAuthFailure: true,
        }),
      );
    }
  });

  it('follows every fresh result page before deciding that a DNI is unused', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname.endsWith('/patient') && requestUrl.searchParams.get('startIndex') === '50') {
        return {
          data: {
            results: [
              {
                uuid: 'synthetic-patient-uuid',
                display: 'Synthetic patient',
                identifiers: [{ identifier: '11111111', identifierType: { uuid: 'dni-type' } }],
              },
            ],
          },
          ok: true,
        } as never;
      }
      if (requestUrl.pathname.endsWith('/patient')) {
        requestUrl.searchParams.delete('_bulkPatientImportCheck');
        requestUrl.searchParams.set('startIndex', '50');
        requestUrl.protocol = 'http:';
        requestUrl.host = 'openmrs-internal:8080';
        return {
          data: { results: [], links: [{ rel: 'next', uri: requestUrl.href }] },
          ok: true,
        } as never;
      }
      return { data: { results: [] }, ok: true } as never;
    });

    await expect(
      searchLocalIdentityByDocument(
        '11111111',
        undefined,
        { patientIdentifierTypeUuid: 'dni-type' },
        { requireFreshNetwork: true },
      ),
    ).resolves.toEqual([
      expect.objectContaining({ kind: 'patient', uuid: 'synthetic-patient-uuid', identifier: '11111111' }),
    ]);
    const patientRequests = mockOpenmrsFetch.mock.calls
      .map(([url]) => new URL(String(url), globalThis.location.origin))
      .filter((url) => url.pathname.endsWith('/patient'));
    expect(patientRequests).toHaveLength(2);
    expect(patientRequests[1].origin).toBe(globalThis.location.origin);
  });

  it('fails closed when a fresh pagination link repeats instead of treating the result as complete', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = new URL(String(url));
      requestUrl.searchParams.delete('_bulkPatientImportCheck');
      return {
        data: { results: [], links: [{ rel: 'next', uri: requestUrl.href }] },
        ok: true,
      } as never;
    });

    await expect(
      searchLocalIdentityByDocument('11111111', undefined, {}, { requireFreshNetwork: true }),
    ).rejects.toEqual(new Error(freshPatientIdentityErrorMessage));
  });

  it('rejects a non-2xx fresh search instead of treating it as an unused DNI', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] }, ok: false, status: 403 } as never)
      .mockResolvedValueOnce({ data: { results: [] }, ok: true, status: 200 } as never);

    await expect(
      searchLocalIdentityByDocument('11111111', undefined, {}, { requireFreshNetwork: true }),
    ).rejects.toEqual(new Error(freshPatientIdentityErrorMessage));
  });
});

describe('fetchFreshPatientIdentityByUuid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the exact UUID resource through a cache-busted network request', async () => {
    const patient = {
      uuid: 'synthetic-patient-uuid',
      person: { uuid: 'synthetic-patient-uuid' },
    };
    mockOpenmrsFetch.mockResolvedValueOnce({ data: patient, ok: true } as never);

    await expect(fetchFreshPatientIdentityByUuid('synthetic-patient-uuid')).resolves.toEqual(patient);
    const requestUrl = new URL(String(mockOpenmrsFetch.mock.calls[0][0]), globalThis.location.origin);
    expect(requestUrl.pathname).toBe('/openmrs/ws/rest/v1/patient/synthetic-patient-uuid');
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/patient\/synthetic-patient-uuid\?v=.*&_bulkPatientImportCheck=/),
      expect.objectContaining({
        cache: 'no-store',
        headers: { 'x-omrs-offline-caching-strategy': 'network-only-or-cache-only' },
        rejectOnAuthFailure: true,
      }),
    );
  });

  it('returns absence only for a fresh 404', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(fetchFreshPatientIdentityByUuid('synthetic-patient-uuid')).resolves.toBeNull();
  });

  it('uses a fixed data-free error for authorization and backend failures', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(new Error('403 included private synthetic patient details'));

    await expect(fetchFreshPatientIdentityByUuid('secret-uuid')).rejects.toEqual(
      new Error(freshPatientIdentityErrorMessage),
    );
  });
});

describe('isPersonAlreadyPatient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats a direct 404 status as a person that has not been promoted', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce({ status: 404 });

    await expect(isPersonAlreadyPatient('person-uuid')).resolves.toBe(false);
  });

  it('does not hide authorization or backend failures', async () => {
    const forbidden = { status: 403 };
    mockOpenmrsFetch.mockRejectedValueOnce(forbidden);

    await expect(isPersonAlreadyPatient('person-uuid')).rejects.toBe(forbidden);
  });
});
