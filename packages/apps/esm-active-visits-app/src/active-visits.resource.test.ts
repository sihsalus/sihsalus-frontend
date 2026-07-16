import { openmrsFetch } from '@openmrs/esm-framework';
import { getActiveVisitsForLocation, getFacilityActiveVisits, isLocationAtOrBelow } from './active-visits.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('active visits facility hierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recognizes nested operational locations', () => {
    const wardLocation = {
      uuid: 'ward-uuid',
      parentLocation: {
        uuid: 'upss-uuid',
        parentLocation: { uuid: 'hospital-uuid' },
      },
    };

    expect(isLocationAtOrBelow(wardLocation, 'hospital-uuid')).toBe(true);
    expect(isLocationAtOrBelow(wardLocation, 'upss-uuid')).toBe(true);
    expect(isLocationAtOrBelow(wardLocation, 'other-facility-uuid')).toBe(false);
  });

  it('queries visits for one exact location without includeParentLocations', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as Awaited<ReturnType<typeof openmrsFetch>>);

    await getActiveVisitsForLocation('upss-uuid');

    const requestUrl = String(mockOpenmrsFetch.mock.calls[0]?.[0]);
    expect(requestUrl).toContain('/visit?');
    expect(requestUrl).toContain('location=upss-uuid');
    expect(requestUrl).not.toContain('includeParentLocations');
  });

  it('never requests patient visits outside the login facility hierarchy', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/location?')) {
        return {
          data: {
            results: [{ uuid: 'upss-uuid', parentLocation: { uuid: 'hospital-uuid' } }, { uuid: 'casita-uuid' }],
          },
        } as Awaited<ReturnType<typeof openmrsFetch>>;
      }

      return { data: { results: [] } } as Awaited<ReturnType<typeof openmrsFetch>>;
    });

    await getFacilityActiveVisits('hospital-uuid');

    const visitUrls = mockOpenmrsFetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/visit?'));
    expect(visitUrls).toHaveLength(2);
    expect(visitUrls.every((url) => url.includes('location='))).toBe(true);
    expect(visitUrls.some((url) => url.includes('location=hospital-uuid'))).toBe(true);
    expect(visitUrls.some((url) => url.includes('location=upss-uuid'))).toBe(true);
    expect(visitUrls.some((url) => url.includes('location=casita-uuid'))).toBe(false);
  });
});
