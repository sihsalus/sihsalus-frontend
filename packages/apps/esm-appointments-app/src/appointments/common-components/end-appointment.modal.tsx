import { Button, InlineLoading, InlineNotification, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import {
  getUserFacingErrorMessage,
  showSnackbar,
  updateVisit,
  useConfig,
  useVisit,
  type Visit,
} from '@openmrs/esm-framework';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../../config-schema';
import { useMutateAppointments } from '../../form/appointments-form.resource';
import {
  APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING,
  changeAppointmentStatus,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { AppointmentStatus } from '../../types';

import {
  type ActiveQueueEntrySummary,
  endActiveQueueEntries,
  getActiveQueueEntriesForVisit,
  getActiveVisitsForPatient,
} from './batch-change-appointment-statuses.resources';

import styles from './end-appointment.scss';

const APPOINTMENT_CHECKOUT_STATUS_CONFLICT = 'APPOINTMENT_CHECKOUT_STATUS_CONFLICT';
const APPOINTMENT_VISIT_LINK_MISMATCH = 'APPOINTMENT_VISIT_LINK_MISMATCH';
const MULTIPLE_LINKED_VISITS = 'MULTIPLE_LINKED_VISITS';
const checkoutVisitRepresentation =
  'custom:(uuid,startDatetime,stopDatetime,encounters:(encounterDatetime),attributes:(uuid,value,attributeType:(uuid)))';

class AppointmentCheckoutError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppointmentCheckoutError';
  }
}

function getSafeStopDate(
  response: Awaited<ReturnType<typeof getActiveVisitsForPatient>>,
  visit: Visit,
  queueEntries: Array<ActiveQueueEntrySummary>,
) {
  const responseDate = response.headers?.get?.('Date');
  const parsedDate = responseDate ? new Date(responseDate) : null;
  const serverDate =
    parsedDate && !Number.isNaN(parsedDate.getTime()) ? new Date(parsedDate.getTime() + 999) : new Date();
  const relevantDatetimes = [
    visit.startDatetime,
    ...(visit.encounters ?? []).map((encounter) => encounter.encounterDatetime),
    ...queueEntries.map((entry) => entry.startedAt),
    ...queueEntries.map((entry) => entry.endedAt),
  ];

  return relevantDatetimes.reduce((latest, value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) && date > latest ? date : latest;
  }, serverDate);
}

function getLinkedAppointmentUuids(visit: Visit, attributeTypeUuid: string) {
  return [
    ...new Set(
      (visit.attributes ?? [])
        .filter((attribute) => attribute.attributeType?.uuid === attributeTypeUuid)
        .map((attribute) => String(attribute.value ?? '').trim())
        .filter(Boolean),
    ),
  ];
}

const terminalAppointmentStatuses = new Set<AppointmentStatus>([
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.MISSED,
]);

interface EndAppointmentModalProps {
  patientUuid: string;
  appointmentUuid: string;
  closeModal: () => void;
}

