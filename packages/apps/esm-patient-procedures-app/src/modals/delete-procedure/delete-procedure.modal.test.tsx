import { type FetchResponse, showSnackbar } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteProcedure, useMutatePatientProcedures } from '../../procedures.resource';
import DeleteProcedureModal from './delete-procedure.modal';

const mockDeleteProcedure = vi.mocked(deleteProcedure);
const mockShowSnackbar = vi.mocked(showSnackbar);

vi.mock('../../procedures.resource', async () => ({
  ...(await vi.importActual('../../procedures.resource')),
  deleteProcedure: vi.fn(),
  useMutatePatientProcedures: vi.fn().mockReturnValue(vi.fn()),
}));

const defaultProps = {
  closeDeleteModal: vi.fn(),
  procedureUuid: '123e4567-e89b-12d3-a456-426614174000',
  patientUuid: mockPatient.id,
};

beforeEach(() => vi.mocked(useMutatePatientProcedures).mockReturnValue(vi.fn()));

describe('<DeleteProcedureModal />', () => {
  it('rejects a blank reason without sending a delete request', async () => {
    render(<DeleteProcedureModal {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /^void$/i }));
    expect(screen.getByText('A reason for voiding is required')).toBeInTheDocument();
    expect(mockDeleteProcedure).not.toHaveBeenCalled();
  });

  it('renders a modal with the correct elements', () => {
    render(<DeleteProcedureModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /void procedure/i })).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to void this procedure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^void$/i })).toBeInTheDocument();
  });

  it('clicking the Cancel button closes the modal', async () => {
    const user = userEvent.setup();

    render(<DeleteProcedureModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    expect(defaultProps.closeDeleteModal).toHaveBeenCalled();
  });

  it('clicking the Delete button deletes the procedure', async () => {
    const user = userEvent.setup();
    mockDeleteProcedure.mockResolvedValue({ status: 200, data: {} } as unknown as FetchResponse);

    render(<DeleteProcedureModal {...defaultProps} />);

    await user.type(screen.getByRole('textbox', { name: /reason for voiding/i }), 'Entered in error');
    const deleteButton = screen.getByRole('button', { name: /^void$/i });
    await user.click(deleteButton);

    expect(mockDeleteProcedure).toHaveBeenCalledTimes(1);
    expect(mockDeleteProcedure).toHaveBeenCalledWith(defaultProps.procedureUuid, 'Entered in error');
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'success',
      title: 'Procedure voided',
    });
  });

  it('renders an error message if the delete operation fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    mockDeleteProcedure.mockRejectedValue({ message: 'Internal server error', status: 500 });

    render(<DeleteProcedureModal {...defaultProps} />);

    await user.type(screen.getByRole('textbox', { name: /reason for voiding/i }), 'Entered in error');
    const deleteButton = screen.getByRole('button', { name: /^void$/i });
    await user.click(deleteButton);

    expect(mockDeleteProcedure).toHaveBeenCalledTimes(1);
    expect(mockDeleteProcedure).toHaveBeenCalledWith(defaultProps.procedureUuid, 'Entered in error');
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      title: 'Could not confirm procedure voiding',
      subtitle: 'Check the procedure before trying again.',
    });
    expect(deleteButton).toBeEnabled();
    expect(screen.getByRole('textbox', { name: /reason for voiding/i })).toHaveValue('Entered in error');
    expect(defaultProps.closeDeleteModal).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

it.each([254, 255])('preserves and sends a %i-code-point reason including Unicode and line breaks', async (length) => {
  const reason = 'é😀e\u0301\n' + 'a'.repeat(length - 5);
  mockDeleteProcedure.mockResolvedValue({ status: 200 } as FetchResponse);
  render(<DeleteProcedureModal {...defaultProps} />);
  await userEvent.click(screen.getByRole('textbox', { name: /reason for voiding/i }));
  await userEvent.paste(reason);
  expect(screen.getByText(`${length} / 255 characters`)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /^void$/i }));
  expect(mockDeleteProcedure).toHaveBeenCalledExactlyOnceWith(defaultProps.procedureUuid, reason);
});

it('rejects excess text without truncating the input or sending a request', async () => {
  const reason = '😀'.repeat(256);
  render(<DeleteProcedureModal {...defaultProps} />);
  const input = screen.getByRole('textbox', { name: /reason for voiding/i });
  await userEvent.click(input);
  await userEvent.paste(reason);
  await userEvent.click(screen.getByRole('button', { name: /^void$/i }));
  expect(input).toHaveValue(reason);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('Reason for voiding exceeds 255 characters')).toBeInTheDocument();
  expect(mockDeleteProcedure).not.toHaveBeenCalled();
});

it('reports a confirmed void separately from a refresh failure, without offering another write', async () => {
  vi.mocked(useMutatePatientProcedures).mockReturnValue(
    vi.fn().mockRejectedValue(new Error('private refresh failure')),
  );
  mockDeleteProcedure.mockResolvedValue({ status: 200 } as FetchResponse);
  render(<DeleteProcedureModal {...defaultProps} />);
  await userEvent.type(screen.getByRole('textbox', { name: /reason for voiding/i }), 'Wrong entry');
  await userEvent.click(screen.getByRole('button', { name: /^void$/i }));
  expect(mockDeleteProcedure).toHaveBeenCalledTimes(1);
  expect(mockShowSnackbar).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'warning', title: 'Procedure voided' }),
  );
  expect(defaultProps.closeDeleteModal).toHaveBeenCalledTimes(1);
});
