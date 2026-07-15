import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';

import { useMutateQueueEntries } from './useQueueEntries';

const mockMutate = vi.hoisted(() => vi.fn());
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockShowSnackbar = vi.mocked(showSnackbar);

vi.mock('swr/_internal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('swr/_internal')>();

  return {
    ...actual,
    useSWRConfig: () => ({ mutate: mockMutate }),
  };
});

describe('useMutateQueueEntries', () => {
  beforeEach(() => {
    mockMutate.mockReset();
  });

  it('dispatches an update event after refreshing the queue caches', async () => {
    const updateListener = vi.fn();
    mockMutate.mockResolvedValue([]);
    globalThis.addEventListener('queue-entry-updated', updateListener);

    try {
      const { result } = renderHook(() => useMutateQueueEntries());

      await result.current.mutateQueueEntries();

      expect(mockMutate).toHaveBeenCalledOnce();
      expect(updateListener).toHaveBeenCalledOnce();
      expect(mockShowSnackbar).not.toHaveBeenCalled();
    } finally {
      globalThis.removeEventListener('queue-entry-updated', updateListener);
    }
  });

  it('consumes refresh failures and reports one safe loading error', async () => {
    const technicalError = new Error('GET /queue-entry failed with SQL timeout');
    mockMutate.mockRejectedValue(technicalError);
    mockGetUserFacingErrorMessage.mockReturnValueOnce(undefined as never);
    const { result } = renderHook(() => useMutateQueueEntries());

    await expect(result.current.mutateQueueEntries()).resolves.toBeUndefined();

    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledOnce();
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
      technicalError,
      'Queue information could not be loaded. Please try again.',
      { logContext: 'Refresh queue entries' },
    );
    expect(mockShowSnackbar).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      title: 'Error loading queue entries',
      kind: 'error',
      isLowContrast: false,
      subtitle: 'Queue information could not be loaded. Please try again.',
    });
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: expect.stringMatching(/sql|\/queue-entry/i) }),
    );
  });
});