const EndAppointmentModal: React.FC<EndAppointmentModalProps> = ({ patientUuid, appointmentUuid, closeModal }) => {
  const { t } = useTranslation();
  const { appointmentVisitAttributeTypeUuid } = useConfig<ConfigObject>();
  const { activeVisit, mutate } = useVisit(patientUuid);
  const { mutateAppointments } = useMutateAppointments();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userFacingFailureMessage, setUserFacingFailureMessage] = useState<string | null>(null);
  const visitClosureCompleted = useRef(false);
  const didCloseVisit = useRef(false);
  const keptSharedVisitOpen = useRef(false);
  const sharedVisitUuid = useRef<string | null>(null);
  const appointmentCompletionCompleted = useRef(false);
  const closedVisitPendingQueueReconciliationUuid = useRef<string | null>(null);

  const validateAppointmentStatus = useCallback(async () => {
    const currentStatus = await getAppointmentStatus(appointmentUuid);
    if (currentStatus !== AppointmentStatus.CHECKEDIN && currentStatus !== AppointmentStatus.COMPLETED) {
      throw new AppointmentCheckoutError(
        APPOINTMENT_CHECKOUT_STATUS_CONFLICT,
        'The appointment status no longer permits checkout.',
      );
    }

    return currentStatus;
  }, [appointmentUuid]);

  const fetchActiveVisits = useCallback(
    () => getActiveVisitsForPatient(patientUuid, undefined, checkoutVisitRepresentation, '100'),
    [patientUuid],
  );

  const reconcileQueuesForClosedVisit = useCallback(async (visitUuid: string) => {
    const queueEntriesResponse = await getActiveQueueEntriesForVisit(visitUuid);
    const activeQueueEntries = (queueEntriesResponse.data?.results ?? []).filter((entry) => !entry.endedAt);
    await endActiveQueueEntries(activeQueueEntries, new AbortController());
  }, []);

  const closeVisitAndQueues = useCallback(
    async (visitsResponse: Awaited<ReturnType<typeof getActiveVisitsForPatient>>, visitToClose: Visit) => {
      const abortController = new AbortController();
      const queueEntriesResponse = await getActiveQueueEntriesForVisit(visitToClose.uuid);
      const activeQueueEntries = (queueEntriesResponse.data?.results ?? []).filter((entry) => !entry.endedAt);

      try {
        await updateVisit(
          visitToClose.uuid,
          { stopDatetime: getSafeStopDate(visitsResponse, visitToClose, activeQueueEntries) },
          abortController,
        );
      } catch (error) {
        let visitWasClosed = false;
        try {
          const latestVisitsResponse = await fetchActiveVisits();
          visitWasClosed = !(latestVisitsResponse.data?.results ?? []).some(
            (visit) => visit.uuid === visitToClose.uuid && !visit.stopDatetime,
          );
        } catch {
          // Preserve the write error when the reconciliation read is unavailable.
        }

        if (!visitWasClosed) {
          throw error;
        }

        closedVisitPendingQueueReconciliationUuid.current = visitToClose.uuid;
        await reconcileQueuesForClosedVisit(visitToClose.uuid);
        closedVisitPendingQueueReconciliationUuid.current = null;
      }

      didCloseVisit.current = true;
      visitClosureCompleted.current = true;
      keptSharedVisitOpen.current = false;
      mutate();
    },
    [fetchActiveVisits, mutate, reconcileQueuesForClosedVisit],
  );

  const reconcileSharedVisitAfterCompletion = useCallback(async () => {
    const visitUuid = sharedVisitUuid.current;
    if (!visitUuid || !appointmentVisitAttributeTypeUuid) {
      return;
    }

    const visitsResponse = await fetchActiveVisits();
    const activeVisits = (visitsResponse.data?.results ?? []).filter((visit) => !visit.stopDatetime);
    const visitToReconcile = activeVisits.find((visit) => visit.uuid === visitUuid);

    if (!visitToReconcile) {
      closedVisitPendingQueueReconciliationUuid.current = visitUuid;
      await reconcileQueuesForClosedVisit(visitUuid);
      closedVisitPendingQueueReconciliationUuid.current = null;
      didCloseVisit.current = true;
      visitClosureCompleted.current = true;
      keptSharedVisitOpen.current = false;
      mutate();
      return;
    }

    const linkedAppointmentUuids = getLinkedAppointmentUuids(visitToReconcile, appointmentVisitAttributeTypeUuid);
    if (!linkedAppointmentUuids.includes(appointmentUuid)) {
      throw new AppointmentCheckoutError(
        APPOINTMENT_VISIT_LINK_MISMATCH,
        'The shared visit is no longer linked to this appointment.',
      );
    }

    const linkedStatuses = await Promise.all(linkedAppointmentUuids.map((uuid) => getAppointmentStatus(uuid)));
    if (linkedStatuses.some((status) => !terminalAppointmentStatuses.has(status as AppointmentStatus))) {
      keptSharedVisitOpen.current = true;
      return;
    }

    await closeVisitAndQueues(visitsResponse, visitToReconcile);
  }, [
    appointmentUuid,
    appointmentVisitAttributeTypeUuid,
    closeVisitAndQueues,
    fetchActiveVisits,
    mutate,
    reconcileQueuesForClosedVisit,
  ]);

  const handleEndAppointment = useCallback(async () => {
    setIsSubmitting(true);
    setUserFacingFailureMessage(null);

    try {
      const initialStatus = await validateAppointmentStatus();
      appointmentCompletionCompleted.current = initialStatus === AppointmentStatus.COMPLETED;
      if (closedVisitPendingQueueReconciliationUuid.current) {
        await reconcileQueuesForClosedVisit(closedVisitPendingQueueReconciliationUuid.current);
        closedVisitPendingQueueReconciliationUuid.current = null;
        didCloseVisit.current = true;
        visitClosureCompleted.current = true;
        keptSharedVisitOpen.current = false;
        mutate();
      }
      const visitsResponse = await fetchActiveVisits();
      const activeVisits = (visitsResponse.data?.results ?? []).filter((visit) => !visit.stopDatetime);

      if (!visitClosureCompleted.current) {
        keptSharedVisitOpen.current = false;
        if (activeVisits.length && !appointmentVisitAttributeTypeUuid) {
          throw new AppointmentCheckoutError(
            APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING,
            'The appointment visit attribute type is not configured.',
          );
        }

        const linkedVisits = activeVisits.filter((visit) =>
          getLinkedAppointmentUuids(visit, appointmentVisitAttributeTypeUuid).includes(appointmentUuid),
        );
        if (activeVisits.length && linkedVisits.length === 0) {
          throw new AppointmentCheckoutError(
            APPOINTMENT_VISIT_LINK_MISMATCH,
            'No active visit is linked to this appointment.',
          );
        }
        if (linkedVisits.length > 1) {
          throw new AppointmentCheckoutError(
            MULTIPLE_LINKED_VISITS,
            'More than one active visit is linked to this appointment.',
          );
        }

        const visitToClose = linkedVisits[0];
        if (visitToClose) {
          const otherAppointmentUuids = getLinkedAppointmentUuids(
            visitToClose,
            appointmentVisitAttributeTypeUuid,
          ).filter((uuid) => uuid !== appointmentUuid);
          const otherStatuses = await Promise.all(otherAppointmentUuids.map((uuid) => getAppointmentStatus(uuid)));
          const hasOtherNonterminalAppointment = otherStatuses.some(
            (status) => !terminalAppointmentStatuses.has(status as AppointmentStatus),
          );

          if (hasOtherNonterminalAppointment) {
            keptSharedVisitOpen.current = true;
            sharedVisitUuid.current = visitToClose.uuid;
          } else {
            await closeVisitAndQueues(visitsResponse, visitToClose);
          }
        }
      }

      // The operator may keep the modal open while another user changes the appointment.
      // Re-read immediately before the final state transition.
      const currentStatus = await validateAppointmentStatus();
      if (currentStatus !== AppointmentStatus.COMPLETED) {
        await changeAppointmentStatus(AppointmentStatus.COMPLETED, appointmentUuid);
      }
      appointmentCompletionCompleted.current = true;

      if (keptSharedVisitOpen.current && !visitClosureCompleted.current) {
        await reconcileSharedVisitAfterCompletion();
      }

      mutateAppointments?.();
      showSnackbar({
        title: t('appointmentEnded', 'Atención finalizada'),
        subtitle: didCloseVisit.current
          ? t(
              'appointmentEndedAndVisitClosedSuccessfully',
              'La consulta fue cerrada y la cita fue marcada como completada.',
            )
          : keptSharedVisitOpen.current
            ? t(
                'appointmentEndedSharedVisitKeptOpen',
                'La cita fue completada. La consulta y la cola permanecen activas porque tienen otra cita vinculada en curso.',
              )
            : t('appointmentEndedSuccessfully', 'La cita fue marcada como completada.'),
        isLowContrast: true,
        kind: 'success',
      });
      closeModal();
    } catch (error) {
      const visitAlreadyClosed = visitClosureCompleted.current && didCloseVisit.current;
      setUserFacingFailureMessage(
        getUserFacingErrorMessage(
          error,
          visitAlreadyClosed
            ? t(
                'appointmentCompletionPendingAfterVisitClosed',
                'La consulta ya fue cerrada, pero no se pudo completar la cita. Pulse Reintentar; la consulta no se cerrará nuevamente.',
              )
            : appointmentCompletionCompleted.current
              ? t(
                  'appointmentVisitClosurePendingAfterCompletion',
                  'La cita ya fue completada, pero no se pudo cerrar la consulta o la cola. Pulse Reintentar para regularizar el cierre.',
                )
              : t(
                  'appointmentCheckoutFailedSafely',
                  'No se pudo finalizar la atención. La cita no fue completada. Revise el estado e intente nuevamente.',
                ),
          {
            codeMessages: {
              [APPOINTMENT_CHECKOUT_STATUS_CONFLICT]: t(
                'appointmentCheckoutStatusChanged',
                'El estado de la cita cambió y ya no permite finalizar la atención. Actualice la lista.',
              ),
              [APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING]: t(
                'appointmentVisitLinkNotConfigured',
                'No está configurado el vínculo entre cita y consulta. Contacte al administrador antes de continuar.',
              ),
              [APPOINTMENT_VISIT_LINK_MISMATCH]: t(
                'appointmentVisitLinkMismatch',
                'La consulta activa no está vinculada a esta cita. Regularice el vínculo antes de finalizar la atención.',
              ),
              [MULTIPLE_LINKED_VISITS]: t(
                'multipleLinkedVisitsPreventCheckout',
                'La cita está vinculada a más de una consulta activa. Regularice las consultas antes de finalizar la atención.',
              ),
            },
            logContext: 'Check out appointment',
          },
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    appointmentUuid,
    appointmentVisitAttributeTypeUuid,
    closeVisitAndQueues,
    closeModal,
    fetchActiveVisits,
    mutate,
    mutateAppointments,
    reconcileSharedVisitAfterCompletion,
    reconcileQueuesForClosedVisit,
    t,
    validateAppointmentStatus,
  ]);

  return (
    <>
      <ModalHeader
        className={styles.modalHeader}
        closeModal={closeModal}
        title={t('endAppointmentConfirmation', 'Are you sure you want to check the patient out for this appointment?')}
      />
      <ModalBody>
        <p>
          {activeVisit
            ? t(
                'endAppointmentAndVisitConfirmationMessage',
                'Checking the patient out will mark the appointment as complete and close out the active visit for this patient.',
              )
            : t('endAppointmentConfirmationMessage', 'Checking the patient out will mark the appointment as complete.')}
        </p>
        {userFacingFailureMessage ? (
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            role="alert"
            title={t('appointmentEndError', 'No se pudo finalizar la atención')}
            subtitle={userFacingFailureMessage}
          />
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button disabled={isSubmitting} kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button disabled={isSubmitting} kind="danger" onClick={handleEndAppointment}>
          {isSubmitting ? (
            <InlineLoading description={t('endingAppointment', 'Finalizando atención') + '...'} />
          ) : userFacingFailureMessage ? (
            t('retryCheckout', 'Reintentar')
          ) : (
            t('checkOut', 'Check out')
          )}
        </Button>
      </ModalFooter>
    </>
  );
};

export default EndAppointmentModal;
