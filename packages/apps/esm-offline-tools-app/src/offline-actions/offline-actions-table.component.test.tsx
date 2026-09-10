import type { SyncItem } from '@openmrs/esm-framework';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfflineActionsTable, { type SyncItemWithPatient } from './offline-actions-table.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-framework')>()),
  canBeginEditSynchronizationItemsOfType: vi.fn(() => false),
}));

const data: SyncItemWithPatient[] = Array.from({ length: 25 }, (_, index) => ({
  item: {
    id: index + 1,
    type: 'synthetic',
    content: {},
    descriptor: { id: String(index + 1), displayName: `Synthetic action ${index + 1}` },
    createdOn: new Date('2026-01-01T09:30:00Z'),
  } as SyncItem,
}));

const props = { data, isLoading: false, disableEditing: false, disableDelete: false, onDelete: vi.fn() };

it('searches all pending actions before pagination and deletes only the matching selection', async () => {
  const user = userEvent.setup();
  render(<OfflineActionsTable {...props} />);
  await user.type(screen.getByRole('searchbox'), 'Synthetic action 25');
  expect(screen.getByText('Synthetic action 25')).toBeInTheDocument();
  expect(screen.queryByText('Synthetic action 1')).not.toBeInTheDocument();
  await user.click(within(screen.getByText('Synthetic action 25').closest('tr')).getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: /Delete 1 actions/i }));
  expect(props.onDelete).toHaveBeenCalledWith([25]);
});

it('uses the requested page size and resets when it changes', async () => {
  const user = userEvent.setup();
  render(<OfflineActionsTable {...props} />);
  await user.selectOptions(screen.getByLabelText('Items per page:'), '20');
  expect(screen.getByText('Synthetic action 20')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('Synthetic action 25')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Items per page:'), '50');
  expect(screen.getByText('Synthetic action 1')).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(26);
});

it('clamps the page after synchronization removes pending rows', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<OfflineActionsTable {...props} />);
  await user.click(screen.getByRole('button', { name: 'Next page' }));
  await user.click(screen.getByRole('button', { name: 'Next page' }));
  rerender(<OfflineActionsTable {...props} data={data.slice(0, 3)} />);
  expect(await screen.findByText('Synthetic action 1')).toBeInTheDocument();
});

it('supports empty and missing patient metadata and retains a search when rows refresh', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<OfflineActionsTable {...props} />);
  await user.type(screen.getByRole('searchbox'), 'missing synthetic search');
  expect(screen.getAllByRole('row')).toHaveLength(1);
  rerender(<OfflineActionsTable {...props} data={[...data]} />);
  expect(screen.getByRole('searchbox')).toHaveValue('missing synthetic search');
  expect(screen.getAllByRole('row')).toHaveLength(1);
});

it('sorts timestamps across years before pagination and selects all matching actions', async () => {
  const dates = data.map((row, index) => ({
    ...row,
    item: { ...row.item, createdOn: new Date(index === 24 ? '2023-12-31T23:00:00Z' : '2024-01-01T00:00:00Z') },
  }));
  render(<OfflineActionsTable {...props} data={dates} />);
  await userEvent.click(screen.getByRole('button', { name: /Date & Time/ }));
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Synthetic action 25');
  await userEvent.click(within(screen.getAllByRole('row')[0]).getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: /Delete 25 actions/ }));
  expect(props.onDelete).toHaveBeenCalledWith(expect.arrayContaining([1, 11, 25]));
});
