import { type FetchResponse, openmrsFetch, type Visit } from '@openmrs/esm-framework';

import { getAllActiveVisits } from './useTodaysVisits';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('getAllActiveVisits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('paginates until every active visit is loaded', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({ uuid: `visit-${index}` }) as Visit);
    const lastVisit = { uuid: 'visit-200' } as Visit;
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: firstPage } } as unknown as FetchResponse)
      .mockResolvedValueOnce({ data: { results: [lastVisit] } } as unknown as FetchResponse);

    await expect(getAllActiveVisits()).resolves.toEqual([...firstPage, lastVisit]);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('startIndex=0');
    expect(mockOpenmrsFetch.mock.calls[1][0]).toContain('startIndex=200');
  });

  it('requests only the fields required to match active visits and appointment links', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as unknown as FetchResponse);

    await getAllActiveVisits();

    const requestUrl = new URL(String(mockOpenmrsFetch.mock.calls[0][0]), 'https://openmrs.test');
    expect(requestUrl.searchParams.get('v')).toBe(
      'custom:(uuid,patient:(uuid),startDatetime,stopDatetime,attributes:(value,attributeType:(uuid)))',
    );
    expect(requestUrl.searchParams.get('includeInactive')).toBe('false');
    expect(requestUrl.searchParams.get('limit')).toBe('200');
  });

  it('stops safely if a server ignores pagination and repeats a full page', async () => {
    const repeatedPage = Array.from({ length: 200 }, (_, index) => ({ uuid: `visit-${index}` }) as Visit);
    mockOpenmrsFetch.mockResolvedValue({ data: { results: repeatedPage } } as unknown as FetchResponse);

    await expect(getAllActiveVisits()).resolves.toHaveLength(200);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });
});
