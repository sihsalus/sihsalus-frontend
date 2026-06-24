import { showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { updateProcedureStepStatus } from '../../api';
import UpdateProcedureStepStatusModal from './update-procedureStep-status.modal';

vi.mock('../../api', () => ({
  updateProcedureStepStatus: vi.fn(),
}));

vi.mock('@openmrs/esm-framework', () => ({
  showSnackbar: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultText: string) => defaultText,
  }),
}));

describe('UpdateProcedureStepStatusModal', () => {
  const closeMock = vi.fn();
  const stepId = 1;
  const status = 'rejected';
  const mutateStepsMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders modal text correctly', () => {
    render(
      <UpdateProcedureStepStatusModal
        closeChangeStepStatusModel={closeMock}
        stepId={stepId}
        status={status}
        mutateSteps={mutateStepsMock}
      />,
    );

    expect(screen.getByText('Update procedure step')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to change this procedure step?')).toBeInTheDocument();
    expect(screen.getByText('You need to create a new procedure step to renew the rejected step!')).toBeInTheDocument();
  });

  test('clicking Cancel calls closeChangeStepStatusModel', () => {
    render(
      <UpdateProcedureStepStatusModal
        closeChangeStepStatusModel={closeMock}
        stepId={stepId}
        status={status}
        mutateSteps={mutateStepsMock}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test('submitting calls updateProcedureStepStatus and shows success snackbar', async () => {
    (updateProcedureStepStatus as vi.Mock).mockResolvedValue({});

    render(
      <UpdateProcedureStepStatusModal
        closeChangeStepStatusModel={closeMock}
        stepId={stepId}
        status={status}
        mutateSteps={mutateStepsMock}
      />,
    );

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => {
      expect(updateProcedureStepStatus).toHaveBeenCalledWith(status, stepId, expect.any(AbortController));
    });
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  test('shows error snackbar on failure', async () => {
    (updateProcedureStepStatus as vi.Mock).mockRejectedValueOnce(new Error('Update failed'));

    render(
      <UpdateProcedureStepStatusModal
        closeChangeStepStatusModel={closeMock}
        stepId={stepId}
        status={status}
        mutateSteps={mutateStepsMock}
      />,
    );

    fireEvent.click(screen.getByText('submit'));

    await waitFor(() => {
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'Update failed',
        }),
      );
    });
    expect(closeMock).not.toHaveBeenCalled();
  });
});
