import { showModal, userHasAccess, useSession } from '@openmrs/esm-framework';
import {
  appointmentsPrivilege,
  chartAppointmentsReadPrivilege,
  patientIdentityPrintModal,
  patientIdentityPrintPrivilege,
} from '../constants';

export function useAppointmentPatientPrint(isPatientChart = false) {
  const session = useSession();
  const context = isPatientChart ? 'patient-chart-appointments' : 'appointments';
  const privileges = [
    isPatientChart ? chartAppointmentsReadPrivilege : appointmentsPrivilege,
    patientIdentityPrintPrivilege,
    'Get Patients',
  ];
  const canPrintPatient = Boolean(
    session?.user?.uuid && session.authenticated !== false && userHasAccess(privileges, session.user),
  );

  const printPatient = (patientUuid: string) => {
    if (!canPrintPatient || !patientUuid?.trim()) return;
    const dispose = showModal(patientIdentityPrintModal, {
      patientUuid,
      context,
      closeModal: () => dispose(),
    });
  };

  return { canPrintPatient, printPatient };
}
