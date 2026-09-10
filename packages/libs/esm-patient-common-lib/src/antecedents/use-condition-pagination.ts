import { usePagination } from '@openmrs/esm-framework';
import { useEffect } from 'react';

/** Keep the visible page valid when a refreshed condition history becomes shorter. */
export function useConditionPagination<Row>(rows: Array<Row> | null | undefined, pageSize: number) {
  const pagination = usePagination(rows ?? [], pageSize);
  const { currentPage, totalPages, goTo } = pagination;

  useEffect(() => {
    if (currentPage > totalPages) {
      goTo(totalPages);
    }
  }, [currentPage, totalPages, goTo]);

  return pagination;
}
