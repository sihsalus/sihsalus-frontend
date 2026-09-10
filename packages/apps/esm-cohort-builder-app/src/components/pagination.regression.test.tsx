import { showModal } from '@openmrs/esm-framework';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DefinitionDataRow, Patient } from '../types';
import SavedCohorts from './saved-cohorts/saved-cohorts.component';
import { onDeleteCohort, useCohorts } from './saved-cohorts/saved-cohorts.resources';
import SavedQueries from './saved-queries/saved-queries.component';
import { deleteDataSet, getQueries } from './saved-queries/saved-queries.resources';
import SearchResultsTable from './search-results-table/search-results-table.component';

vi.mock('./saved-cohorts/saved-cohorts.resources', () => ({ useCohorts: vi.fn(), onDeleteCohort: vi.fn() }));
vi.mock('./saved-queries/saved-queries.resources', () => ({ getQueries: vi.fn(), deleteDataSet: vi.fn() }));

const definitions: DefinitionDataRow[] = Array.from({ length: 25 }, (_, index) => ({
  id: `synthetic-definition-${index + 1}`,
  name: `Synthetic definition ${index + 1}`,
  description: `Synthetic criteria ${index + 1}`,
}));
const patients: Patient[] = definitions.map(({ id, name }) => ({ id, name, age: 30, gender: 'F' }));

type TableKind = 'cohorts' | 'queries' | 'results';

function table(kind: TableKind, onView = vi.fn()) {
  if (kind === 'cohorts') return <SavedCohorts onViewCohort={onView} />;
  if (kind === 'queries') return <SavedQueries onViewQuery={onView} />;
  return <SearchResultsTable patients={patients} />;
}

beforeEach(() => {
  vi.mocked(getQueries).mockResolvedValue(definitions);
  vi.mocked(useCohorts).mockReturnValue({ cohorts: definitions, isLoading: false, isValidating: false });
});

it.each(['cohorts', 'queries'] as const)('views the displayed %s entry on page two', async (kind) => {
  const user = userEvent.setup();
  const onView = vi.fn().mockResolvedValue(undefined);
  render(table(kind, onView));
  await screen.findByText('Synthetic definition 1');
  await user.click(screen.getByRole('button', { name: 'Next page' }));

  const row = screen.getByText('Synthetic definition 11').closest('tr');
  await user.click(within(row).getByRole('button'));
  await user.click(await screen.findByText('View'));

  expect(onView).toHaveBeenCalledWith('synthetic-definition-11');
});

it.each(['cohorts', 'queries'] as const)('confirms and deletes the displayed %s entry on page two', async (kind) => {
  const user = userEvent.setup();
  render(table(kind));
  await screen.findByText('Synthetic definition 1');
  await user.click(screen.getByRole('button', { name: 'Next page' }));

  const row = screen.getByText('Synthetic definition 11').closest('tr');
  await user.click(within(row).getByRole('button'));
  await user.click(await screen.findByText('Delete'));

  const props = vi.mocked(showModal).mock.calls.at(-1)[1];
  if (kind === 'cohorts') {
    expect(props).toMatchObject({ cohortId: 'synthetic-definition-11', cohortName: 'Synthetic definition 11' });
  } else {
    expect(props).toMatchObject({ queryId: 'synthetic-definition-11', queryName: 'Synthetic definition 11' });
  }

  const onDelete = kind === 'cohorts' ? props.onDeleteCohort : props.onDelete;
  if (typeof onDelete !== 'function') throw new Error('Expected the confirmation modal to provide a deletion callback');
  await act(async () => {
    await onDelete();
  });
  expect(kind === 'cohorts' ? onDeleteCohort : deleteDataSet).toHaveBeenCalledWith('synthetic-definition-11');
});

it.each(['cohorts', 'queries', 'results'] as const)('can navigate to page three in %s', async (kind) => {
  const user = userEvent.setup();
  render(table(kind));
  await screen.findByText('Synthetic definition 1');

  await user.click(screen.getByRole('button', { name: 'Next page' }));
  await user.click(screen.getByRole('button', { name: 'Next page' }));

  expect(screen.getByText('Synthetic definition 21')).toBeInTheDocument();
  expect(screen.queryByText('Synthetic definition 11')).not.toBeInTheDocument();
});

it.each(['cohorts', 'queries', 'results'] as const)('keeps the selected page size in %s', async (kind) => {
  const user = userEvent.setup();
  render(table(kind));
  await screen.findByText('Synthetic definition 1');

  await user.selectOptions(screen.getByLabelText('Items per page:'), '20');
  expect(screen.getByLabelText('Items per page:')).toHaveValue('20');
  await user.click(screen.getByRole('button', { name: 'Next page' }));

  expect(screen.getByText('Synthetic definition 21')).toBeInTheDocument();
  expect(screen.getByLabelText('Items per page:')).toHaveValue('20');
});

it('shows the first page when a new search returns fewer results', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<SearchResultsTable patients={patients} />);
  await user.click(screen.getByRole('button', { name: 'Next page' }));

  rerender(<SearchResultsTable patients={patients.slice(0, 2)} />);

  expect(screen.getByText('Synthetic definition 1')).toBeInTheDocument();
  expect(screen.getByText('Synthetic definition 2')).toBeInTheDocument();
});

it('keeps a valid page when a cohort refresh removes the last page', async () => {
  const user = userEvent.setup();
  const { rerender } = render(table('cohorts'));
  await user.click(screen.getByRole('button', { name: 'Next page' }));

  vi.mocked(useCohorts).mockReturnValue({ cohorts: definitions.slice(0, 10), isLoading: false, isValidating: false });
  rerender(table('cohorts'));

  expect(screen.getByText('Synthetic definition 1')).toBeInTheDocument();
});
