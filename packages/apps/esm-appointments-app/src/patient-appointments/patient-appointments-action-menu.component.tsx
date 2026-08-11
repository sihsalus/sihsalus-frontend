import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, showModal, useLayoutType, userHasAccess, useSession } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  appointmentsEditPrivileges,
  chartAppointmentsCheckoutPrivileges,
  chartAppointmentsEditPrivileges,
} from '../constants';
import { isAppointmentEditable } from '../helpers';
import PatientAppointmentContext, { PatientAppointmentContextTypes } from '../hooks/patientAppointmentContext';

import { type Appointment, AppointmentStatus } from '../types';

import styles from './patient-appointments-action-menu.scss';

interface appointmentsActionMenuProps {
  appointment: Appointment;
  patientUuid: string;
}

export const PatientAppointmentsActionMenu = ({ appointment, patientUuid }: appointmentsActionMenuProps) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const patientAppointmentContext = React.useContext(PatientAppointmentContext);
  const isPatientChart = patientAppointmentContext === PatientAppointmentContextTypes.PATIENT_CHART;
  const canEdit = userHasAccess(
    isPatientChart ? chartAppointmentsEditPrivileges : appointmentsEditPrivileges,
    session?.user,
  );
  const canFinalizeCare =
    isPatientChart &&
    appointment.status === AppointmentStatus.CHECKEDIN &&
    userHasAccess(chartAppointmentsCheckoutPrivileges, session?.user);
  const canEditAppointment = canEdit && isAppointmentEditable(appointment.status);

  if (!canEditAppointment && !canFinalizeCare) {
    return null;
  }

  const handleLaunchEditAppointmentForm = () => {
    const workspaceProps = {
      patientUuid,
      appointment,
      context: 'editing',
      workspaceTitle: t('editAppointment', 'Edit appointment'),
    };

    if (isPatientChart) {
      launchPatientWorkspace('patient-chart-appointments-form-workspace', workspaceProps);
    } else {
      launchWorkspace2('appointments-form-workspace', workspaceProps);
    }
  };

  const handleLaunchCancelAppointmentModal = () => {
    const dispose = showModal(isPatientChart ? 'patient-chart-cancel-appointment-modal' : 'cancel-appointment-modal', {
      appointment,
      appointmentUuid: appointment.uuid,
      closeCancelModal: () => dispose(),
    });
  };

  const handleFinalizeCare = () => {
    const dispose = showModal('patient-chart-end-appointment-modal', {
      closeModal: () => dispose(),
      patientUuid,
      appointmentUuid: appointment.uuid,
    });
  };

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        aria-label={t('actions', 'Actions')}
        iconDescription={t('actions', 'Actions')}
        size={isTablet ? 'lg' : 'sm'}
        flipped
        align="left"
      >
        {canEditAppointment ? (
          <>
            <OverflowMenuItem
              className={styles.menuItem}
              id="editAppointment"
              itemText={t('edit', 'Edit')}
              onClick={handleLaunchEditAppointmentForm}
            />
            <OverflowMenuItem
              className={styles.menuItem}
              hasDivider
              id="cancelAppointment"
              isDelete={true}
              itemText={t('cancel', 'Cancel')}
              onClick={handleLaunchCancelAppointmentModal}
            />
          </>
        ) : null}
        {canFinalizeCare ? (
          <OverflowMenuItem
            className={styles.menuItem}
            id="finalizeCare"
            isDelete
            itemText={t('finishCare', 'Finish care')}
            onClick={handleFinalizeCare}
          />
        ) : null}
      </OverflowMenu>
    </Layer>
  );
};
