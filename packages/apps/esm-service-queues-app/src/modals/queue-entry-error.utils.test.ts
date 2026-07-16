import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUserFacingQueueErrorMessage,
  isAlreadyEndedQueueEntryError,
  isDuplicateQueueEntryError,
} from './queue-entry-error.utils';

const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);

describe('queue entry error utilities', () => {
  beforeEach(() => {
    mockGetUserFacingErrorMessage.mockClear();
  });

  it('uses the safe fallback instead of a raw backend message', () => {
    const error = {
      responseBody: {
        error: {
          rawMessage: 'SQL constraint queue_entry_idx failed',
          translatedMessage: 'Internal Server Error',
        },
      },
    };

    expect(getUserFacingQueueErrorMessage(error, 'The queue action could not be completed.')).toBe(
      'The queue action could not be completed.',
    );
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(error, 'The queue action could not be completed.', {
      logContext: 'Queue entry action',
    });
  });

  it('translates the backend Invalid Submission message', () => {
    mockGetUserFacingErrorMessage.mockReturnValue('Invalid Submission');

    expect(
      getUserFacingQueueErrorMessage(
        { message: 'Invalid Submission' },
        'The queue action could not be completed.',
        'Queue entry action',
        'La solicitud no es válida.',
      ),
    ).toBe('La solicitud no es válida.');
  });

  it('detects a duplicate entry without exposing its technical message', () => {
    const error = {
      responseBody: { error: { rawMessage: '[queue.entry.error.duplicate] duplicate queue entry' } },
    };

    expect(isDuplicateQueueEntryError(error)).toBe(true);
  });

  it('detects an entry that another user already ended', () => {
    const error = {
      responseBody: { error: { message: 'Cannot transition a queue entry that has already ended' } },
    };

    expect(isAlreadyEndedQueueEntryError(error)).toBe(true);
  });
});
