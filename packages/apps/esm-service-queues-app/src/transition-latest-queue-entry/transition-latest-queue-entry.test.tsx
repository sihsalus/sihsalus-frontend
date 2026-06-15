import { render, screen } from '@testing-library/react';

import TransitionLatestQueueEntry from './transition-latest-queue-entry.component';
import { useLatestQueueEntry } from './transition-latest-queue-entry.resource';

const mockUseLatestQueueEntry = vi.mocked(useLatestQueueEntry);

vi.mock('./transition-latest-queue-entry.resource', () => ({
  useLatestQueueEntry: vi.fn(),
}));

vi.mock('../queue-table/queue-entry-actions/transition-queue-entry.modal', () => ({
  default: ({ modalTitle, queueEntry }: { modalTitle: string; queueEntry: { uuid: string } }) => (
    <section>
      <h1>{modalTitle}</h1>
      <p>{queueEntry.uuid}</p>
    </section>
  ),
}));

describe('TransitionLatestQueueEntry', () => {
  it('renders the latest queue entry modal with the configured modal title', () => {
    mockUseLatestQueueEntry.mockReturnValue({
      data: { uuid: 'queue-entry-uuid' },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useLatestQueueEntry>);

    render(
      <TransitionLatestQueueEntry
        closeModal={vi.fn()}
        modalTitle="Cambiar estado de cola"
        patientUuid="patient-uuid"
      />,
    );

    expect(mockUseLatestQueueEntry).toHaveBeenCalledWith('patient-uuid');
    expect(screen.getByRole('heading', { name: 'Cambiar estado de cola' })).toBeInTheDocument();
    expect(screen.getByText('queue-entry-uuid')).toBeInTheDocument();
  });

  it('does not render the modal when the latest queue entry is unavailable', () => {
    mockUseLatestQueueEntry.mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useLatestQueueEntry>);

    const { container } = render(<TransitionLatestQueueEntry closeModal={vi.fn()} patientUuid="patient-uuid" />);

    expect(container).toBeEmptyDOMElement();
  });
});
