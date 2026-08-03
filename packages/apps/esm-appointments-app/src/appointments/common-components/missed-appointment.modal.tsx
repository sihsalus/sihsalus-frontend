import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutateAppointments } from '../../form/appointments-form.resource';
import { canTransition } from '../../helpers';
import {
  changeAppointmentStatus,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { AppointmentStatus } from '../../types';
import styles from './missed-appointment.scss';

const APPOINTMENT_MISSED_STATUS_CONFLICT = 'APPOINTMENT_MISSED_STATUS_CONFLICT';

interface MissedAppointmentModalProps {
  appointmentUuid: string;
  closeModal: () => void;
}

const MissedAppointmentModal: React.FC<MissedAppointmentModalProps> = ({ appointmentUuid, closeModal }) => {
  const { t } = useTranslation();
  const { mutateAppointments } = useMutateAppointments();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMarkAsMissed = async () => {
    setIsSubmitting(true);
    try {
      const currentStatus = await getAppointmentStatus(appointmentUuid);
      if (
        currentStatus !== AppointmentStatus.MISSED &&
        !canTransition(currentStatus as AppointmentStatus, AppointmentStatus.MISSED)
      ) {
        throw Object.assign(new Error('The appointment status no longer permits marking it as missed.'), {
          code: APPOINTMENT_MISSED_STATUS_CONFLICT,
        });
      }
      if (currentStatus !== AppointmentStatus.MISSED) {
        // server throws an exception if we make a call to change the appointment status to its current
        // status, so we just do nothing if that's the case
        await changeAppointmentStatus(AppointmentStatus.MISSED, appointmentUuid);
      }
      await mutateAppointments();
      closeModal();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        subtitle: t('appointmentMarkedAsMissedSuccessfully', 'La cita se marcó como perdida correctamente.'),
        title: t('appointmentMarkedAsMissed', 'Cita marcada como perdida'),
      });
    } catch (error) {
      showSnackbar({
        title: t('appointmentMarkAsMissedError', 'No se pudo marcar la cita como perdida'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'appointmentMarkAsMissedFailed',
            'No se pudo marcar la cita como perdida. Revise su estado e intente nuevamente.',
          ),
          {
            codeMessages: {
              [APPOINTMENT_MISSED_STATUS_CONFLICT]: t(
                'appointmentMarkAsMissedStatusChanged',
                'El estado de la cita cambió y ya no permite marcarla como perdida. Actualice la lista.',
              ),
            },
            logContext: 'Mark appointment as missed',
          },
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <ModalHeader
        className={styles.modalHeader}
        closeModal={closeModal}
        title={t('markAsMissed', 'Mark as missed')}
      />
      <ModalBody>
        <p>
          {t(
            'markAsMissedModalConfirmationText',
            'Are you sure you want to mark this appointment as missed? This action cannot be undone.',
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('discard', 'Discard')}
        </Button>
        <Button kind="danger" onClick={handleMarkAsMissed} disabled={isSubmitting}>
          {t('markAsMissed', 'Mark as missed')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default MissedAppointmentModal;
