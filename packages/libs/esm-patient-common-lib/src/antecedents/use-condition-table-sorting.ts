import type { DataTableSortState } from '@carbon/react';
import { useCallback, useMemo, useState } from 'react';

interface ConditionSortState {
  sortHeaderKey: string;
  sortDirection: DataTableSortState;
}

interface ConditionSortHeader<Row> {
  key: string;
  sortFunc(valueA: Row, valueB: Row): number;
}

// The complete history is sorted before pagination; Carbon must preserve that page's order.
const preservePageOrder = () => 0;

export function useConditionTableSorting<Row>(headers: Array<ConditionSortHeader<Row>>, rows: Array<Row> | undefined) {
  const [sort, setSort] = useState<ConditionSortState>({ sortHeaderKey: '', sortDirection: 'NONE' });
  const onHeaderClick = useCallback((_event: unknown, next: ConditionSortState) => {
    setSort((previous) =>
      previous.sortHeaderKey === next.sortHeaderKey && previous.sortDirection === next.sortDirection ? previous : next,
    );
  }, []);

  const sortedRows = useMemo(() => {
    const header = headers.find(({ key }) => key === sort.sortHeaderKey);
    if (!header || sort.sortDirection === 'NONE') {
      return rows;
    }
    return rows?.slice().sort((a, b) => {
      const comparison = header.sortFunc(a, b);
      return sort.sortDirection === 'ASC' ? comparison : -comparison;
    });
  }, [headers, rows, sort]);

  return { sortedRows, sortRow: preservePageOrder, onHeaderClick };
}
