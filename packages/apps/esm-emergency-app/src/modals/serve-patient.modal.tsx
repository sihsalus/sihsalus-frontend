/**
 * Modal to confirm serving (attending) a patient from the queue.
 *
 * Changes the queue entry status to "In Service" and then:
 * - If in Triage Queue → opens the triage form workspace
 * - If in Attention Queue → opens the attention form workspace
 */

import { Button, InlineNotification, ModalBody, ModalFooter, ModalHeader, Tag } from '@carbon/react';
import { getUserFacingErrorMessage, launchWorkspace, launchWorkspace2, showSnackbar } from '@openmrs/esm-framework';
import { getPreferredIdentifier } from '@openmrs/esm-utils';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { WORKSPACES } from '../constants';
import { useTriageVitalsSavedHandler } from '../emergency-workflow/hooks/useTriageVitalsSavedHandler';
import { useEmergencyConfig } from '../hooks/usePriorityConfig';
import {
  assertEmergencyQueueEntryActive,
  type EmergencyQueueEntry,
  updateEmergencyQueueEntry,
} from '../resources/emergency.resource';
import {
  clearServePatientCheckpoint,
  loadServePatientCheckpoint,
  saveServePatientCheckpoint,
  type ServePatientReconciliationCheckpoint,
} from './serve-patient-reconciliation-checkpoint';
import styles from './serve-patient.modal.scss';

interface ServePatientModalProps {
  queueEntry: EmergencyQueueEntry;
  closeModal: () => void;
}

