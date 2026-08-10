import { launchWorkspace2, showModal, userHasAccess, useSession } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  appointmentsEditPrivileges,
  chartAppointmentsEditPrivileges,
  chartAppointmentsFinalizeCarePrivilege,
  chartAppointmentsReadPrivilege,
} from '../constants';
import PatientAppointmentContext, { PatientAppointmentContextTypes } from '../hooks/patientAppointmentContext';
import { type Appointment, AppointmentStatus } from '../types';
import { PatientAppointmentsActionMenu } from './patient-appointments-action-menu.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
}));

const patientUuid = 'patient-uuid';
const appointment = {
  uuid: 'appointment-uuid',
  patient: { uuid: patientUuid },
  status: AppointmentStatus.SCHEDULED,
} as Appointment;
const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockShowModal = vi.mocked(showModal);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

function renderMenu(context: PatientAppointmentContextTypes, status = AppointmentStatus.SCHEDULED) {
  return render(
    <PatientAppointmentContext.Provider value={context}>
      <PatientAppointmentsActionMenu appointment={{ ...appointment, status }} patientUuid={patientUuid} />
    </PatientAppointmentContext.Provider>,
  );
}

async function chooseMenuItem(id: 'editAppointment' | 'cancelAppointment' | 'finalizeCare') {
  await userEvent.click(screen.getByRole('button', { name: /actions/i }));
  const menuItem = document.getElementById(id);
  expect(menuItem).toBeInTheDocument();
  await userEvent.click(menuItem);
}

describe('PatientAppointmentsActionMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ user: { uuid: 'user-uuid' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValue(true);
  });

  it('uses the home privilege and workspace in the appointments app', async () => {
    renderMenu(PatientAppointmentContextTypes.APPOINTMENTS_APP);

    expect(screen.queryByRole('button', { name: /options/i })).not.toBeInTheDocument();
    await chooseMenuItem('editAppointment');

    expect(mockUserHasAccess).toHaveBeenCalledWith(appointmentsEditPrivileges, expect.anything());
    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'appointments-form-workspace',
      expect.objectContaining({ appointment: expect.objectContaining({ uuid: appointment.uuid }), patientUuid }),
    );
    expect(mockLaunchPatientWorkspace).not.toHaveBeenCalled();
  });

  it('uses the patient-chart privilege and workspace in the clinical chart', async () => {
    renderMenu(PatientAppointmentContextTypes.PATIENT_CHART);

    await chooseMenuItem('editAppointment');

    expect(mockUserHasAccess).toHaveBeenCalledWith(chartAppointmentsEditPrivileges, expect.anything());
    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith(
      'patient-chart-appointments-form-workspace',
      expect.objectContaining({ appointment: expect.objectContaining({ uuid: appointment.uuid }), patientUuid }),
    );
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it.each([
    [PatientAppointmentContextTypes.APPOINTMENTS_APP, 'cancel-appointment-modal'],
    [PatientAppointmentContextTypes.PATIENT_CHART, 'patient-chart-cancel-appointment-modal'],
  ])('uses the context-specific protected cancel modal for context %s', async (context, modalName) => {
    renderMenu(context);

    await chooseMenuItem('cancelAppointment');

    expect(mockShowModal).toHaveBeenCalledWith(
      modalName,
      expect.objectContaining({ appointmentUuid: appointment.uuid, closeCancelModal: expect.any(Function) }),
    );
  });

  it.each([
    AppointmentStatus.CHECKEDIN,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.MISSED,
  ])('does not expose edit or cancellation actions for %s appointments', (status) => {
    renderMenu(PatientAppointmentContextTypes.APPOINTMENTS_APP, status);

    expect(screen.queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
  });

  it('allows clinical staff to finish a checked-in appointment from the patient chart', async () => {
    renderMenu(PatientAppointmentContextTypes.PATIENT_CHART, AppointmentStatus.CHECKEDIN);

    await chooseMenuItem('finalizeCare');

    expect(mockShowModal).toHaveBeenCalledWith(
      'patient-chart-end-appointment-modal',
      expect.objectContaining({
        appointmentUuid: appointment.uuid,
        patientUuid,
        closeModal: expect.any(Function),
      }),
    );
    expect(mockUserHasAccess).toHaveBeenCalledWith(
      ['app:hoja.clinica.citas', 'app:hoja.clinica.citas.editar.finalizarAtencion'],
      expect.anything(),
    );
  });

  it('shows only finalization with the chart base and finalize privileges', async () => {
    const grantedUiPrivileges = new Set([chartAppointmentsReadPrivilege, chartAppointmentsFinalizeCarePrivilege]);
    mockUserHasAccess.mockImplementation((requiredPrivileges) => {
      const privileges = Array.isArray(requiredPrivileges) ? requiredPrivileges : [requiredPrivileges];
      return privileges.every((privilege) => !privilege.startsWith('app:') || grantedUiPrivileges.has(privilege));
    });

    renderMenu(PatientAppointmentContextTypes.PATIENT_CHART, AppointmentStatus.CHECKEDIN);
    await userEvent.click(screen.getByRole('button', { name: /actions/i }));

    expect(document.getElementById('finalizeCare')).toBeInTheDocument();
    expect(document.getElementById('editAppointment')).not.toBeInTheDocument();
    expect(document.getElementById('cancelAppointment')).not.toBeInTheDocument();
  });

  it('does not show finalization when the chart base privilege is missing', () => {
    mockUserHasAccess.mockImplementation((requiredPrivileges) => {
      const privileges = Array.isArray(requiredPrivileges) ? requiredPrivileges : [requiredPrivileges];
      return privileges.every(
        (privilege) => !privilege.startsWith('app:') || privilege === chartAppointmentsFinalizeCarePrivilege,
      );
    });

    renderMenu(PatientAppointmentContextTypes.PATIENT_CHART, AppointmentStatus.CHECKEDIN);

    expect(screen.queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
  });

  it('does not expose clinical finalization in the administrative appointment context', () => {
    renderMenu(PatientAppointmentContextTypes.APPOINTMENTS_APP, AppointmentStatus.CHECKEDIN);

    expect(screen.queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
  });
});
