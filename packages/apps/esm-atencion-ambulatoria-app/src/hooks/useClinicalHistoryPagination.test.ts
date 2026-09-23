import { openmrsFetch, useOpenmrsPagination } from '@openmrs/esm-framework';
import { act, renderHook } from '@testing-library/react';
import useSWR from 'swr';
import {
  fetchClinicalHistorySource,
  fetchClinicalHistorySources,
  useClinicalHistoryPagination,
  useMergedClinicalHistoryPagination,
} from './useClinicalHistoryPagination';

vi.mock('swr', () => ({ default: vi.fn() }));

interface TestEntry {
  uuid: string;
}

const mockUseOpenmrsPagination = vi.mocked(useOpenmrsPagination<TestEntry>);
const mockUseSWR = vi.mocked(useSWR);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('useClinicalHistoryPagination', () => {
  it('requests ten encounters per page and exposes reusable navigation state', () => {
    const goTo = vi.fn();
    const mutate = vi.fn();
    mockUseOpenmrsPagination.mockReturnValue({
      data: [{ uuid: 'encounter-1' }],
      currentPage: 2,
      totalPages: 3,
      goTo,
      mutate,
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useOpenmrsPagination<TestEntry>>);

    const { result } = renderHook(() => useClinicalHistoryPagination<TestEntry>('/ws/rest/v1/encounter'));

    expect(mockUseOpenmrsPagination).toHaveBeenCalledWith('/ws/rest/v1/encounter', 10);
    expect(result.current.data).toEqual([{ uuid: 'encounter-1' }]);
    expect(result.current.pagination).toEqual({
      currentPage: 2,
      totalPages: 3,
      onPageChange: goTo,
    });
    expect(result.current.mutate).toBe(mutate);
  });
});

interface DatedTestEntry extends TestEntry {
  encounterDatetime: string;
}

function datedEntries(prefix: string, count: number): Array<DatedTestEntry> {
  return Array.from({ length: count }, (_, index) => ({
    uuid: `${prefix}-${index}`,
    encounterDatetime: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  }));
}

describe('useMergedClinicalHistoryPagination', () => {
  beforeEach(() => {
    mockUseSWR.mockReset();
    mockOpenmrsFetch.mockReset();
  });

  it('sorts merged encounters, paginates them and resets to page one when the source changes', () => {
    const mutate = vi.fn();
    mockUseSWR.mockReturnValue({
      data: { encounters: datedEntries('patient-a', 12), sourceErrors: [], truncated: false },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate,
    } as never);

    const { result, rerender } = renderHook(
      ({ sources }) => useMergedClinicalHistoryPagination<DatedTestEntry>(sources),
      { initialProps: { sources: [{ url: '/encounter?patient=patient-a' }] } },
    );

    expect(result.current.data.map((entry) => entry.uuid)).toEqual(
      Array.from({ length: 10 }, (_, index) => `patient-a-${11 - index}`),
    );
    expect(result.current.pagination).toMatchObject({ currentPage: 1, totalPages: 2 });

    act(() => result.current.pagination.onPageChange(2));

    expect(result.current.data.map((entry) => entry.uuid)).toEqual(['patient-a-1', 'patient-a-0']);

    mockUseSWR.mockReturnValue({
      data: { encounters: datedEntries('patient-b', 25), sourceErrors: [], truncated: false },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate,
    } as never);
    rerender({ sources: [{ url: '/encounter?patient=patient-b' }] });

    expect(result.current.pagination).toMatchObject({ currentPage: 1, totalPages: 3 });
    expect(result.current.data[0]?.uuid).toBe('patient-b-24');

    mockUseSWR.mockReturnValue({
      data: { encounters: datedEntries('patient-a', 12), sourceErrors: [], truncated: false },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate,
    } as never);
    rerender({ sources: [{ url: '/encounter?patient=patient-a' }] });

    expect(result.current.pagination).toMatchObject({ currentPage: 1, totalPages: 2 });
    expect(result.current.data[0]?.uuid).toBe('patient-a-11');
  });

  it('loads every server page and filters a generic encounter type by form and visit type', async () => {
    const firstPage = datedEntries('visit-note', 100).map((entry, index) => ({
      ...entry,
      form: { uuid: index === 0 ? 'other-form' : 'visit-note-form' },
      visit: { visitType: { uuid: index === 1 ? 'inpatient' : 'ambulatory' } },
    }));
    const lastPage = datedEntries('visit-note-last', 5).map((entry) => ({
      ...entry,
      form: { uuid: 'visit-note-form' },
      visit: { visitType: { uuid: 'ambulatory' } },
    }));
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: firstPage, totalCount: 105 } } as never)
      .mockResolvedValueOnce({ data: { results: lastPage, totalCount: 105 } } as never);

    const { encounters, truncated } = await fetchClinicalHistorySource<DatedTestEntry>({
      url: '/encounter?patient=patient-a',
      expectedFormUuid: 'visit-note-form',
      expectedVisitTypeUuid: 'ambulatory',
    });

    expect(encounters).toHaveLength(103);
    expect(truncated).toBe(false);
    expect(encounters.some((encounter) => encounter.uuid === 'visit-note-0')).toBe(false);
    expect(encounters.some((encounter) => encounter.uuid === 'visit-note-1')).toBe(false);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('limit=100&startIndex=100&totalCount=true'),
      expect.anything(),
    );
  });

  it('keeps the history that loaded when a secondary source is unavailable', async () => {
    mockOpenmrsFetch.mockImplementation((url) =>
      String(url).includes('unavailable')
        ? Promise.reject(new Error('HTTP 403'))
        : Promise.resolve({ data: { results: datedEntries('available', 2), totalCount: 2 } } as never),
    );

    const { encounters, sourceErrors } = await fetchClinicalHistorySources<DatedTestEntry>([
      { url: '/encounter?source=available' },
      { url: '/encounter?source=unavailable' },
    ]);

    expect(encounters).toHaveLength(2);
    expect(sourceErrors.map((error) => error.message)).toEqual(['HTTP 403']);
  });

  it('fails when no source could be read at all', async () => {
    mockOpenmrsFetch.mockRejectedValue(new Error('HTTP 500') as never);

    await expect(
      fetchClinicalHistorySources<DatedTestEntry>([{ url: '/encounter?source=a' }, { url: '/encounter?source=b' }]),
    ).rejects.toThrow('HTTP 500');
  });

  it('stops at the page cap while retaining an explicit partial-history warning', async () => {
    mockOpenmrsFetch.mockImplementation((url) =>
      Promise.resolve({ data: { results: datedEntries(String(url), 100) } } as never),
    );

    const { encounters, truncated, sourceErrors } = await fetchClinicalHistorySources<DatedTestEntry>([
      { url: '/encounter?patient=patient-a' },
    ]);

    expect(encounters).toHaveLength(2000);
    expect(truncated).toBe(true);
    expect(sourceErrors).toHaveLength(1);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(20);
  });

  it('does not treat a null totalCount as "no more results"', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: datedEntries('first', 100), totalCount: null } } as never)
      .mockResolvedValueOnce({ data: { results: datedEntries('second', 3), totalCount: null } } as never);

    const { encounters } = await fetchClinicalHistorySource<DatedTestEntry>({ url: '/encounter?patient=patient-a' });

    expect(encounters).toHaveLength(103);
  });
});

