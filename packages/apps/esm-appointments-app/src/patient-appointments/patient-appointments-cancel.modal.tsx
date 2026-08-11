import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { formatDatetime, getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutateAppointments } from '../form/appointments-form.resource';
import { canTransition } from '../helpers';
import { type Appointment, AppointmentStatus } from '../types';
import { changeAppointmentStatus, getAppointmentStatus } from './patient-appointments.resource';
import styles from './patient-appointments-cancel.scss';

const APPOINTMENT_CANCELLATION_STATUS_CONFLICT = 'APPOINTMENT_CANCELLATION_STATUS_CONFLICT';

interface CancelAppointmentModalProps {
  closeCancelModal: () => void;
  appointmentUuid: string;
  appointment?: Appointment;
}

const CancelAppointmentModal: React.FC<CancelAppointmentModalProps> = ({
  closeCancelModal,
  appointmentUuid,
  appointment,
}) => {
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
        {appointment ? (
          <dl className={styles.appointmentSummary}>
            <div>
              <dt>{t('patient', 'Paciente')}</dt>
              <dd>{appointment.patient?.name}</dd>
            </div>
            <div>
              <dt>{t('service', 'Servicio')}</dt>
              <dd>{appointment.service?.name}</dd>
            </div>
            <div>
              <dt>{t('dateAndTime', 'Fecha y hora')}</dt>
              <dd>{appointment.startDateTime ? formatDatetime(new Date(appointment.startDateTime)) : '—'}</dd>
            </div>
            <div>
              <dt>{t('upss', 'UPSS')}</dt>
              <dd>{appointment.location?.name ?? '—'}</dd>
            </div>
          </dl>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeCancelModal}>
          {t('keepAppointment', 'Conservar cita')}
        </Button>
        <Button kind="danger" onClick={handleCancelAppointment} disabled={isSubmitting}>
          {t('cancelAppointment', 'Cancel appointment')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default CancelAppointmentModal;
