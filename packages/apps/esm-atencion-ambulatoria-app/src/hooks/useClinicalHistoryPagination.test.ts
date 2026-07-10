import { useOpenmrsPagination } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { useClinicalHistoryPagination } from './useClinicalHistoryPagination';

interface TestEntry {
  uuid: string;
}

const mockUseOpenmrsPagination = vi.mocked(useOpenmrsPagination<TestEntry>);

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
