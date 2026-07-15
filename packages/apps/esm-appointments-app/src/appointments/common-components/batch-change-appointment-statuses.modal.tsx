import {
  Button,
  Dropdown,
  InlineLoading,
  InlineNotification,
  Layer,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
} from '@carbon/react';
import {
  getCoreTranslation,
  getUserFacingErrorMessage,
  isDesktop,
  showSnackbar,
  useLayoutType,
} from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useMutateAppointments } from '../../form/appointments-form.resource';
import { canTransition, getAppointmentStatusLabel } from '../../helpers';
import {
  changeAppointmentStatus,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { type Appointment, AppointmentStatus } from '../../types';
import styles from './batch-change-appointment-statuses.scss';

const BATCH_APPOINTMENT_STATUS_CONFLICT = 'BATCH_APPOINTMENT_STATUS_CONFLICT';

interface BatchChangeAppointmentStatusesModalProps {
  appointments: Array<Appointment>;
  closeModal: () => void;
}

/**
 * This modal appears when selecting one or more rows in the appointments table and clicking "Change status",
 * to allow the user to change the status of multiple appointments.
 *
 * Note:
 * - The "CheckedIn" status is not available as selection as it requires filling out a form for each patient
 * - The "Completed" status is not available because checkout must close and reconcile each patient's visit first.
 */
const BatchChangeAppointmentStatusesModal: React.FC<BatchChangeAppointmentStatusesModalProps> = ({
  appointments,
  closeModal,
}) => {
  const { t } = useTranslation();
  const { mutateAppointments } = useMutateAppointments();
  const isTablet = !isDesktop(useLayoutType());
  const [status, setStatus] = useState<AppointmentStatus>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidAppointment =
    status != null ? appointments.find((a) => a.status !== status && !canTransition(a.status, status)) : undefined;

  const submit = useCallback(() => {
    if (!status) {
      return;
    }

    const updateAppointment = async (appointment: Appointment) => {
      const currentStatus = await getAppointmentStatus(appointment.uuid);
      // server throws an exception if we make a call to change the appointment status to its current
      // status, so we just do nothing if that's the case
      if (status === currentStatus) {
        return;
      }

      if (!canTransition(currentStatus as AppointmentStatus, status)) {
        throw Object.assign(new Error('Appointment status changed before the batch update.'), {
          code: BATCH_APPOINTMENT_STATUS_CONFLICT,
        });
      }

      return changeAppointmentStatus(status, appointment.uuid);
    };

    setIsSubmitting(true);
    Promise.allSettled(appointments.map(updateAppointment))
      .then((results) => {
        const hasFailedResults = results.some((result) => result.status === 'rejected');
        if (hasFailedResults) {
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              const appointment = appointments[index];

              showSnackbar({
                title: t('appointmentsUpdateFailed', 'No se pudo actualizar la cita'),
                kind: 'error',
                isLowContrast: false,
                subtitle: getUserFacingErrorMessage(
                  result.reason,
                  t(
                    'appointmentsUpdateFailedSafeMessage',
                    'No se pudo actualizar la cita de {{patient}}. Revise su estado e intente nuevamente.',
                    { patient: appointment.patient.name },
                  ),
                  {
                    codeMessages: {
                      [BATCH_APPOINTMENT_STATUS_CONFLICT]: t(
                        'appointmentBatchStatusChanged',
                        'El estado de la cita cambió. Actualice la lista antes de volver a intentar.',
                      ),
                    },
                    logContext: `Batch appointment status update: ${appointment.uuid}`,
                  },
                ),
              });
            }
          });
        } else {
          showSnackbar({
            title: t('appointmentsUpdated', 'Citas actualizadas'),
            subtitle: t('appointmentsUpdatedMessage', 'Las citas seleccionadas fueron actualizadas correctamente.'),
          });
        }
      })
      .finally(() => {
        setIsSubmitting(false);
        mutateAppointments();
        closeModal();
      });
  }, [status, appointments, closeModal, mutateAppointments, t]);

  return (
    <>
      <ModalHeader closeModal={closeModal} title={t('changeAppointmentsStatus', 'Change appointments status')} />
      <ModalBody className={styles.modalBody}>
        <Stack gap={5}>
          <p>{t('changeStatusForSelectedAppointments', 'Change the status for the following appointments.')}</p>
          <ul className={styles.appointmentsList}>
            {appointments.map((appointment) => (
              <li key={appointment.patient.uuid}>
                <Trans
                  i18nKey="appointmentDisplay"
                  values={{
                    patientName: appointment.patient.name,
                    serviceName: appointment.service.name,
                    currentStatus: getAppointmentStatusLabel(appointment.status, t),
                  }}
                >
                  <strong>{appointment.patient.name}</strong> - {appointment.service.name} -{' '}
                  {getAppointmentStatusLabel(appointment.status, t)}
                </Trans>
              </li>
            ))}
          </ul>
          <Layer>
            <Dropdown
              id={'statusDropdown'}
              className={styles.statusDropdown}
              label={t('selectStatus', 'Select status')}
              titleText={''}
              type="inline"
              items={[
                { id: AppointmentStatus.SCHEDULED, label: t('scheduled', 'Scheduled') },
                { id: AppointmentStatus.CANCELLED, label: t('cancelled', 'Cancelled') },
                { id: AppointmentStatus.MISSED, label: t('missed', 'Missed') },
              ]}
              itemToString={(item) => (item ? item.label : '')}
              onChange={(e) => setStatus(e.selectedItem.id)}
              size={isTablet ? 'lg' : 'sm'}
            />
          </Layer>
          {status && invalidAppointment && (
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title={t(
                'invalidAppointmentStatusChange',
                'Cannot transition appointment with status {{currentStatus}} to status {{newStatus}}',
                {
                  currentStatus: getAppointmentStatusLabel(invalidAppointment.status, t),
                  newStatus: getAppointmentStatusLabel(status, t),
                },
              )}
            />
          )}
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {getCoreTranslation('cancel')}
        </Button>
        <Button kind="primary" disabled={isSubmitting || invalidAppointment != null || status == null} onClick={submit}>
          {isSubmitting ? (
            <InlineLoading description={t('saving', 'Saving') + '...'} />
          ) : (
            <span>{t('saveAndClose', 'Save and close')}</span>
          )}
        </Button>
      </ModalFooter>
    </>
  );
};

export default BatchChangeAppointmentStatusesModal;
