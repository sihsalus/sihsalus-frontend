import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { fireEvent, render, screen, within } from '@testing-library/react';

import CaseEncounterTable from './case-encounter-table.component';

const encounters = [
  { uuid: 'synthetic-encounter-a', encounterDatetime: '2030-01-01T10:00:00Z', obs: [] },
  { uuid: 'synthetic-encounter-b', encounterDatetime: '2030-01-02T10:00:00Z', obs: [] },
];
const rows = [
  { id: 'synthetic-encounter-a', formName: 'First follow-up' },
  { id: 'synthetic-encounter-b', formName: 'Second follow-up' },
];
const headers = [{ key: 'formName', header: 'Form name' }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({});
  vi.mocked(useSession).mockReturnValue({ user: { uuid: 'synthetic-reader', privileges: [] } } as ReturnType<typeof useSession>);
  vi.mocked(userHasAccess).mockReturnValue(false);
});

it('allows reading and expanding encounters without exposing edit or delete commands', () => {
  const edit = vi.fn();
  const remove = vi.fn();
  render(<CaseEncounterTable encounters={encounters} rows={rows} headers={headers} onEdit={edit} onDelete={remove} />);
  const row = screen.getByRole('row', { name: /First follow-up/ });
  fireEvent.click(within(row).getByRole('button'));
  expect(screen.getByRole('cell', { name: 'First follow-up' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  expect(userHasAccess).toHaveBeenCalledWith('app:home.seguimientoCasos.editar', expect.anything());
  expect(edit).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

it('targets the expanded encounter for both mutations with the current shared edit privilege', () => {
  vi.mocked(userHasAccess).mockImplementation((privilege) => privilege === 'app:home.seguimientoCasos.editar');
  const edit = vi.fn();
  const remove = vi.fn();
  render(<CaseEncounterTable encounters={encounters} rows={rows} headers={headers} onEdit={edit} onDelete={remove} />);
  const row = screen.getByRole('row', { name: /Second follow-up/ });
  fireEvent.click(within(row).getByRole('button'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(edit).toHaveBeenCalledExactlyOnceWith('synthetic-encounter-b');
  expect(remove).toHaveBeenCalledExactlyOnceWith('synthetic-encounter-b');
});
