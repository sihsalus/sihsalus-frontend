import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  showSnackbar,
  useConfig,
  useLocations,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockLocations, mockMappedQueueEntry, mockServices, mockSession } from 'test-utils';
import type { MockInstance } from 'vitest';

import { type ConfigObject, configSchema } from '../config-schema';

import { updateQueueEntry } from './active-visits-table.resource';
import ChangeStatusModal from './change-status.modal';

const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUpdateQueueEntry = vi.mocked(updateQueueEntry);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLocations = vi.mocked(useLocations);
const mockUseSession = vi.mocked(useSession);
const mockMappedVisitQueueEntry = {
  ...mockMappedQueueEntry,
  patientAge: '32 years 0 months 0 days',
  priority: mockMappedQueueEntry.priority.display as 'Emergency' | 'Not Urgent' | 'Priority',
  priorityUuid: mockMappedQueueEntry.priority.uuid,
  service: mockMappedQueueEntry.queue.display,
  status: mockMappedQueueEntry.status.display as 'Finished Service' | 'In Service' | 'Waiting',
  statusUuid: mockMappedQueueEntry.status.uuid,
};

vi.mock('./active-visits-table.resource', async () => ({
  ...(await vi.importActual('./active-visits-table.resource')),
  updateQueueEntry: vi.fn(),
}));

vi.mock('../create-queue-entry/hooks/useQueueLocations', async () => {
  return {
    useQueueLocations: vi.fn().mockReturnValue({
      queueLocations: mockLocations.data?.results.map((location) => ({ ...location, id: location.uuid })),
    }),
  };
});

vi.mock('../hooks/useQueues', async () => {
  return {
    useQueues: vi.fn().mockReturnValue({ queues: mockServices }),
  };
});

describe('ChangeStatusModal', () => {
  let consoleSpy: MockInstance;

  beforeEach(() => {
    mockUpdateQueueEntry.mockReset();
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      concepts: {},
    } as ConfigObject);
    mockUseLocations.mockReturnValue(mockLocations.data.results);
    mockUseSession.mockReturnValue(mockSession.data);

    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should update a queue entry and display toast message', async () => {
    const user = userEvent.setup();

    mockUpdateQueueEntry.mockResolvedValueOnce({
      data: mockMappedVisitQueueEntry,
      status: 201,
      statusText: 'Updated',
    } as FetchResponse);

    renderChangeStatusModal();
    expect(screen.getByText(/Brian Johnson\s*·\s*F\s*·\s*32 years 0 months 0 days/i)).toBeInTheDocument();
    expect(screen.getByText(/queue service/i)).toBeInTheDocument();
    expect(screen.getByText(/queue priority/i)).toBeInTheDocument();

    // user selects queue location
    const queueLocation = screen.getByRole('combobox', { name: /Select a queue location/i });
    await user.selectOptions(queueLocation, 'some-uuid1');

    // user selects a service
    const queueServiceTypes = screen.getByRole('combobox', { name: /select a service/i });
    await user.selectOptions(queueServiceTypes, '176052c7-5fd4-4b33-89cc-7bae6848c65a');

    // user selects queue status
    const queueStatus = screen.getByRole('radio', { name: /Waiting/i });
    await user.click(queueStatus);

    // user selects a priority
    const urgentPriority = screen.getByRole('tab', { name: 'Urgent' });
    await user.click(urgentPriority);

    await user.click(screen.getByRole('button', { name: /move to next service/i }));

    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'success',
      title: 'Update entry',
      subtitle: 'Queue Entry Updated Successfully',
    });
  });

  it('should display a safe error message when rest api call to update queue entry fails', async () => {
    const user = userEvent.setup();

    mockUpdateQueueEntry.mockRejectedValue({
      message: 'Internal Server Error',
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
    });

    renderChangeStatusModal();
    expect(screen.getByText(/move patient to the next service?/i)).toBeInTheDocument();
    expect(screen.getByText(/queue service/i)).toBeInTheDocument();
    expect(screen.getByText(/queue priority/i)).toBeInTheDocument();
    const queueServiceTypes = screen.getByRole('combobox', { name: /select a service/i });

    // should have 3 queue services options
    const options = within(queueServiceTypes).getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveValue('');
    expect(options[1]).toHaveValue('176052c7-5fd4-4b33-89cc-7bae6848c65a');
    expect(options[2]).toHaveValue('d80ff12a-06a7-11ed-b939-0242ac120002');

    // user selects a service
    await user.selectOptions(queueServiceTypes, '176052c7-5fd4-4b33-89cc-7bae6848c65a');

    // user selects queue location
    const queueLocation = screen.getByRole('combobox', { name: /Select a queue location/i });
    await user.selectOptions(queueLocation, 'some-uuid1');

    // user selects queue status
    const queueStatus = screen.getByRole('radio', { name: /Waiting/i });
    await user.click(queueStatus);

    // user selects a priority
    const urgentPriority = screen.getByRole('tab', { name: 'Urgent' });
    await user.click(urgentPriority);

    await user.click(screen.getByRole('button', { name: /move to next service/i }));

    expect(mockShowSnackbar).toHaveBeenCalledWith({
      subtitle: 'The queue action could not be completed. Please try again.',
      kind: 'error',
      title: 'Error updating queue entry status',
    });
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: expect.stringMatching(/internal server error/i) }),
    );
  });

  test('should show error message when user tries to update queue entry without selecting required fields', async () => {
    const user = userEvent.setup();
    mockUpdateQueueEntry.mockResolvedValueOnce({
      data: mockMappedVisitQueueEntry,
      status: 201,
      statusText: 'Updated',
    } as FetchResponse);

    renderChangeStatusModal();

    await user.click(screen.getByRole('button', { name: /move to next service/i }));
    expect(screen.getByText(/Queue location is required/i)).toBeInTheDocument();
    expect(screen.getByText(/service is required/i)).toBeInTheDocument();
    expect(screen.getByText(/status is required/i)).toBeInTheDocument();
  });
});

const renderChangeStatusModal = () => {
  render(<ChangeStatusModal closeModal={() => false} queueEntry={mockMappedVisitQueueEntry} />);
};
