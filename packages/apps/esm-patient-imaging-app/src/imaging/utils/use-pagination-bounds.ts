import type { usePagination } from '@openmrs/esm-framework';
import { useEffect } from 'react';

type PaginationBounds = Pick<ReturnType<typeof usePagination>, 'currentPage' | 'totalPages' | 'goTo'>;

/** Keep the framework paginator on an existing page after removal or refresh. */
export function usePaginationBounds({ currentPage, totalPages, goTo }: PaginationBounds) {
  useEffect(() => {
    if (currentPage > totalPages) goTo(totalPages);
  }, [currentPage, totalPages, goTo]);
}
