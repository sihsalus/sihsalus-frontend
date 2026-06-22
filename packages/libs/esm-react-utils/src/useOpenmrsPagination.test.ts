import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getIntArray, getTestData } from './pagination-test-helpers';
import { useOpenmrsPagination } from './useOpenmrsPagination';

describe('useOpenmrsPagination', () => {
  it('should not fetch anything if url is null', async () => {
    const { result } = renderHook(() =>
      useOpenmrsPagination(null as any, 50, {
        fetcher: (url) => getTestData(url, 100).then((data) => ({ data }) as any),
      }),
    );
    expect(result.current.isLoading).toBeFalsy();
    expect(result.current.data).toBeUndefined();
  });

  it('should fetch all rows on 1 page if number of rows < pageSize', async () => {
    const pageSize = 20;
    const expectedRowCount = 17;
    const { result } = renderHook(() =>
      useOpenmrsPagination('http://localhost/1', pageSize, {
        fetcher: (url) => getTestData(url, expectedRowCount).then((data) => ({ data }) as any),
      }),
    );
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.totalPages).toEqual(1);

    expect(result.current.currentPage).toEqual(1);
    expect(result.current.data?.length).toBe(expectedRowCount);
    expect(result.current.totalCount).toBe(expectedRowCount);
    expect(result.current.data).toEqual(getIntArray(0, 17));
  });

  it('should fetch 2 pages if pageSize < number of rows <= 2 * pageSize', async () => {
    const pageSize = 20;
    const expectedRowCount = 40;
    const { result } = renderHook(() =>
      useOpenmrsPagination('http://localhost/2', pageSize, {
        fetcher: (url) => getTestData(url, expectedRowCount).then((data) => ({ data }) as any),
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.totalPages).toEqual(2);

    expect(result.current.currentPage).toEqual(1);
    expect(result.current.data?.length).toBe(pageSize);
    expect(result.current.totalCount).toBe(expectedRowCount);
    expect(result.current.data).toEqual(getIntArray(0, 20));

    // go to next page (page 2)
    act(() => result.current.goToNext());
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());

    expect(result.current.currentPage).toEqual(2);
    expect(result.current.data?.length).toBe(pageSize);
    expect(result.current.totalCount).toBe(expectedRowCount);
    expect(result.current.data).toEqual(getIntArray(20, 20));

    // go to previous page (page 1)
    act(() => result.current.goToPrevious());
    await waitFor(() => expect(result.current.isValidating).toBeFalsy());

    expect(result.current.currentPage).toEqual(1);
    expect(result.current.data?.length).toBe(pageSize);
    expect(result.current.totalCount).toBe(expectedRowCount);
    expect(result.current.data).toEqual(getIntArray(0, 20));
  });

  it('should fetch n pages for n >> 1', async () => {
    const pageSize = 20;
    const expectedRowCount = 1337;
    const expectedTotalPages = Math.ceil(expectedRowCount / pageSize);
    const { result } = renderHook(() =>
      useOpenmrsPagination('http://localhost/3', pageSize, {
        fetcher: (url) => getTestData(url, expectedRowCount).then((data) => ({ data }) as any),
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.totalPages).toEqual(expectedTotalPages);

    expect(result.current.currentPage).toEqual(1);
    expect(result.current.data?.length).toBe(pageSize);
    expect(result.current.totalCount).toBe(expectedRowCount);
    expect(result.current.data).toEqual(getIntArray(0, 20));

    // go to page 2
    act(() => result.current.goTo(2));
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());

    expect(result.current.currentPage).toEqual(2);
    expect(result.current.data?.length).toBe(pageSize);
    expect(result.current.totalCount).toBe(expectedRowCount);
    expect(result.current.data).toEqual(getIntArray(20, 20));

    // go to next page (page 3)
    act(() => result.current.goToNext());
    await waitFor(() => expect(result.current.isValidating).toBeFalsy());

    expect(result.current.currentPage).toEqual(3);
    expect(result.current.data?.length).toBe(pageSize);
    expect(result.current.totalCount).toBe(expectedRowCount);
    expect(result.current.data).toEqual(getIntArray(40, 20));

    // go to last page
    act(() => result.current.goTo(expectedTotalPages));
    await waitFor(() => expect(result.current.isValidating).toBeFalsy());

    expect(result.current.currentPage).toEqual(expectedTotalPages);
    expect(result.current.data?.length).toBe(17);
    expect(result.current.totalCount).toBe(expectedRowCount);
    expect(result.current.data).toEqual(getIntArray(1320, 17));
  });
});