describe('clinical history pagination integrity', () => {
  const source = { url: '/encounter?patient=synthetic-patient&encounterType=social-type' };

  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it.each([
    ['empty page with existing records', [{ results: [], totalCount: 2 }]],
    [
      'duplicate UUIDs in one page',
      [{ results: [...datedEntries('same', 1), ...datedEntries('same', 1)], totalCount: 2 }],
    ],
    [
      'repeated page',
      [
        { results: datedEntries('same', 100), totalCount: 200 },
        { results: datedEntries('same', 100), totalCount: 200 },
      ],
    ],
    [
      'shrinking total',
      [
        { results: datedEntries('first', 100), totalCount: 200 },
        { results: datedEntries('last', 5), totalCount: 105 },
      ],
    ],
    [
      'growing total',
      [
        { results: datedEntries('first', 100), totalCount: 105 },
        { results: datedEntries('last', 6), totalCount: 106 },
      ],
    ],
    ['more records than total', [{ results: datedEntries('first', 2), totalCount: 1 }]],
    ['next link after total', [{ results: datedEntries('first', 1), totalCount: 1, links: [{ rel: 'next' }] }]],
    ['empty page promising a next page', [{ results: [], links: [{ rel: 'next' }] }]],
    ['explicit end before total', [{ results: datedEntries('first', 1), totalCount: 2, links: [] }]],
    [
      'missing total on an incomplete final page',
      [
        { results: datedEntries('first', 100), totalCount: 105 },
        { results: [], totalCount: null },
      ],
    ],
    ['missing UUID', [{ results: [{ encounterDatetime: '2026-09-23T10:00:00Z' }] }]],
    ['invalid links', [{ results: [], links: {} }]],
  ])('rejects %s instead of publishing a complete history', async (_name, pages) => {
    for (const data of pages) mockOpenmrsFetch.mockResolvedValueOnce({ data } as never);

    await expect(fetchClinicalHistorySources([source])).rejects.toThrow();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(pages.length);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '2'])('rejects invalid totalCount %s', async (totalCount) => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: datedEntries('first', 1), totalCount } } as never);

    await expect(fetchClinicalHistorySource(source)).rejects.toThrow();
  });

  it('continues a short page with next while preserving the original patient and type filters', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: datedEntries('first', 2),
          links: [{ rel: 'next', uri: 'https://untrusted.invalid/encounter?patient=other' }],
        },
      } as never)
      .mockResolvedValueOnce({ data: { results: datedEntries('last', 1), links: [] } } as never);
    const signal = new AbortController().signal;

    const result = await fetchClinicalHistorySources([source], signal);

    expect(result.encounters).toHaveLength(3);
    expect(result).toMatchObject({ truncated: false, sourceErrors: [] });
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${source.url}&limit=100&startIndex=2&totalCount=true`, {
      signal,
    });
  });

  it('remembers a known total when a later page omits it', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: datedEntries('first', 100), totalCount: 103 } } as never)
      .mockResolvedValueOnce({ data: { results: datedEntries('last', 3) } } as never);

    expect(await fetchClinicalHistorySources([source])).toMatchObject({
      encounters: expect.any(Array),
      sourceErrors: [],
      truncated: false,
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it('accepts a genuinely empty history', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [], totalCount: 0, links: [] } } as never);

    expect(await fetchClinicalHistorySources([source])).toEqual({ encounters: [], sourceErrors: [], truncated: false });
  });

  it('reports an inconsistent source while preserving independently verified history', async () => {
    mockOpenmrsFetch.mockImplementation((url) =>
      Promise.resolve({
        data: String(url).includes('broken')
          ? { results: [], totalCount: 2 }
          : { results: datedEntries('valid', 2), totalCount: 2 },
      } as never),
    );

    const result = await fetchClinicalHistorySources([
      { url: '/encounter?source=broken' },
      { url: '/encounter?source=valid' },
    ]);

    expect(result.encounters.map((entry) => entry.uuid)).toEqual(['valid-0', 'valid-1']);
    expect(result.sourceErrors).toHaveLength(1);
  });

  it('allows the same verified encounter in distinct sources and deduplicates it', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { results: datedEntries('shared', 1), totalCount: 1 } } as never);

    const result = await fetchClinicalHistorySources([{ url: '/encounter?source=a' }, { url: '/encounter?source=b' }]);

    expect(result.encounters).toHaveLength(1);
    expect(result.sourceErrors).toEqual([]);
  });
});

describe('clinical history identity verification', () => {
  const source = {
    url: '/encounter',
    expectedPatientUuid: 'synthetic-patient',
    expectedEncounterTypeUuid: 'social-type',
    expectedFormUuid: 'social-form',
  };
  it.each([
    undefined,
    {},
    { results: null },
    { results: 'invalid' },
    { results: [{ patient: { uuid: 'other-patient' }, encounterType: { uuid: 'social-type' } }] },
    { results: [{ patient: { uuid: 'synthetic-patient' }, encounterType: { uuid: 'therapy-type' } }] },
  ])('rejects malformed data or clinical identity mismatches: %j', async (data) => {
    mockOpenmrsFetch.mockReset().mockResolvedValueOnce({ data } as never);
    await expect(fetchClinicalHistorySource(source)).rejects.toThrow();
  });
  it('filters forms without mixing unrelated encounters', async () => {
    const common = {
      patient: { uuid: 'synthetic-patient' },
      encounterType: { uuid: 'social-type' },
      encounterDatetime: '2026-09-21T10:00:00Z',
    };
    const matching = { ...common, uuid: 'matching', form: { uuid: 'social-form' } };
    mockOpenmrsFetch.mockReset().mockResolvedValueOnce({
      data: { results: [matching, { ...common, uuid: 'other', form: { uuid: 'other-form' } }], totalCount: 2 },
    } as never);
    expect((await fetchClinicalHistorySource(source)).encounters).toEqual([matching]);
  });
});
