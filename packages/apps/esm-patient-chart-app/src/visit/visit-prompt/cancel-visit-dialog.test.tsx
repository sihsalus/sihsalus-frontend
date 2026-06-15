import { type FetchResponse, openmrsFetch, showSnackbar, useVisit } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockCurrentVisit, mockPatient, mockVisitQueueEntries } from 'test-utils';

import { removeQueuedPatient } from '../hooks/useServiceQueue';
import { type MappedVisitQueueEntry, useVisitQueueEntry } from '../queue-entry/queue.resource';

import CancelVisitDialog from './cancel-visit-dialog.component';

const mockCloseModal = vi.fn();
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockRemoveQueuedPatient = vi.mocked(removeQueuedPatient);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseVisit = vi.mocked(useVisit);
const mockUseVisitQueueEntry = vi.mocked(useVisitQueueEntry);

vi.mock('../queue-entry/queue.resource', async () => ({
  ...(await vi.importActual('../queue-entry/queue.resource')),
  useVisitQueueEntry: vi.fn(),
}));

vi.mock('../hooks/useServiceQueue', async () => {
  const originalModule = await vi.importActual('../hooks/useServiceQueue');

  return {
    ...originalModule,
    removeQueuedPatient: vi.fn(),
  };
});

describe('Cancel visit', () => {
  beforeEach(() => {
    mockUseVisit.mockReturnValue({
      activeVisit: mockCurrentVisit,
      currentVisit: mockCurrentVisit,
      currentVisitIsRetrospective: false,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
  });

  it('cancels the active visit and voids its associated encounters', async () => {
    const user = userEvent.setup();

    const response: Partial<FetchResponse> = {
      statusText: 'ok',
      status: 200,
    };

    mockOpenmrsFetch.mockResolvedValue(response as FetchResponse);
    mockUseVisitQueueEntry.mockReturnValueOnce({
      queueEntry: mockVisitQueueEntries,
      isLoading: false,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockRemoveQueuedPatient.mockResolvedValue(response as FetchResponse);

    render(<CancelVisitDialog closeModal={mockCloseModal} patientUuid={mockPatient.id} />);

    const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
    const cancelVisitButton = screen.getByRole('button', { name: /cancel visit$/i });
    const closeModalButton = screen.getByRole('button', { name: /close/i });

    expect(cancelButton).toBeInTheDocument();
    expect(cancelVisitButton).toBeInTheDocument();
    expect(closeModalButton).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: /Are you sure you want to cancel this active visit?/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cancelling this visit will delete its associated encounters/i)).toBeInTheDocument();

    await user.click(cancelVisitButton);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`/ws/rest/v1/visit/${mockCurrentVisit.uuid}`, {
      method: 'DELETE',
    });
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'success',
        title: 'Visit cancelled',
        subtitle: 'Active Facility Visit cancelled successfully',
      }),
    );
  });

  it('displays an error notification if there was problem with cancelling a visit', async () => {
    const user = userEvent.setup();

    const response: Partial<FetchResponse> = {
      statusText: 'ok',
      status: 200,
    };

    mockOpenmrsFetch.mockRejectedValueOnce({ message: 'Internal server error', status: 500 });
    mockUseVisitQueueEntry.mockReturnValueOnce({
      queueEntry: {} as MappedVisitQueueEntry,
      isLoading: false,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(),
    });

    mockRemoveQueuedPatient.mockResolvedValue(response as FetchResponse);

    render(<CancelVisitDialog closeModal={mockCloseModal} patientUuid={mockPatient.id} />);

    const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
    const cancelVisitButton = screen.getByRole('button', { name: /cancel visit$/i });
    const closeModalButton = screen.getByRole('button', { name: /close/i });

    expect(cancelButton).toBeInTheDocument();
    expect(cancelVisitButton).toBeInTheDocument();
    expect(closeModalButton).toBeInTheDocument();
    expect(screen.getByText(/Cancelling this visit will delete its associated encounters/i)).toBeInTheDocument();

    await user.click(cancelVisitButton);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`/ws/rest/v1/visit/${mockCurrentVisit.uuid}`, {
      method: 'DELETE',
    });
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      subtitle: 'An error occured when deleting visit',
      kind: 'error',
      title: 'Error cancelling active visit',
    });
  });
});
