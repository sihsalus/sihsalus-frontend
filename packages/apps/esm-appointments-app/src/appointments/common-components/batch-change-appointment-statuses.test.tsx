import { showSnackbar, updateVisit } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useMutateAppointments } from '../../form/appointments-form.resource';
import {
  changeAppointmentStatus,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { type Appointment, AppointmentStatus } from '../../types';

import BatchChangeAppointmentStatusesModal from './batch-change-appointment-statuses.modal';
import { getActiveVisitsForPatient } from './batch-change-appointment-statuses.resources';

vi.mock('../../form/appointments-form.resource', () => ({
  useMutateAppointments: vi.fn(),
}));

vi.mock('../../patient-appointments/patient-appointments.resource', () => ({
  changeAppointmentStatus: vi.fn(),
  getAppointmentStatus: vi.fn(),
}));

vi.mock('./batch-change-appointment-statuses.resources', () => ({
  getActiveVisitsForPatient: vi.fn(),
}));

const closeModal = vi.fn();
const mutateAppointments = vi.fn();
const mockChangeAppointmentStatus = vi.mocked(changeAppointmentStatus);
const mockGetAppointmentStatus = vi.mocked(getAppointmentStatus);
const mockGetActiveVisitsForPatient = vi.mocked(getActiveVisitsForPatient);
const mockUpdateVisit = vi.mocked(updateVisit);
const mockUseMutateAppointments = vi.mocked(useMutateAppointments);

const appointment = {
  uuid: 'appointment-uuid',
  status: AppointmentStatus.SCHEDULED,
  patient: {
    name: 'Rosa Elena Ahuanari Flores',
    uuid: 'patient-uuid',
  },
  service: {
    name: 'Consulta externa',
  },
} as Appointment;

async function selectStatus(status: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: status }));
  return user;
}

describe('BatchChangeAppointmentStatusesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutateAppointments.mockReturnValue({ mutateAppointments } as unknown as ReturnType<
      typeof useMutateAppointments
    >);
    mockChangeAppointmentStatus.mockResolvedValue({} as Awaited<ReturnType<typeof changeAppointmentStatus>>);
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.SCHEDULED);
  });

  it('does not offer Completed because checkout requires per-patient visit reconciliation', async () => {
    render(<BatchChangeAppointmentStatusesModal appointments={[appointment]} closeModal={closeModal} />);

    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.queryByRole('option', { name: /completed/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /cancelled/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /missed/i })).toBeInTheDocument();
  });

  it('updates only appointment status for an allowed batch transition', async () => {
    render(<BatchChangeAppointmentStatusesModal appointments={[appointment]} closeModal={closeModal} />);
    const user = await selectStatus('Cancelled');

    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.CANCELLED, appointment.uuid);
    expect(mockGetActiveVisitsForPatient).not.toHaveBeenCalled();
    expect(mockUpdateVisit).not.toHaveBeenCalled();
  });

  it('uses a safe Spanish fallback instead of exposing a technical batch error', async () => {
    mockChangeAppointmentStatus.mockRejectedValueOnce(new Error('SQL connection refused at db.internal'));
    render(<BatchChangeAppointmentStatusesModal appointments={[appointment]} closeModal={closeModal} />);
    const user = await selectStatus('Cancelled');

    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle:
            'No se pudo actualizar la cita de Rosa Elena Ahuanari Flores. Revise su estado e intente nuevamente.',
        }),
      ),
    );
    expect(JSON.stringify(vi.mocked(showSnackbar).mock.calls)).not.toContain('SQL connection refused');
    expect(mockGetActiveVisitsForPatient).not.toHaveBeenCalled();
    expect(mockUpdateVisit).not.toHaveBeenCalled();
  });

  it('rejects a stale batch transition after another operator checked the patient in', async () => {
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.CHECKEDIN);
    render(<BatchChangeAppointmentStatusesModal appointments={[appointment]} closeModal={closeModal} />);
    const user = await selectStatus('Cancelled');

    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
    expect(mockGetAppointmentStatus).toHaveBeenCalledWith(appointment.uuid);
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });
});
