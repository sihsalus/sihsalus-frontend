import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeAppointmentStatus, usePatientAppointments } from './patient-appointments.resource';
import styles from './patient-appointments-cancel.scss';

interface PatientCancelAppointmentModalProps {
  closeCancelModal: () => void;
  appointmentUuid: string;
  patientUuid: string;
}

const PatientCancelAppointmentModal: React.FC<PatientCancelAppointmentModalProps> = ({
  closeCancelModal,
  appointmentUuid,
  patientUuid,
}) => {
  const { t } = useTranslation();
  const startDate = useMemo(() => new Date().toUTCString(), []);
  const ac = useMemo(() => new AbortController(), []);
  useEffect(() => () => ac.abort(), [ac]);
  const { mutate } = usePatientAppointments(patientUuid, startDate, ac);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancel = async () => {
    setIsSubmitting(true);

    changeAppointmentStatus('Cancelled', appointmentUuid)
      .then(({ status }) => {
        if (status === 200) {
          mutate();
          closeCancelModal();
          showSnackbar({
            isLowContrast: true,
            kind: 'success',
            subtitle: t('appointmentCancelledSuccessfully', 'La cita se canceló correctamente'),
            title: t('appointmentCancelled', 'Cita cancelada'),
          });
          return;
        }

        // Anything other than 200 leaves the appointment as it was; say so instead
        // of leaving the modal open with no feedback.
        showSnackbar({
          title: t('appointmentCancelError', 'Error al cancelar la cita'),
          kind: 'error',
          isLowContrast: true,
          subtitle: t('appointmentCancelUnexpectedStatus', 'El servidor respondió con el estado {{status}}.', {
            status,
          }),
        });
      })
      .catch((err) => {
        showSnackbar({
          title: t('appointmentCancelError', 'Error al cancelar la cita'),
          kind: 'error',
          isLowContrast: true,
          subtitle: err?.message,
        });
      })
      // Re-enable the button on every failure path; otherwise the clinician has to
      // close and reopen the modal to retry.
      .finally(() => setIsSubmitting(false));
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
        <Button kind="danger" onClick={handleCancel} disabled={isSubmitting}>
          {t('cancelAppointment', 'Cancel appointment')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default PatientCancelAppointmentModal;
