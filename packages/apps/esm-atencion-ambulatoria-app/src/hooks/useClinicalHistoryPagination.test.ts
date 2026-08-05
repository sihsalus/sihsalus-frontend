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
      data: datedEntries('patient-a', 12),
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
      data: datedEntries('patient-b', 25),
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate,
    } as never);
    rerender({ sources: [{ url: '/encounter?patient=patient-b' }] });

    expect(result.current.pagination).toMatchObject({ currentPage: 1, totalPages: 3 });
    expect(result.current.data[0]?.uuid).toBe('patient-b-24');

    mockUseSWR.mockReturnValue({
      data: datedEntries('patient-a', 12),
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

    const encounters = await fetchClinicalHistorySource<DatedTestEntry>({
      url: '/encounter?patient=patient-a',
      expectedFormUuid: 'visit-note-form',
      expectedVisitTypeUuid: 'ambulatory',
    });

    expect(encounters).toHaveLength(103);
    expect(encounters.some((encounter) => encounter.uuid === 'visit-note-0')).toBe(false);
    expect(encounters.some((encounter) => encounter.uuid === 'visit-note-1')).toBe(false);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('limit=100&startIndex=100&totalCount=true'),
    );
  });

  it('fails visibly instead of presenting a partial clinical history as complete', async () => {
    mockOpenmrsFetch.mockImplementation((url) =>
      String(url).includes('unavailable')
        ? Promise.reject(new Error('HTTP 403'))
        : Promise.resolve({ data: { results: datedEntries('available', 2), totalCount: 2 } } as never),
    );

    await expect(
      fetchClinicalHistorySources<DatedTestEntry>([
        { url: '/encounter?source=available' },
        { url: '/encounter?source=unavailable' },
      ]),
    ).rejects.toThrow('HTTP 403');
  });
});
