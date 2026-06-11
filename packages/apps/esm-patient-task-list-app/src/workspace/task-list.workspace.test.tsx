import { type Visit } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type Task } from './task-list.resource';
import TaskListWorkspace from './task-list.workspace';

const mockTask: Task = {
  uuid: 'task-1',
  name: 'Mock Task',
  status: 'not-started',
  createdDate: new Date('2024-01-15T10:00:00Z'),
  completed: false,
};

vi.mock('./task-list.resource', () => ({
  useTaskList: vi.fn(),
  useTask: vi.fn(() => ({ task: null, isLoading: false, error: null, mutate: vi.fn() })),
}));

// Mock child components to avoid heavy dependency chains
vi.mock('./task-list-view.component', () => ({
  default: function MockTaskListView({ onTaskClick }: { onTaskClick?: (task: Task) => void }) {
    return (
      <div data-testid="task-list-view">
        <button type="button" onClick={() => onTaskClick?.(mockTask)}>
          Mock Task
        </button>
      </div>
    );
  },
}));

vi.mock('./add-task-form.component', () => ({
  default: function MockAddTaskForm({ onClose, editTaskUuid }: { onClose: () => void; editTaskUuid?: string }) {
    return (
      <div data-testid={editTaskUuid ? 'edit-task-form' : 'add-task-form'}>
        <span>{editTaskUuid ? 'Editing task' : 'Adding task'}</span>
        <button type="button" onClick={onClose}>
          Form back
        </button>
      </div>
    );
  },
}));

vi.mock('./task-details-view.component', () => ({
  default: function MockTaskDetailsView({ onBack, onEdit }: { onBack: () => void; onEdit?: (task: Task) => void }) {
    return (
      <div data-testid="task-details-view">
        <span>Task details</span>
        <button type="button" onClick={onBack}>
          Details back
        </button>
        {onEdit && (
          <button type="button" onClick={() => onEdit(mockTask)}>
            Edit
          </button>
        )}
      </div>
    );
  },
}));

const defaultProps = {
  launchChildWorkspace: vi.fn(),
  closeWorkspace: vi.fn(async () => true),
  workspaceProps: null,
  windowProps: null,
  groupProps: {
    patient: { id: 'patient-uuid-123' },
    patientUuid: 'patient-uuid-123',
    visitContext: { uuid: 'visit-uuid' } as Visit,
    mutateVisitContext: vi.fn(),
  },
  workspaceName: 'task-list',
  windowName: 'task-list',
  isRootWorkspace: true,
  showActionMenu: false,
} satisfies ComponentProps<typeof TaskListWorkspace>;

describe('TaskListWorkspace', () => {
  it('renders the task list view by default', () => {
    render(<TaskListWorkspace {...defaultProps} />);

    expect(screen.getByTestId('task-list-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
  });

  it('does not show back button in list view', () => {
    render(<TaskListWorkspace {...defaultProps} />);

    expect(screen.queryByText(/back to task list/i)).not.toBeInTheDocument();
  });

  it('navigates to form view when Add Task button is clicked', async () => {
    const user = userEvent.setup();

    render(<TaskListWorkspace {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /add task/i }));

    expect(screen.getByTestId('add-task-form')).toBeInTheDocument();
    expect(screen.getByText(/back to task list/i)).toBeInTheDocument();
    expect(screen.queryByTestId('task-list-view')).not.toBeInTheDocument();
  });

  it('navigates to details view when a task is clicked', async () => {
    const user = userEvent.setup();

    render(<TaskListWorkspace {...defaultProps} />);

    await user.click(screen.getByText('Mock Task'));

    expect(screen.getByTestId('task-details-view')).toBeInTheDocument();
    expect(screen.getByText(/back to task list/i)).toBeInTheDocument();
    expect(screen.queryByTestId('task-list-view')).not.toBeInTheDocument();
  });

  it('navigates back to list view from details', async () => {
    const user = userEvent.setup();

    render(<TaskListWorkspace {...defaultProps} />);

    // Go to details
    await user.click(screen.getByText('Mock Task'));
    expect(screen.getByTestId('task-details-view')).toBeInTheDocument();

    // Go back via back button in the workspace header
    await user.click(screen.getByRole('button', { name: /back to task list/i }));

    expect(screen.getByTestId('task-list-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
  });

  it('navigates to edit view from details', async () => {
    const user = userEvent.setup();

    render(<TaskListWorkspace {...defaultProps} />);

    // Go to details
    await user.click(screen.getByText('Mock Task'));

    // Click edit
    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByTestId('edit-task-form')).toBeInTheDocument();
    expect(screen.getByText(/back to task details/i)).toBeInTheDocument();
  });

  it('navigates from edit back to details', async () => {
    const user = userEvent.setup();

    render(<TaskListWorkspace {...defaultProps} />);

    // Go to details
    await user.click(screen.getByText('Mock Task'));

    // Go to edit
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByTestId('edit-task-form')).toBeInTheDocument();

    // Go back to details via workspace header back button
    await user.click(screen.getByRole('button', { name: /back to task details/i }));

    expect(screen.getByTestId('task-details-view')).toBeInTheDocument();
  });

  it('renders the add-task-form (not edit-task-form) in create mode', async () => {
    const user = userEvent.setup();

    render(<TaskListWorkspace {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /add task/i }));

    expect(screen.getByTestId('add-task-form')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-task-form')).not.toBeInTheDocument();
  });

  it('returns to list when AddTaskForm calls onClose from the form view', async () => {
    const user = userEvent.setup();

    render(<TaskListWorkspace {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /add task/i }));
    expect(screen.getByTestId('add-task-form')).toBeInTheDocument();

    // The mock add-task-form exposes a "Form back" button wired to onClose
    await user.click(screen.getByRole('button', { name: 'Form back' }));

    expect(screen.getByTestId('task-list-view')).toBeInTheDocument();
    expect(screen.queryByTestId('add-task-form')).not.toBeInTheDocument();
  });

  it('returns to list when TaskDetailsView calls onBack', async () => {
    const user = userEvent.setup();

    render(<TaskListWorkspace {...defaultProps} />);

    await user.click(screen.getByText('Mock Task'));
    expect(screen.getByTestId('task-details-view')).toBeInTheDocument();

    // The mock task-details-view exposes a "Details back" button wired to onBack
    await user.click(screen.getByRole('button', { name: 'Details back' }));

    expect(screen.getByTestId('task-list-view')).toBeInTheDocument();
    expect(screen.queryByTestId('task-details-view')).not.toBeInTheDocument();
  });

  it('returns to details when the edit form calls onClose', async () => {
    const user = userEvent.setup();

    render(<TaskListWorkspace {...defaultProps} />);

    // Navigate to edit: list -> details -> edit
    await user.click(screen.getByText('Mock Task'));
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByTestId('edit-task-form')).toBeInTheDocument();

    // The mock add-task-form exposes a "Form back" button wired to onClose;
    // in edit mode the workspace's handleEditComplete returns to the details view
    await user.click(screen.getByRole('button', { name: 'Form back' }));

    expect(screen.getByTestId('task-details-view')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-task-form')).not.toBeInTheDocument();
  });
});
