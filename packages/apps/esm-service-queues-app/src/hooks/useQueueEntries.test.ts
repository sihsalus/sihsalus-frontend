import { getUserFacingErrorMessage, openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';

import { queueEntryRepresentation, useMutateQueueEntries, useQueueEntries } from './useQueueEntries';

const mockMutate = vi.hoisted(() => vi.fn());
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
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
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockMutate.mockRejectedValue(technicalError);
    mockGetUserFacingErrorMessage.mockReturnValueOnce(undefined as never);

    try {
      const { result } = renderHook(() => useMutateQueueEntries());

      await expect(result.current.mutateQueueEntries()).resolves.toBeUndefined();

      expect(mockGetUserFacingErrorMessage).toHaveBeenCalledOnce();
      expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
        technicalError,
        'Queue information could not be loaded. Please try again.',
        { logContext: 'Refresh queue entries' },
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('Refresh queue entries:', technicalError);
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
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

describe('queueEntryRepresentation', () => {
  it('retains the full person representation used for demographics and deceased status', () => {
    expect(queueEntryRepresentation).toContain('patient:(uuid,display,person,identifiers:');
    expect(queueEntryRepresentation).not.toMatch(/person:\(/);
  });
});

describe('useQueueEntries representation', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [], links: [], totalCount: 0 } } as never);
  });

  // The queue table renders person.display as the patient name and derives the age
  // from person.birthdate. Narrowing the person representation blanks both without
  // failing a single component test, because those render fully populated fixtures.
  it('asks for the whole person, which the queue table columns render', async () => {
    renderHook(() => useQueueEntries());

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());

    const requestedUrl = String(mockOpenmrsFetch.mock.calls[0][0]);
    const representation = new URLSearchParams(requestedUrl.split('?')[1]).get('v');

    expect(representation).toContain('person,');
    expect(representation).not.toMatch(/person:\(/);
  });
});
