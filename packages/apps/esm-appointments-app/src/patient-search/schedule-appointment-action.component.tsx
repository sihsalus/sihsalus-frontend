import { Button, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, userHasAccess, useSession } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { appointmentsEditPrivilege } from '../constants';

const patientSearchAppointmentWorkspace = 'patient-search-appointments-form-workspace';

interface ScheduleAppointmentActionProps {
  closeMenu?: () => void;
  patientUuid: string;
  selectPatientAction?: (patientUuid: string) => void;
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

export const ScheduleAppointmentPrimaryAction: React.FC<
  Pick<ScheduleAppointmentActionProps, 'patientUuid' | 'selectPatientAction'>
> = ({ patientUuid, selectPatientAction }) => {
  const { t } = useTranslation();
  const { user } = useSession();
  const canEditAppointments = userHasAccess(appointmentsEditPrivilege, user);

  const handleScheduleAppointment = useCallback(() => {
    if (selectPatientAction) {
      selectPatientAction(patientUuid);
      return;
    }

    void launchWorkspace2(patientSearchAppointmentWorkspace, {
      context: 'creating',
      patientUuid,
      workspaceTitle: t('createNewAppointment', 'Crear nueva cita'),
    });
  }, [patientUuid, selectPatientAction, t]);

  if (!canEditAppointments) {
    return null;
  }

  return (
    <Button kind="primary" onClick={handleScheduleAppointment}>
      {t('addAppointment', 'Agregar cita')}
    </Button>
  );
};
