import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getIntArray, getTestData } from './pagination-test-helpers';
import { useOpenmrsFetchAll } from './useOpenmrsFetchAll';

describe('useOpenmrsFetchAll', () => {
  it('should render all rows on if number of rows < pageSize', async () => {
    const expectedRowCount = 17;
    const { result } = renderHook(() =>
      useOpenmrsFetchAll(`http://localhost/1`, {
        fetcher: (url) => getTestData(url, expectedRowCount).then((data) => ({ data }) as any),
      }),
    );
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.totalCount).toEqual(expectedRowCount);
    expect(result.current.data).toEqual(getIntArray(0, 17));
  });

  it('should render all rows on if number of rows > pageSize with no partialData', async () => {
    const expectedRowCount = 150;
    const { result } = renderHook(() =>
      useOpenmrsFetchAll(`http://localhost/2`, {
        fetcher: (url) => getTestData(url, expectedRowCount).then((data) => ({ data }) as any),
      }),
    );
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.totalCount).toEqual(expectedRowCount);
    expect(result.current.data).toEqual(getIntArray(0, expectedRowCount));
  });
});
