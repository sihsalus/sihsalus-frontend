import { useOpenmrsPagination } from '@openmrs/esm-framework';

const CLINICAL_HISTORY_PAGE_SIZE = 10;

export function useClinicalHistoryPagination<T>(url: string | null) {
  const { data, error, isLoading, isValidating, mutate, currentPage, totalPages, goTo } = useOpenmrsPagination<T>(
    url as string,
    CLINICAL_HISTORY_PAGE_SIZE,
  );

  return {
    data: data ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
    pagination: {
      currentPage,
      totalPages,
      onPageChange: goTo,
    },
  };
}
