import { openmrsFetch } from '@openmrs/esm-framework';
import { getActiveVisitsForLocation, getAllActiveVisits, isLocationAtOrBelow } from './active-visits.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('active visit location hierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recognizes direct and nested operational locations below a facility', () => {
    const location = {
      uuid: 'ward-uuid',
      parentLocation: {
        uuid: 'upss-uuid',
        parentLocation: { uuid: 'hospital-uuid' },
      },
    };

    expect(isLocationAtOrBelow(location, 'hospital-uuid')).toBe(true);
    expect(isLocationAtOrBelow(location, 'upss-uuid')).toBe(true);
    expect(isLocationAtOrBelow(location, 'ward-uuid')).toBe(true);
    expect(isLocationAtOrBelow(location, 'other-facility-uuid')).toBe(false);
  });

  it('loads visits for one exact operational location', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as Awaited<ReturnType<typeof openmrsFetch>>);

    await getActiveVisitsForLocation('upss-uuid', '2026-07-16');

    const requestUrl = String(mockOpenmrsFetch.mock.calls[0]?.[0]);
    expect(requestUrl).toContain('/visit?');
    expect(requestUrl).toContain('fromStartDate=2026-07-16');
    expect(requestUrl).toContain('location=upss-uuid');
    expect(requestUrl).not.toContain('includeParentLocations');
  });

  it('does not request visits from a location outside the selected hierarchy', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/location?')) {
        return {
          data: {
            results: [{ uuid: 'ward-uuid', parentLocation: { uuid: 'upss-uuid' } }, { uuid: 'casita-uuid' }],
          },
        } as Awaited<ReturnType<typeof openmrsFetch>>;
      }

      return { data: { results: [] } } as Awaited<ReturnType<typeof openmrsFetch>>;
    });

    await getAllActiveVisits('upss-uuid', '2026-07-16');

    const visitUrls = mockOpenmrsFetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/visit?'));
    expect(visitUrls).toHaveLength(2);
    expect(visitUrls.some((url) => url.includes('location=upss-uuid'))).toBe(true);
    expect(visitUrls.some((url) => url.includes('location=ward-uuid'))).toBe(true);
    expect(visitUrls.some((url) => url.includes('location=casita-uuid'))).toBe(false);
  });
});
