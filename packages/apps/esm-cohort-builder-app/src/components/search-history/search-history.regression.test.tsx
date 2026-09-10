import { showModal } from '@openmrs/esm-framework';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { downloadCSV } from '../../cohort-builder.utils';
import { addStoredSearchHistory, clearStoredSearchHistory, getStoredSearchHistory } from '../../search-history-store';
import type { Query } from '../../types';
import SearchHistory from './search-history.component';
import { createCohort, createQuery } from './search-history-options/search-history-options.resources';

vi.mock('../../cohort-builder.utils', () => ({ downloadCSV: vi.fn() }));
vi.mock('./search-history-options/search-history-options.resources', () => ({
  createCohort: vi.fn(),
  createQuery: vi.fn(),
}));

const query: Query = { type: 'synthetic', columns: [], rowFilters: [], customRowFilterCombination: '' };

beforeEach(() => {
  clearStoredSearchHistory();
  for (let index = 1; index <= 20; index++) {
    addStoredSearchHistory(
      `Synthetic search ${index}`,
      [{ id: String(index), patientId: index, name: `Synthetic patient ${index}`, age: 30, gender: 'F' }],
      { ...query, rowFilters: [{ key: `synthetic-filter-${index}` }], name: `Synthetic query ${index}` },
    );
  }
});

afterEach(clearStoredSearchHistory);

it.each([
  'Save Cohort',
  'Save Query',
  'Delete from history',
  'Download Results',
])('uses the displayed second-page search for %s', async (action) => {
  const user = userEvent.setup();
  render(<SearchHistory isHistoryUpdated setIsHistoryUpdated={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Next page' }));
  const row = screen.getByText('Synthetic search 11').closest('tr');
  await user.click(within(row).getByRole('button'));
  await user.click(screen.getByText(action, { exact: false }));

  if (action === 'Download Results') {
    expect(downloadCSV).toHaveBeenCalledWith(
      [expect.objectContaining({ id: '11', name: 'Synthetic patient 11' })],
      'Synthetic search 11',
    );
  } else {
    const props = vi.mocked(showModal).mock.calls.at(-1)[1];
    if (action === 'Delete from history') {
      expect(props.searchItemName).toBe('Synthetic search 11');
      await act(async () => {
        await (props.onRemove as () => void)();
      });
      expect(getStoredSearchHistory().map((item) => item.description)).not.toContain('Synthetic search 11');
      expect(getStoredSearchHistory()[0].description).toBe('Synthetic search 1');
    } else if (action === 'Save Cohort') {
      await act(async () => {
        await (props.onSave as (name: string, description: string) => Promise<void>)(
          'Synthetic saved cohort',
          'Synthetic saved criteria',
        );
      });
      expect(createCohort).toHaveBeenCalledWith(expect.objectContaining({ memberIds: [11] }));
    } else {
      await act(async () => {
        await (props.onSaveQuery as (data: object) => Promise<void>)({
          queryName: 'Synthetic saved query',
          queryDescription: 'Synthetic saved criteria',
        });
      });
      expect(createQuery).toHaveBeenCalledWith(
        expect.objectContaining({ rowFilters: [{ key: 'synthetic-filter-11' }] }),
      );
    }
  }
});

it('uses the selected page size and keeps the visible history numbers aligned after deletion', async () => {
  const user = userEvent.setup();
  render(<SearchHistory isHistoryUpdated setIsHistoryUpdated={vi.fn()} />);
  await user.selectOptions(screen.getByLabelText('Items per page:'), '20');
  expect(screen.getByText('Synthetic search 20')).toBeInTheDocument();
  const row = screen.getByText('Synthetic search 1').closest('tr');
  await user.click(within(row).getByRole('button'));
  await user.click(screen.getByText('Delete from history', { exact: false }));
  const props = vi.mocked(showModal).mock.calls.at(-1)[1];
  await act(async () => {
    await (props.onRemove as () => void)();
  });
  const newFirstRow = screen.getByText('Synthetic search 2').closest('tr');
  expect(within(newFirstRow).getAllByRole('cell')[0]).toHaveTextContent('1');
  expect(getStoredSearchHistory()[0]).toMatchObject({ id: '1', description: 'Synthetic search 2' });
  expect(screen.getByLabelText('Items per page:')).toHaveValue('20');
});

it.each([1, 11])('preserves new searches when confirming removal of an older search %s', async (number) => {
  const user = userEvent.setup();
  render(<SearchHistory isHistoryUpdated setIsHistoryUpdated={vi.fn()} />);
  if (number > 10) await user.click(screen.getByRole('button', { name: 'Next page' }));
  await user.click(within(screen.getByText(`Synthetic search ${number}`).closest('tr')).getByRole('button'));
  await user.click(screen.getByText('Delete from history', { exact: false }));
  const props = vi.mocked(showModal).mock.calls.at(-1)[1];
  addStoredSearchHistory('Synthetic search 21', [], query);
  await act(async () => {
    await (props.onRemove as () => void)();
  });
  const history = getStoredSearchHistory();
  expect(history.map((item) => item.description)).toContain('Synthetic search 21');
  expect(history.map((item) => item.description)).not.toContain(`Synthetic search ${number}`);
  expect(history[0]).toMatchObject({ id: '1', description: 'Synthetic search 2' });
  expect(history).toHaveLength(number === 1 ? 20 : 19);
});

it('clamps the page when deleting the last item on the last page', async () => {
  clearStoredSearchHistory();
  for (let index = 1; index <= 11; index++) addStoredSearchHistory(`Synthetic search ${index}`, [], query);
  const user = userEvent.setup();
  render(<SearchHistory isHistoryUpdated setIsHistoryUpdated={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Next page' }));
  await user.click(within(screen.getByText('Synthetic search 11').closest('tr')).getByRole('button'));
  await user.click(screen.getByText('Delete from history', { exact: false }));
  const props = vi.mocked(showModal).mock.calls.at(-1)[1];
  await act(async () => {
    await (props.onRemove as () => void)();
  });
  expect(screen.getByText('Synthetic search 1')).toBeInTheDocument();
});