const ServePatientModal: React.FC<ServePatientModalProps> = ({ queueEntry, closeModal }) => {
  const { t } = useTranslation();
  const { queueStatuses, emergencyTriageQueueUuid, emergencyLocationUuid, triageEncounter } = useEmergencyConfig();
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingReconciliation, setPendingReconciliation] = useState<ServePatientReconciliationCheckpoint | null>(() =>
    loadServePatientCheckpoint(queueEntry, queueStatuses.inService),
  );
  const [checkpointIsDurable, setCheckpointIsDurable] = useState(true);
  const serveInFlightRef = useRef(false);
  const workspaceWasLaunchedRef = useRef(false);
  const handleTriageVitalsSaved = useTriageVitalsSavedHandler(queueEntry);

  const isTriageQueue = queueEntry.queue?.uuid === emergencyTriageQueueUuid;

  const patientName = queueEntry.patient.person?.display || queueEntry.patient.display;
  const gender = queueEntry.patient.person?.gender || '';
  const age = queueEntry.patient.person?.age;
  const identifiers = queueEntry.patient.identifiers || [];
  const preferredIdentifier = getPreferredIdentifier(identifiers);
  const otherIdentifiers = identifiers.filter((id) => id.uuid !== preferredIdentifier?.uuid);

  useEffect(() => {
    if (!pendingReconciliation) {
      return;
    }
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    globalThis.addEventListener('beforeunload', warnBeforeLeaving);
    return () => globalThis.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [pendingReconciliation]);

  const completeServe = useCallback(() => {
    if (workspaceWasLaunchedRef.current) {
      return;
    }
    workspaceWasLaunchedRef.current = true;
    clearServePatientCheckpoint(queueEntry.uuid);
    setPendingReconciliation(null);

    const updatedQueueEntry: EmergencyQueueEntry = {
      ...queueEntry,
      status: { ...queueEntry.status, uuid: queueStatuses.inService },
    };

    showSnackbar({
      isLowContrast: true,
      title: t('patientServed', 'Paciente en atención'),
      kind: 'success',
      subtitle: t('patientServedSuccessfully', 'El paciente ha sido marcado como en atención'),
    });
    mutate((key) => typeof key === 'string' && key.includes('/queue-entry'));
    closeModal();

    if (isTriageQueue) {
      launchWorkspace2(
        WORKSPACES.TRIAGE_VITALS_FORM,
        {
          encounterTypeUuid: triageEncounter.encounterTypeUuid,
          locationUuid: emergencyLocationUuid,
          onVitalsSaved: handleTriageVitalsSaved,
          profile: 'emergency-triage',
        },
        null,
        { patientUuid: queueEntry.patient.uuid },
      );
    } else {
      launchWorkspace(WORKSPACES.ATTENTION_FORM, { queueEntry: updatedQueueEntry });
    }
  }, [
    closeModal,
    handleTriageVitalsSaved,
    isTriageQueue,
    emergencyLocationUuid,
    mutate,
    queueEntry,
    queueStatuses.inService,
    t,
    triageEncounter.encounterTypeUuid,
  ]);

  const handleServe = useCallback(async () => {
    if (serveInFlightRef.current || workspaceWasLaunchedRef.current) {
      return;
    }

    serveInFlightRef.current = true;
    setIsSubmitting(true);
    let errorToReport: unknown;

    try {
      const visitUuid = queueEntry.visit?.uuid;
      if (!visitUuid) {
        throw new Error('The queue entry does not have a visit to reconcile.');
      }
      const originalContext = {
        patientUuid: queueEntry.patient.uuid,
        visitUuid,
        queueUuid: queueEntry.queue.uuid,
        statusUuid: queueEntry.status.uuid,
      };
      const targetContext = { ...originalContext, statusUuid: queueStatuses.inService };

      if (!pendingReconciliation) {
        await assertEmergencyQueueEntryActive(queueEntry.uuid, originalContext);
        const checkpoint: ServePatientReconciliationCheckpoint = {
          version: 1,
          queueEntryUuid: queueEntry.uuid,
          patientUuid: queueEntry.patient.uuid,
          visitUuid,
          queueUuid: queueEntry.queue.uuid,
          targetStatusUuid: queueStatuses.inService,
        };
        setPendingReconciliation(checkpoint);
        setCheckpointIsDurable(saveServePatientCheckpoint(checkpoint));

        try {
          const response = await updateEmergencyQueueEntry(queueEntry.uuid, {
            statusUuid: queueStatuses.inService,
          });
          if (!(response.status >= 200 && response.status < 300)) {
            errorToReport = Object.assign(new Error('The queue status update returned an unsuccessful response.'), {
              status: response.status,
            });
          }
        } catch (error: unknown) {
          errorToReport = error;
        }
      }

      try {
        await assertEmergencyQueueEntryActive(queueEntry.uuid, targetContext);
      } catch (verificationError) {
        if (isDefinitiveQueueStatusUpdateRejection(errorToReport)) {
          try {
            await assertEmergencyQueueEntryActive(queueEntry.uuid, originalContext);
            clearServePatientCheckpoint(queueEntry.uuid);
            setPendingReconciliation(null);
            setCheckpointIsDurable(true);
          } catch {
            // The write remains ambiguous if the prior state cannot also be verified.
          }
        }
        throw errorToReport ?? verificationError;
      }

      completeServe();
    } catch (error: unknown) {
      showSnackbar({
        title: t('errorServingPatient', 'Error al atender paciente'),
        kind: 'error',
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'servePatientFailureSubtitle',
            'No se pudo confirmar que el paciente pasó a atención. Verifique su estado en la cola antes de intentarlo nuevamente.',
          ),
          { logContext: 'Serve emergency patient' },
        ),
      });
    } finally {
      serveInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [completeServe, pendingReconciliation, queueEntry, queueStatuses.inService, t]);

  const closeIsBlocked = isSubmitting || Boolean(pendingReconciliation && !checkpointIsDurable);

  return (
    <div>
      <ModalHeader closeModal={() => !closeIsBlocked && closeModal()} title={t('servePatient', 'Atender paciente')} />
      <ModalBody className={styles.modalBody}>
        {pendingReconciliation ? (
          <InlineNotification
            hideCloseButton
            kind="warning"
            lowContrast
            title={t('servePatientReconciliationTitle', 'Atención pendiente de verificación')}
            subtitle={t(
              'servePatientFailureSubtitle',
              'No se pudo confirmar que el paciente pasó a atención. Verifique su estado en la cola antes de intentarlo nuevamente.',
            )}
          />
        ) : null}
        {!checkpointIsDurable && pendingReconciliation ? (
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            title={t('servePatientCheckpointUnavailableTitle', 'No cierre ni recargue esta ventana')}
            subtitle={t(
              'servePatientCheckpointUnavailableSubtitle',
              'El navegador no pudo conservar la transición pendiente. Verifique el estado antes de salir y no repita la acción.',
            )}
          />
        ) : null}
        <section className={styles.modalBody}>
          <p className={styles.p}>
            {t('patientName', 'Nombre del paciente')}: &nbsp; {patientName}
          </p>
          {preferredIdentifier && (
            <p className={styles.p}>
              {preferredIdentifier.identifierType?.display}: &nbsp; <strong>{preferredIdentifier.identifier}</strong>
            </p>
          )}
          {otherIdentifiers.map((identifier) => (
            <p key={identifier.uuid} className={styles.p}>
              {identifier.identifierType?.display}: &nbsp; {identifier.identifier}
            </p>
          ))}
          <p className={styles.p}>
            {t('patientGender', 'Sexo')}: &nbsp; {gender}
          </p>
          <p className={styles.p}>
            {t('patientAge', 'Edad')}: &nbsp; {age}
          </p>
          <div>
            {identifiers.map((identifier) => (
              <Tag key={identifier.uuid}>{identifier.display}</Tag>
            ))}
          </div>
        </section>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal} disabled={closeIsBlocked}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button onClick={handleServe} disabled={isSubmitting}>
          {pendingReconciliation ? t('reconcileServePatient', 'Verificar estado y continuar') : t('serve', 'Atender')}
        </Button>
      </ModalFooter>
    </div>
  );
};

function isDefinitiveQueueStatusUpdateRejection(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { status?: unknown; response?: { status?: unknown } };
  const status = candidate.status ?? candidate.response?.status;
  return typeof status === 'number' && [400, 401, 403, 404, 405, 415, 422].includes(status);
}

export default ServePatientModal;
