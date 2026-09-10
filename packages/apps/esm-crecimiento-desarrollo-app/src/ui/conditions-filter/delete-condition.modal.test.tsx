import { type FetchResponse, showSnackbar, userHasAccess } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';
import { deleteCondition, useConditions } from './conditions.resource';
import DeleteConditionModal from './delete-condition.modal';

const mockDeleteCondition = vi.mocked(deleteCondition);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConditions = vi.mocked(useConditions);
const mutate = vi.fn();
const reason = 'Synthetic duplicate entry entered in error';

vi.mock('./conditions.resource', () => ({
  deleteCondition: vi.fn(),
  useConditions: vi.fn(),
}));

const defaultProps = {
  closeDeleteModal: vi.fn(),
  conditionId: '123e4567-e89b-12d3-a456-426614174000',
  patientUuid: mockPatient.id,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('<DeleteConditionModal />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteCondition.mockReset();
    mutate.mockReset().mockResolvedValue(undefined);
    mockUseConditions.mockReturnValue({ mutate } as unknown as ReturnType<typeof useConditions>);
    vi.mocked(userHasAccess).mockReturnValue(true);
  });

  it('allows cancellation before a deletion starts', async () => {
    const user = userEvent.setup();
    render(<DeleteConditionModal {...defaultProps} />);
    await user.type(screen.getByRole('textbox', { name: /reason for removal/i }), reason);
    expect(screen.getByRole('heading', { name: /delete condition/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.closeDeleteModal).toHaveBeenCalledOnce();
    expect(mockDeleteCondition).not.toHaveBeenCalled();
  });

  it('refreshes the history after a successful deletion and closes the modal', async () => {
    const user = userEvent.setup();
    mockDeleteCondition.mockResolvedValue({ status: 204 } as FetchResponse);
    render(<DeleteConditionModal {...defaultProps} />);
    await user.type(screen.getByRole('textbox', { name: /reason for removal/i }), reason);
    await user.click(screen.getByRole('button', { name: /delete$/i }));

    expect(mockDeleteCondition).toHaveBeenCalledExactlyOnceWith(
      defaultProps.conditionId,
      defaultProps.patientUuid,
      reason,
    );
    expect(mutate).toHaveBeenCalledOnce();
    expect(mockDeleteCondition.mock.invocationCallOrder[0]).toBeLessThan(mutate.mock.invocationCallOrder[0]);
    expect(mockShowSnackbar).toHaveBeenCalledExactlyOnceWith({
      isLowContrast: true,
      kind: 'success',
      title: 'Condition deleted',
    });
    expect(defaultProps.closeDeleteModal).toHaveBeenCalledOnce();
  });

  it.each([
    new Error('private backend detail'),
    null,
    undefined,
  ])('keeps the modal usable for retry and hides unexpected deletion errors (%s)', async (error) => {
    const user = userEvent.setup();
    mockDeleteCondition.mockRejectedValueOnce(error);
    render(<DeleteConditionModal {...defaultProps} />);
    await user.type(screen.getByRole('textbox', { name: /reason for removal/i }), reason);
    const deleteButton = screen.getByRole('button', { name: /delete$/i });
    await user.click(deleteButton);

    expect(screen.getByRole('textbox', { name: /reason for removal/i })).toHaveValue(reason);
    expect(deleteButton).toBeEnabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
    expect(defaultProps.closeDeleteModal).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      title: 'Error deleting condition',
      subtitle: 'The condition could not be deleted. Please try again.',
    });

    mockDeleteCondition.mockResolvedValueOnce({ status: 204 } as FetchResponse);
    await user.click(deleteButton);
    expect(mockDeleteCondition).toHaveBeenCalledTimes(2);
    expect(defaultProps.closeDeleteModal).toHaveBeenCalledOnce();
  });

  it('reports refresh failure after deletion without inviting a duplicate delete', async () => {
    const user = userEvent.setup();
    mockDeleteCondition.mockResolvedValue({ status: 204 } as FetchResponse);
    mutate.mockRejectedValueOnce(new Error('private refresh response'));
    render(<DeleteConditionModal {...defaultProps} />);
    await user.type(screen.getByRole('textbox', { name: /reason for removal/i }), reason);
    const deleteButton = screen.getByRole('button', { name: /delete$/i });
    await user.click(deleteButton);

    expect(mockShowSnackbar).toHaveBeenCalledExactlyOnceWith({
      isLowContrast: false,
      kind: 'warning',
      title: 'Antecedent deleted; refresh needed',
      subtitle:
        'The antecedent was deleted, but the history could not be refreshed. Reload the page before making further changes.',
    });
    expect(defaultProps.closeDeleteModal).toHaveBeenCalledOnce();
    expect(deleteButton).toBeDisabled();
    await user.click(deleteButton);
    expect(mockDeleteCondition).toHaveBeenCalledOnce();
  });

  it('blocks repeated submission and closing while deletion or refresh is pending', async () => {
    const user = userEvent.setup();
    const deletion = deferred<FetchResponse>();
    const refresh = deferred<undefined>();
    mockDeleteCondition.mockReturnValue(deletion.promise);
    mutate.mockReturnValue(refresh.promise);
    render(<DeleteConditionModal {...defaultProps} />);
    await user.type(screen.getByRole('textbox', { name: /reason for removal/i }), reason);
    const deleteButton = screen.getByRole('button', { name: /delete$/i });

    await user.dblClick(deleteButton);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(mockDeleteCondition).toHaveBeenCalledOnce();
    expect(mutate).not.toHaveBeenCalled();
    expect(defaultProps.closeDeleteModal).not.toHaveBeenCalled();
    expect(deleteButton).toBeDisabled();

    await act(async () => deletion.resolve({ status: 204 } as FetchResponse));
    expect(mutate).toHaveBeenCalledOnce();
    expect(deleteButton).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(defaultProps.closeDeleteModal).not.toHaveBeenCalled();

    await act(async () => refresh.resolve(undefined));
    expect(defaultProps.closeDeleteModal).toHaveBeenCalledOnce();
    expect(mockDeleteCondition).toHaveBeenCalledOnce();
  });

  it('closes without rendering an action or writing when the edit privilege is absent', () => {
    vi.mocked(userHasAccess).mockReturnValue(false);
    render(<DeleteConditionModal {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /delete$/i })).not.toBeInTheDocument();
    expect(defaultProps.closeDeleteModal).toHaveBeenCalledOnce();
    expect(mockDeleteCondition).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
  it('requires a nonblank reason before allowing an annulment', async () => {
    const user = userEvent.setup();
    render(<DeleteConditionModal {...defaultProps} />);
    const input = screen.getByRole('textbox', { name: /reason for removal/i });
    const button = screen.getByRole('button', { name: /delete$/i });
    expect(input).toBeRequired();
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: '   \n  ' } });
    fireEvent.blur(input);
    expect(screen.getByText('Enter a reason for removing this antecedent.')).toBeInTheDocument();
    await user.click(button);
    expect(mockDeleteCondition).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
  });

  it('sends a trimmed reason and explains that the original record is retained', async () => {
    const user = userEvent.setup();
    mockDeleteCondition.mockResolvedValue({ status: 204 } as FetchResponse);
    render(<DeleteConditionModal {...defaultProps} />);
    expect(screen.getByText(/while retaining the original record/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /reason for removal/i }), {
      target: { value: `  ${reason}  ` },
    });
    await user.click(screen.getByRole('button', { name: /delete$/i }));
    expect(mockDeleteCondition).toHaveBeenCalledExactlyOnceWith(
      defaultProps.conditionId,
      defaultProps.patientUuid,
      reason,
    );
  });

  it('rejects an oversized reason and accepts exactly 255 characters', async () => {
    const user = userEvent.setup();
    mockDeleteCondition.mockResolvedValue({ status: 204 } as FetchResponse);
    render(<DeleteConditionModal {...defaultProps} />);
    const input = screen.getByRole('textbox', { name: /reason for removal/i });
    const button = screen.getByRole('button', { name: /delete$/i });
    expect(input).toHaveAttribute('maxlength', '255');
    fireEvent.change(input, { target: { value: 'a'.repeat(256) } });
    fireEvent.blur(input);
    expect(screen.getByText('The reason must contain at most 255 characters.')).toBeInTheDocument();
    expect(button).toBeDisabled();
    await user.click(button);
    expect(mockDeleteCondition).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'a'.repeat(255) } });
    await user.click(button);
    expect(mockDeleteCondition).toHaveBeenCalledExactlyOnceWith(
      defaultProps.conditionId,
      defaultProps.patientUuid,
      'a'.repeat(255),
    );
  });
});
