import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfflineActions from './offline-actions.component';

const mocks = vi.hoisted(() => ({
  queue: { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() } as Record<string, unknown>,
  patients: { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() } as Record<string, unknown>,
}));

vi.mock('../hooks/offline-actions', () => ({
  usePendingSyncItems: () => mocks.queue,
  useSyncItemPatients: () => mocks.patients,
}));
vi.mock('./offline-actions-table.component', () => ({
  default: ({ isLoading, data }: { isLoading: boolean; data: Array<{ item: { id: number } }> }) =>
    isLoading ? (
      <div role="status">Loading actions</div>
    ) : (
      <div>
        {data.map(({ item }) => (
          <span key={item.id}>Synthetic pending {item.id}</span>
        ))}
      </div>
    ),
}));

beforeEach(() => {
  mocks.queue = {
    data: [{ id: 1, type: 'synthetic', descriptor: { patientUuid: 'synthetic-1' } }],
    isLoading: false,
    mutate: vi.fn().mockResolvedValue(undefined),
  };
  mocks.patients = { data: [], isLoading: false, mutate: vi.fn().mockResolvedValue(undefined) };
});

it('renders a recoverable queue failure instead of an indefinite loading state', async () => {
  mocks.queue.data = undefined;
  mocks.queue.error = new Error('Synthetic internal storage detail');
  const user = userEvent.setup();
  render(<OfflineActions />);
  expect(screen.queryByText('Loading actions')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText('Synthetic internal storage detail')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /retry/i }));
  await waitFor(() => expect(mocks.queue.mutate).toHaveBeenCalledTimes(1));
});

it('keeps pending actions visible when patient metadata cannot load', () => {
  mocks.patients.data = undefined;
  mocks.patients.error = new Error('Synthetic patient request failure');
  render(<OfflineActions />);
  expect(screen.getByText('Synthetic pending 1')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText('Loading actions')).not.toBeInTheDocument();
});

it('shows the empty state for a patient with no pending actions', () => {
  render(<OfflineActions patientUuid="synthetic-other-patient" />);
  expect(screen.queryByText('Synthetic pending 1')).not.toBeInTheDocument();
  expect(screen.getByText(/no actions pending upload/i)).toBeInTheDocument();
});

it('settles a failed retry without an unhandled rejection and remains recoverable', async () => {
  mocks.queue.data = undefined;
  mocks.queue.error = new Error('Synthetic storage failure');
  mocks.queue.mutate = vi.fn().mockRejectedValue(new Error('Synthetic retry failure'));
  const user = userEvent.setup();
  render(<OfflineActions />);
  await user.click(screen.getByRole('button', { name: /retry/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeEnabled());
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

it('handles legacy actions without patient metadata in a patient-specific view', () => {
  mocks.queue.data = [{ id: 1, type: 'synthetic' }];
  render(<OfflineActions patientUuid="synthetic-other-patient" />);
  expect(screen.getByText(/no actions pending upload/i)).toBeInTheDocument();
});
