import { getUserFacingErrorMessage, logError } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserFacingErrorMessage } from './useUserFacingErrorMessage';

const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockLogError = vi.mocked(logError);

describe('useUserFacingErrorMessage', () => {
  beforeEach(() => {
    mockGetUserFacingErrorMessage.mockImplementation((_error, fallback) => fallback);
  });

  it('returns no message and does not log when there is no error', () => {
    const { result } = renderHook(() => useUserFacingErrorMessage(undefined, 'Safe fallback', 'Load queue'));

    expect(result.current).toBe('');
    expect(mockGetUserFacingErrorMessage).not.toHaveBeenCalled();
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('normalizes the rendered message and logs each error object once', () => {
    const firstError = new Error('Sensitive backend detail');
    const secondError = new Error('Different sensitive detail');
    const { result, rerender } = renderHook(
      ({ error }) => useUserFacingErrorMessage(error, 'Safe fallback', 'Load queue'),
      { initialProps: { error: firstError } },
    );

    expect(result.current).toBe('Safe fallback');
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(firstError, 'Safe fallback', { log: false });
    expect(mockLogError).toHaveBeenCalledWith(firstError, 'Load queue');

    rerender({ error: firstError });
    expect(mockLogError).toHaveBeenCalledOnce();

    rerender({ error: secondError });
    expect(mockLogError).toHaveBeenCalledTimes(2);
    expect(mockLogError).toHaveBeenLastCalledWith(secondError, 'Load queue');
  });
});
