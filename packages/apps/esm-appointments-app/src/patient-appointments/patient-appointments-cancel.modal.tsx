import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutateAppointments } from '../form/appointments-form.resource';
import { canTransition } from '../helpers';
import { AppointmentStatus } from '../types';
import { changeAppointmentStatus, getAppointmentStatus } from './patient-appointments.resource';
import styles from './patient-appointments-cancel.scss';

const APPOINTMENT_CANCELLATION_STATUS_CONFLICT = 'APPOINTMENT_CANCELLATION_STATUS_CONFLICT';

interface CancelAppointmentModalProps {
  closeCancelModal: () => void;
  appointmentUuid: string;
}

const CancelAppointmentModal: React.FC<CancelAppointmentModalProps> = ({ closeCancelModal, appointmentUuid }) => {
  const { t } = useTranslation();
  const { mutateAppointments } = useMutateAppointments();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancelAppointment = async () => {
    setIsSubmitting(true);
    try {
      const currentStatus = await getAppointmentStatus(appointmentUuid);
      if (
        currentStatus !== AppointmentStatus.CANCELLED &&
        !canTransition(currentStatus as AppointmentStatus, AppointmentStatus.CANCELLED)
      ) {
        throw Object.assign(new Error('The appointment status no longer permits cancellation.'), {
          code: APPOINTMENT_CANCELLATION_STATUS_CONFLICT,
        });
      }
      if (currentStatus !== AppointmentStatus.CANCELLED) {
        await changeAppointmentStatus(AppointmentStatus.CANCELLED, appointmentUuid);
      }
      await mutateAppointments();
      closeCancelModal();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        subtitle: t('appointmentCancelledSuccessfully', 'Cita cancelada correctamente.'),
        title: t('appointmentCancelled', 'Cita cancelada'),
      });
    } catch (error) {
      showSnackbar({
        title: t('appointmentCancelError', 'No se pudo cancelar la cita'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t('appointmentCancellationFailed', 'No se pudo cancelar la cita. Revise su estado e intente nuevamente.'),
          {
            codeMessages: {
              [APPOINTMENT_CANCELLATION_STATUS_CONFLICT]: t(
                'appointmentCancellationStatusChanged',
                'El estado de la cita cambió y ya no permite cancelarla. Actualice la lista.',
              ),
            },
            logContext: 'Cancel appointment',
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
        closeModal={closeCancelModal}
        title={t('cancelAppointment', 'Cancel appointment')}
      />
      <ModalBody>
        <p>{t('cancelAppointmentModalConfirmationText', 'Are you sure you want to cancel this appointment?')}</p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeCancelModal}>
          {t('discard', 'Discard')}
        </Button>
        <Button kind="danger" onClick={handleCancelAppointment} disabled={isSubmitting}>
          {t('cancelAppointment', 'Cancel appointment')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default CancelAppointmentModal;
