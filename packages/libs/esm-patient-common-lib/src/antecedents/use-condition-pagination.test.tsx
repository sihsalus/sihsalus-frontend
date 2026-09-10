import { act, renderHook } from '@testing-library/react';
import { useConditionPagination } from './use-condition-pagination';

describe('condition history pagination', () => {
  it('moves to the last remaining page after a refreshed history shrinks', () => {
    const { result, rerender } = renderHook(({ rows, pageSize }) => useConditionPagination(rows, pageSize), {
      initialProps: { rows: ['one', 'two', 'three', 'four', 'five'], pageSize: 2 },
    });
    act(() => result.current.goTo(3));
    expect(result.current.results).toEqual(['five']);

    rerender({ rows: ['one', 'two', 'three'], pageSize: 2 });
    expect(result.current.currentPage).toBe(2);
    expect(result.current.results).toEqual(['three']);

    rerender({ rows: ['one', 'two'], pageSize: 2 });
    expect(result.current.currentPage).toBe(1);
    expect(result.current.results).toEqual(['one', 'two']);
  });

  it('keeps a valid selected page after reordering or adding records', () => {
    const { result, rerender } = renderHook(({ rows }) => useConditionPagination(rows, 2), {
      initialProps: { rows: ['one', 'two', 'three', 'four'] },
    });
    act(() => result.current.goTo(2));
    rerender({ rows: ['four', 'three', 'two', 'one', 'five'] });
    expect(result.current.currentPage).toBe(2);
    expect(result.current.results).toEqual(['two', 'one']);
  });

  it('handles empty histories and a larger configured page size', () => {
    const { result, rerender } = renderHook(({ rows, pageSize }) => useConditionPagination(rows, pageSize), {
      initialProps: { rows: ['one', 'two', 'three'] as Array<string> | null, pageSize: 2 },
    });
    act(() => result.current.goTo(2));
    rerender({ rows: ['one', 'two', 'three'], pageSize: 10 });
    expect(result.current.currentPage).toBe(1);
    expect(result.current.results).toHaveLength(3);
    rerender({ rows: null, pageSize: 10 });
    expect(result.current.currentPage).toBe(1);
    expect(result.current.results).toEqual([]);
  });
});
