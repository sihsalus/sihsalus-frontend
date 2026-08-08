import { Button, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, userHasAccess, useSession } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const admissionPrivilege = 'app:home.admision';
const patientSearchAppointmentWorkspace = 'patient-search-appointments-form-workspace';

interface ScheduleAppointmentActionProps {
  closeMenu?: () => void;
  patientUuid: string;
}

const ScheduleAppointmentAction: React.FC<ScheduleAppointmentActionProps> = ({ closeMenu, patientUuid }) => {
  const { t } = useTranslation();

  const handleScheduleAppointment = useCallback(() => {
    closeMenu?.();
    void launchWorkspace2(patientSearchAppointmentWorkspace, {
      context: 'creating',
      patientUuid,
      workspaceTitle: t('createNewAppointment', 'Crear nueva cita'),
    });
  }, [closeMenu, patientUuid, t]);

  return (
    <OverflowMenuItem itemText={t('scheduleAppointment', 'Schedule appointment')} onClick={handleScheduleAppointment} />
  );
};

export default ScheduleAppointmentAction;

export const ScheduleAppointmentPrimaryAction: React.FC<Pick<ScheduleAppointmentActionProps, 'patientUuid'>> = ({
  patientUuid,
}) => {
  const { t } = useTranslation();
  const { user } = useSession();
  const isAdmissionUser = userHasAccess(admissionPrivilege, user);

  const handleScheduleAppointment = useCallback(() => {
    void launchWorkspace2(patientSearchAppointmentWorkspace, {
      context: 'creating',
      patientUuid,
      workspaceTitle: t('createNewAppointment', 'Crear nueva cita'),
    });
  }, [patientUuid, t]);

  if (!isAdmissionUser) {
    return null;
  }

  return (
    <Button kind="primary" onClick={handleScheduleAppointment}>
      {t('addAppointment', 'Agregar cita')}
    </Button>
  );
};
