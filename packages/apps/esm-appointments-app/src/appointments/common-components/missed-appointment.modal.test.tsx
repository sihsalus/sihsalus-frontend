import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useMutateAppointments } from '../../form/appointments-form.resource';
import {
  changeAppointmentStatus,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { AppointmentStatus } from '../../types';
import MissedAppointmentModal from './missed-appointment.modal';

vi.mock('../../form/appointments-form.resource', () => ({
  useMutateAppointments: vi.fn(),
}));

vi.mock('../../patient-appointments/patient-appointments.resource', () => ({
  changeAppointmentStatus: vi.fn(),
  getAppointmentStatus: vi.fn(),
}));

const appointmentUuid = 'appointment-uuid';
const closeModal = vi.fn();
const mutateAppointments = vi.fn();
const mockChangeAppointmentStatus = vi.mocked(changeAppointmentStatus);
const mockGetAppointmentStatus = vi.mocked(getAppointmentStatus);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockUseMutateAppointments = vi.mocked(useMutateAppointments);

function renderModal() {
  return render(<MissedAppointmentModal appointmentUuid={appointmentUuid} closeModal={closeModal} />);
}

describe('MissedAppointmentModal', () => {
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

    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(mockGetAppointmentStatus).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(mutateAppointments).not.toHaveBeenCalled();
  });

  it('re-reads status, marks as missed, and invalidates every appointment view', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /mark as missed/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockGetAppointmentStatus).toHaveBeenCalledWith(appointmentUuid);
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.MISSED, appointmentUuid);
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
      subtitle: 'La cita se marcó como perdida correctamente.',
      title: 'Cita marcada como perdida',
    });
  });

  it('is idempotent when the appointment is already missed', async () => {
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.MISSED);
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /mark as missed/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(mutateAppointments).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the fresh status no longer permits marking as missed', async () => {
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.COMPLETED);
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /mark as missed/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith({
        isLowContrast: false,
        kind: 'error',
        subtitle: 'El estado de la cita cambió y ya no permite marcarla como perdida. Actualice la lista.',
        title: 'No se pudo marcar la cita como perdida',
      }),
    );
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(mutateAppointments).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('uses a safe fallback when the status request fails', async () => {
    mockGetAppointmentStatus.mockRejectedValue(new Error('SQL connection refused at db.internal'));
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /mark as missed/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith({
        isLowContrast: false,
        kind: 'error',
        subtitle: 'No se pudo marcar la cita como perdida. Revise su estado e intente nuevamente.',
        title: 'No se pudo marcar la cita como perdida',
      }),
    );
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
  });
});
