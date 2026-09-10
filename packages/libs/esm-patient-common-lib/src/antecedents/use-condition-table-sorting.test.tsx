import { act, renderHook } from '@testing-library/react';
import { useConditionTableSorting } from './use-condition-table-sorting';

const headers = [{ key: 'display', sortFunc: (a: string, b: string) => a.localeCompare(b) }];

describe('condition table sorting', () => {
  it('honors ascending, descending, and unsorted headers without mutating the history', () => {
    const rows = ['Zulu', 'Alpha', 'Bravo'];
    const { result } = renderHook(() => useConditionTableSorting(headers, rows));
    const comparator = result.current.sortRow;
    expect(result.current.sortedRows).toBe(rows);

    act(() => result.current.onHeaderClick(undefined, { sortHeaderKey: 'display', sortDirection: 'ASC' }));
    expect(result.current.sortedRows).toEqual(['Alpha', 'Bravo', 'Zulu']);
    const ascending = result.current.sortedRows;
    act(() => result.current.onHeaderClick(undefined, { sortHeaderKey: 'display', sortDirection: 'ASC' }));
    expect(result.current.sortedRows).toBe(ascending);
    expect(result.current.sortRow).toBe(comparator);
    expect(comparator()).toBe(0);

    act(() => result.current.onHeaderClick(undefined, { sortHeaderKey: 'display', sortDirection: 'DESC' }));
    expect(result.current.sortedRows).toEqual(['Zulu', 'Bravo', 'Alpha']);
    act(() => result.current.onHeaderClick(undefined, { sortHeaderKey: 'display', sortDirection: 'NONE' }));
    expect(result.current.sortedRows).toBe(rows);
    expect(rows).toEqual(['Zulu', 'Alpha', 'Bravo']);
  });

  it('applies the selected order to refreshed records and tolerates unresolved data', () => {
    const { result, rerender } = renderHook(({ rows }) => useConditionTableSorting(headers, rows), {
      initialProps: { rows: undefined as Array<string> | undefined },
    });
    act(() => result.current.onHeaderClick(undefined, { sortHeaderKey: 'display', sortDirection: 'ASC' }));
    expect(result.current.sortedRows).toBeUndefined();
    rerender({ rows: ['Zulu', 'Alpha'] });
    expect(result.current.sortedRows).toEqual(['Alpha', 'Zulu']);
  });
});
