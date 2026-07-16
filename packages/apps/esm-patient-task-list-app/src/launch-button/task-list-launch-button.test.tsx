import { ActionMenuButton2, UserHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import TaskListActionButton from './task-list-launch-button.extension';

const mockActionMenuButton = vi.mocked(ActionMenuButton2);
const mockUserHasAccess = vi.mocked(UserHasAccess);

mockActionMenuButton.mockImplementation(({ label }) => <button type="button">{label}</button>);
mockUserHasAccess.mockImplementation(({ children }) => <>{children}</>);

it('requires the task list visualization privilege', () => {
  render(<TaskListActionButton />);

  expect(screen.getByRole('button', { name: /task list/i })).toBeInTheDocument();
  expect(mockUserHasAccess.mock.calls.at(-1)?.[0]).toMatchObject({
    privilege: 'app:hoja.clinica.listaTareas',
  });
});

it('does not display the task list when access is denied', () => {
  mockUserHasAccess.mockReturnValueOnce(null);
  render(<TaskListActionButton />);

  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
