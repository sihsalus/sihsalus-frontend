import { type FetchResponse, openmrsFetch, type Visit } from '@openmrs/esm-framework';

import { getActiveVisitsForPatients } from './useTodaysVisits';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('getActiveVisitsForPatients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not issue a global visit request when there are no visible patients', async () => {
    await expect(getActiveVisitsForPatients([])).resolves.toEqual([]);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('limits every visit request to a visible patient and deduplicates patient UUIDs', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } } as unknown as FetchResponse);

    await getActiveVisitsForPatients(['patient-b', 'patient-a', 'patient-b']);

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    const requestUrls = mockOpenmrsFetch.mock.calls.map(([url]) => new URL(String(url), 'https://openmrs.test'));
    expect(requestUrls.map((url) => url.searchParams.get('patient')).sort()).toEqual(['patient-a', 'patient-b']);
    expect(requestUrls.every((url) => url.searchParams.get('includeInactive') === 'false')).toBe(true);
  });

  it('paginates active visits independently for each visible patient', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ uuid: `visit-${index}` }) as Visit);
    const lastVisit = { uuid: 'visit-100' } as Visit;
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: firstPage } } as unknown as FetchResponse)
      .mockResolvedValueOnce({ data: { results: [lastVisit] } } as unknown as FetchResponse);

    await expect(getActiveVisitsForPatients(['patient-a'])).resolves.toEqual([...firstPage, lastVisit]);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('patient=patient-a');
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('startIndex=0');
    expect(mockOpenmrsFetch.mock.calls[1][0]).toContain('startIndex=100');
  });

  it('requests only the fields required to match active visits and appointment links', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as unknown as FetchResponse);

    await getActiveVisitsForPatients(['patient-a']);

    const requestUrl = new URL(String(mockOpenmrsFetch.mock.calls[0][0]), 'https://openmrs.test');
    expect(requestUrl.searchParams.get('v')).toBe(
      'custom:(uuid,patient:(uuid),startDatetime,stopDatetime,attributes:(value,attributeType:(uuid)))',
    );
    expect(requestUrl.searchParams.get('includeInactive')).toBe('false');
    expect(requestUrl.searchParams.get('limit')).toBe('100');
  });

  it.each([
    ['missing results', { data: {} }],
    ['non-array results', { data: { results: {} } }],
  ])('rejects a successful but malformed visit response with %s', async (_case, response) => {
    mockOpenmrsFetch.mockResolvedValueOnce(response as unknown as FetchResponse);

    await expect(getActiveVisitsForPatients(['patient-a'])).rejects.toThrow('Invalid active-visits response');
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('stops safely if a server ignores pagination and repeats a full page', async () => {
    const repeatedPage = Array.from({ length: 100 }, (_, index) => ({ uuid: `visit-${index}` }) as Visit);
    mockOpenmrsFetch.mockResolvedValue({ data: { results: repeatedPage } } as unknown as FetchResponse);

    await expect(getActiveVisitsForPatients(['patient-a'])).resolves.toHaveLength(100);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });
});
