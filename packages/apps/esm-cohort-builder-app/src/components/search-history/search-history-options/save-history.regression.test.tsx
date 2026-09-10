import { showModal, showSnackbar } from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SearchHistoryItem } from '../../../types';
import SaveCohortModal from './save-cohort.modal';
import SaveQueryModal from './save-query.modal';
import SearchHistoryOptions from './search-history-options.component';
import { createCohort, createQuery } from './search-history-options.resources';

vi.mock('./search-history-options.resources', () => ({ createCohort: vi.fn(), createQuery: vi.fn() }));

const searchItem: SearchHistoryItem = {
  id: '1',
  description: 'Synthetic criteria',
  results: '1',
  patients: [],
  memberIds: [101],
  parameters: {
    type: 'synthetic',
    columns: [],
    rowFilters: [{ key: 'synthetic-filter' }],
    customRowFilterCombination: '1',
  },
};

async function openSave(kind: 'cohort' | 'query', item = structuredClone(searchItem)) {
  const user = userEvent.setup();
  const closeModal = vi.fn();
  const { unmount } = render(<SearchHistoryOptions searchItem={item} updateSearchHistory={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: /options/i }));
  await user.click(screen.getByText(kind === 'cohort' ? /save cohort/i : /save query/i));
  const props = vi.mocked(showModal).mock.calls.at(-1)[1];
  unmount();
  if (kind === 'cohort') {
    render(<SaveCohortModal closeModal={closeModal} onSave={props.onSave as never} />);
  } else {
    render(<SaveQueryModal closeModal={closeModal} onSaveQuery={props.onSaveQuery as never} />);
  }
  const [name, description] = screen.getAllByRole('textbox');
  await user.type(name, '  Synthetic saved name  ');
  await user.type(description, '  Synthetic saved description  ');
  return { user, closeModal, name, description, item };
}

it.each([
  'cohort',
  'query',
] as const)('keeps the %s form until the server confirms and prevents duplicate saves', async (kind) => {
  let resolveSave: (value: unknown) => void;
  const request = new Promise((resolve) => {
    resolveSave = resolve;
  });
  const create = vi.mocked(kind === 'cohort' ? createCohort : createQuery);
  create.mockReturnValue(request as never);
  const { user, closeModal } = await openSave(kind);
  await user.click(screen.getByRole('button', { name: /save$/i }));
  expect(create).toHaveBeenCalledTimes(1);
  expect(closeModal).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  await user.keyboard('{Enter}');
  expect(create).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveSave({ status: 201 });
  });
  await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
});

it.each([
  'cohort',
  'query',
] as const)('retains the %s input after rejection and supports retry without exposing the error', async (kind) => {
  const create = vi.mocked(kind === 'cohort' ? createCohort : createQuery);
  create
    .mockRejectedValueOnce(new Error('Synthetic internal response'))
    .mockResolvedValueOnce({ status: 201 } as never);
  const { user, closeModal, name, description } = await openSave(kind);
  await user.click(screen.getByRole('button', { name: /save$/i }));
  await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
  expect(closeModal).not.toHaveBeenCalled();
  expect(name).toHaveValue('  Synthetic saved name  ');
  expect(description).toHaveValue('  Synthetic saved description  ');
  expect(JSON.stringify(vi.mocked(showSnackbar).mock.calls)).not.toContain('Synthetic internal response');
  await user.click(screen.getByRole('button', { name: /save$/i }));
  await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledTimes(2);
});

it('sends the submitted query values without modifying the source definition', async () => {
  vi.mocked(createQuery).mockResolvedValue({ status: 201 } as never);
  const original = structuredClone(searchItem);
  const { user, item } = await openSave('query', original);
  await user.click(screen.getByRole('button', { name: /save$/i }));
  await waitFor(() =>
    expect(createQuery).toHaveBeenCalledWith({
      ...searchItem.parameters,
      name: 'Synthetic saved name',
      description: 'Synthetic saved description',
    }),
  );
  expect(item).toEqual(searchItem);
});

it.each(['cohort', 'query'] as const)('rejects whitespace-only %s fields without a server write', async (kind) => {
  const { user, name, description, closeModal } = await openSave(kind);
  await user.clear(name);
  await user.type(name, '   ');
  await user.clear(description);
  await user.type(description, '   ');
  await user.click(screen.getByRole('button', { name: /save$/i }));
  expect(createCohort).not.toHaveBeenCalled();
  expect(createQuery).not.toHaveBeenCalled();
  expect(closeModal).not.toHaveBeenCalled();
});

it('does not offer saving a query when its definition is unavailable', async () => {
  const user = userEvent.setup();
  render(<SearchHistoryOptions searchItem={{ ...searchItem, parameters: undefined }} updateSearchHistory={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: /options/i }));
  expect(screen.getByText(/save query/i).closest('button')).toBeDisabled();
});

it.each([
  0,
  -1,
  NaN,
  Number.MAX_SAFE_INTEGER + 1,
])('rejects an invalid cohort member ID %s without writing', async (id) => {
  const { user, closeModal } = await openSave('cohort', { ...structuredClone(searchItem), memberIds: [id] });
  await user.click(screen.getByRole('button', { name: /save$/i }));
  await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
  expect(createCohort).not.toHaveBeenCalled();
  expect(closeModal).not.toHaveBeenCalled();
});

it('saves submitted cohort metadata with the original membership', async () => {
  vi.mocked(createCohort).mockResolvedValue({ status: 201 } as never);
  const { user } = await openSave('cohort');
  await user.click(screen.getByRole('button', { name: /save$/i }));
  await waitFor(() =>
    expect(createCohort).toHaveBeenCalledWith({
      display: 'Synthetic saved name',
      name: 'Synthetic saved name',
      description: 'Synthetic saved description',
      memberIds: [101],
    }),
  );
});
