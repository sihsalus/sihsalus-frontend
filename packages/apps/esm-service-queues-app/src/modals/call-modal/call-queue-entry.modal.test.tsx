import {
  getDefaultsFromConfigSchema,
  getUserFacingErrorMessage,
  navigate,
  showSnackbar,
  useConfig,
} from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueEntryAlice } from 'test-utils';

import { type ConfigObject, configSchema } from '../../config-schema';
import { serveQueueEntry, updateQueueEntry } from '../../service-queues.resource';

import CallQueueEntryModal from './call-queue-entry.modal';

const mockNavigate = vi.mocked(navigate);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockServeQueueEntry = vi.mocked(serveQueueEntry);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUpdateQueueEntry = vi.mocked(updateQueueEntry);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);

vi.mock('../../hooks/useQueueEntries', () => ({
  useMutateQueueEntries: () => ({ mutateQueueEntries: vi.fn() }),
}));

vi.mock('../../service-queues.resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../service-queues.resource')>();

  return {
    ...actual,
    serveQueueEntry: vi.fn().mockResolvedValue({ status: 200 }),
    updateQueueEntry: vi.fn().mockResolvedValue({ status: 201 }),
  };
});

describe('CallQueueEntryModal', () => {
  beforeEach(() => {
    const defaults = getDefaultsFromConfigSchema(configSchema);
    mockServeQueueEntry.mockResolvedValue({ status: 200 } as Awaited<ReturnType<typeof serveQueueEntry>>);
    mockUpdateQueueEntry.mockResolvedValue({ status: 201 } as Awaited<ReturnType<typeof updateQueueEntry>>);
    mockUseConfig.mockReturnValue({
      ...defaults,
      concepts: {
        ...defaults.concepts,
        defaultTransitionStatus: 'some-default-transition-status',
      },
      defaultIdentifierTypes: [],
      visitQueueNumberAttributeUuid: 'queue-number-visit-attr-type-uuid',
    } as ConfigObject);
  });

  it('awaits the screen update and handles its rejection with one safe error', async () => {
    const user = userEvent.setup();
    const closeModal = vi.fn();
    const technicalError = new Error('SQL constraint queue_screen_idx failed');
    mockServeQueueEntry.mockRejectedValueOnce(technicalError);

    render(<CallQueueEntryModal queueEntry={mockQueueEntryAlice} closeModal={closeModal} />);

    await user.click(screen.getByRole('button', { name: 'Serve' }));

    expect(mockUpdateQueueEntry).toHaveBeenCalledOnce();
    expect(mockServeQueueEntry).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    });
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      title: 'Error updating queue entry',
      kind: 'error',
      isLowContrast: false,
      subtitle: 'The queue action could not be completed. Please try again.',
    });
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledOnce();
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
      technicalError,
      'The queue action could not be completed. Please try again.',
      { logContext: 'Call queue entry' },
    );
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: expect.stringMatching(/sql constraint/i) }),
    );
    expect(closeModal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
