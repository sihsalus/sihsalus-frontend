import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useMutateAppointments } from '../form/appointments-form.resource';
import { AppointmentStatus } from '../types';
import { changeAppointmentStatus, getAppointmentStatus } from './patient-appointments.resource';
import CancelAppointmentModal from './patient-appointments-cancel.modal';

vi.mock('../form/appointments-form.resource', () => ({
  useMutateAppointments: vi.fn(),
}));

vi.mock('./patient-appointments.resource', () => ({
  changeAppointmentStatus: vi.fn(),
  getAppointmentStatus: vi.fn(),
}));

const appointmentUuid = 'appointment-uuid';
const closeCancelModal = vi.fn();
const mutateAppointments = vi.fn();
const mockChangeAppointmentStatus = vi.mocked(changeAppointmentStatus);
const mockGetAppointmentStatus = vi.mocked(getAppointmentStatus);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockUseMutateAppointments = vi.mocked(useMutateAppointments);

function renderModal() {
  return render(<CancelAppointmentModal appointmentUuid={appointmentUuid} closeCancelModal={closeCancelModal} />);
}

describe('CancelAppointmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutateAppointments.mockReturnValue({ mutateAppointments } as ReturnType<typeof useMutateAppointments>);
    mutateAppointments.mockResolvedValue(undefined);
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.SCHEDULED);
    mockChangeAppointmentStatus.mockResolvedValue({} as Awaited<ReturnType<typeof changeAppointmentStatus>>);
    mockGetUserFacingErrorMessage.mockImplementation((error, fallback, options) => {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      return code != null ? (options.codeMessages?.[code as string] ?? fallback) : fallback;
    });
  });

  it('closes without changing state when the operator discards', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /discard/i }));

    expect(closeCancelModal).toHaveBeenCalledTimes(1);
    expect(mockGetAppointmentStatus).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(mutateAppointments).not.toHaveBeenCalled();
  });

  it('re-reads status, cancels, and invalidates every appointment view', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /cancel appointment$/i }));

    await waitFor(() => expect(closeCancelModal).toHaveBeenCalledTimes(1));
    expect(mockGetAppointmentStatus).toHaveBeenCalledWith(appointmentUuid);
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.CANCELLED, appointmentUuid);
    expect(mutateAppointments).toHaveBeenCalledTimes(1);
    expect(mockGetAppointmentStatus.mock.invocationCallOrder[0]).toBeLessThan(
      mockChangeAppointmentStatus.mock.invocationCallOrder[0],
    );
    expect(mockChangeAppointmentStatus.mock.invocationCallOrder[0]).toBeLessThan(
      mutateAppointments.mock.invocationCallOrder[0],
    );
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'success',
      subtitle: 'Cita cancelada correctamente.',
      title: 'Cita cancelada',
    });
  });

  it('is idempotent when the appointment is already cancelled', async () => {
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.CANCELLED);
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /cancel appointment$/i }));

    await waitFor(() => expect(closeCancelModal).toHaveBeenCalledTimes(1));
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(mutateAppointments).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the fresh status no longer permits cancellation', async () => {
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.CHECKEDIN);
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /cancel appointment$/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith({
        isLowContrast: false,
        kind: 'error',
        subtitle: 'El estado de la cita cambió y ya no permite cancelarla. Actualice la lista.',
        title: 'No se pudo cancelar la cita',
      }),
    );
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(mutateAppointments).not.toHaveBeenCalled();
    expect(closeCancelModal).not.toHaveBeenCalled();
  });

  it('uses a safe fallback when the status request fails', async () => {
    mockGetAppointmentStatus.mockRejectedValue(new Error('SQL connection refused at db.internal'));
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /cancel appointment$/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith({
        isLowContrast: false,
        kind: 'error',
        subtitle: 'No se pudo cancelar la cita. Revise su estado e intente nuevamente.',
        title: 'No se pudo cancelar la cita',
      }),
    );
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(closeCancelModal).not.toHaveBeenCalled();
  });
});
