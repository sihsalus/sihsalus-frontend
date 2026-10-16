import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import FormsTable from './forms-table.component';

vi.mock('./forms-table.scss', () => ({
  default: {
    tableContainer: 'tableContainer',
    toolbarWrapper: 'toolbarWrapper',
    tableToolbar: 'tableToolbar',
    search: 'search',
    table: 'table',
    formName: 'formName',
    editCell: 'editCell',
  },
}));

const form = {
  uuid: 'synthetic-form',
  name: 'Consejería y acuerdos',
  version: '1',
  published: true,
  retired: false,
  resources: [],
};

it.each(['{Enter}', ' '])('opens the exact form and encounter using %s from the keyboard', async (key) => {
  const user = userEvent.setup();
  const handleFormOpen = vi.fn();
  const handleSubmit = vi.fn((event: FormEvent) => event.preventDefault());
  render(
    <form onSubmit={handleSubmit}>
      <FormsTable
        tableHeaders={[
          { key: 'formName', header: 'Formulario' },
          { key: 'lastCompleted', header: 'Última atención' },
        ]}
        tableRows={[
          { id: form.uuid, formName: form.name, formUuid: form.uuid, encounterUuid: 'synthetic-encounter', form },
        ]}
        isTablet={false}
        handleSearch={vi.fn()}
        handleFormOpen={handleFormOpen}
      />
    </form>,
  );
  const open = screen.getByRole('button', { name: form.name });
  for (let index = 0; index < 5 && document.activeElement !== open; index++) await user.tab();
  expect(open).toHaveFocus();
  await user.keyboard(key);
  expect(handleFormOpen).toHaveBeenCalledExactlyOnceWith(form, 'synthetic-encounter');
  expect(handleSubmit).not.toHaveBeenCalled();
});
