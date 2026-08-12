import { omrsOfflineCachingStrategyHttpHeaderName, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  fetchFreshPatientVitalStatus,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
} from './patient-vital-status.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('fetchFreshPatientVitalStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1_786_554_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses an uncached REST representation and maps a living patient', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: { person: { uuid: 'person-uuid', dead: false, deathDate: null } },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(fetchFreshPatientVitalStatus('patient-uuid')).resolves.toEqual({
      dead: false,
      deathDate: null,
      isDeceased: false,
    });

    const [requestUrl, requestInit] = mockOpenmrsFetch.mock.calls[0];
    const parsedUrl = new URL(String(requestUrl), 'https://example.test');
    expect(parsedUrl.pathname).toBe(`${restBaseUrl}/patient/patient-uuid`);
    expect(parsedUrl.searchParams.get('v')).toBe('custom:(uuid,person:(uuid,dead,deathDate))');
    expect(parsedUrl.searchParams.get('_')).toMatch(/^1786554000000-\d+$/);
    expect(requestInit).toEqual({
      headers: {
        'Cache-Control': 'no-store',
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
    });
  });

  it('treats either death field as deceased', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: { person: { uuid: 'person-uuid', dead: false, deathDate: '2026-08-12T15:41:28.000Z' } },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(fetchFreshPatientVitalStatus('patient-uuid')).resolves.toMatchObject({ isDeceased: true });
  });

  it('uses a different cache key for every authoritative check', async () => {
    vi.mocked(Date.now).mockReturnValue(1_786_554_000_001);
    mockOpenmrsFetch.mockResolvedValue({
      data: { person: { uuid: 'person-uuid', dead: false, deathDate: null } },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await fetchFreshPatientVitalStatus('patient-uuid');
    await fetchFreshPatientVitalStatus('patient-uuid');

    const requestUrls = mockOpenmrsFetch.mock.calls.map(([url]) => String(url));
    expect(requestUrls[0]).not.toBe(requestUrls[1]);
    expect(new URL(requestUrls[0], 'https://example.test').searchParams.get('_')).toMatch(
      /^1786554000001-\d+$/,
    );
    expect(new URL(requestUrls[1], 'https://example.test').searchParams.get('_')).toMatch(
      /^1786554000001-\d+$/,
    );
  });

  it('fails closed when the network-only request cannot be completed', async () => {
    const networkError = new TypeError('Failed to fetch');
    mockOpenmrsFetch.mockRejectedValue(networkError);

    await expect(fetchFreshPatientVitalStatus('patient-uuid')).rejects.toBe(networkError);
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('fails closed when the REST representation does not contain vital status', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { person: { uuid: 'person-uuid' } } } as Awaited<
      ReturnType<typeof openmrsFetch>
    >);

    await expect(fetchFreshPatientVitalStatus('patient-uuid')).rejects.toMatchObject({
      code: PATIENT_VITAL_STATUS_UNAVAILABLE,
    });
  });

  it('provides a shared fail-closed assertion for operational writers', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: { person: { uuid: 'person-uuid', dead: true, deathDate: '2026-08-12T15:41:28.000Z' } },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(assertFreshPatientIsAlive('patient-uuid')).rejects.toMatchObject({
      code: DECEASED_PATIENT_OPERATION_BLOCKED,
    });
  });
});
