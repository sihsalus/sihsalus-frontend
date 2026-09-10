/**
 * Modal to confirm serving (attending) a patient from the queue.
 *
 * Changes the queue entry status to "In Service" and then:
 * - If in Triage Queue → opens the triage form workspace
 * - If in Attention Queue → opens the attention form workspace
 */

import { Button, InlineNotification, ModalBody, ModalFooter, ModalHeader, Tag } from '@carbon/react';
import {
  age,
  getUserFacingErrorMessage,
  launchWorkspace,
  launchWorkspace2,
  showSnackbar,
} from '@openmrs/esm-framework';
import { getPreferredIdentifier } from '@openmrs/esm-utils';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WORKSPACES } from '../constants';
import { useTriageVitalsSavedHandler } from '../emergency-workflow/hooks/useTriageVitalsSavedHandler';
import { useEmergencyConfig } from '../hooks/usePriorityConfig';
import {
  type EmergencyQueueEntry,
  updateEmergencyQueueEntry,
  useMutateEmergencyQueueEntries,
} from '../resources/emergency.resource';
import styles from './serve-patient.modal.scss';

interface ServePatientModalProps {
  queueEntry: EmergencyQueueEntry;
  closeModal: () => void;
}

const ServePatientModal: React.FC<ServePatientModalProps> = ({ queueEntry, closeModal }) => {
  const { t } = useTranslation();
  const { queueStatuses, emergencyTriageQueueUuid, emergencyLocationUuid, triageEncounter } = useEmergencyConfig();
  const { mutateEmergencyQueueEntries } = useMutateEmergencyQueueEntries();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openingFailed, setOpeningFailed] = useState(false);
  const pendingRef = useRef(false);
  const statusUpdatedFor = useRef<string>();
  const activeEntry = useRef<string>(queueEntry.uuid);
  useEffect(() => {
    activeEntry.current = queueEntry.uuid;
    setOpeningFailed(false);
    return () => {
      activeEntry.current = undefined;
    };
  }, [queueEntry.uuid]);
  const handleTriageVitalsSaved = useTriageVitalsSavedHandler(queueEntry);

  const isTriageQueue = queueEntry.queue?.uuid === emergencyTriageQueueUuid;

  const patientName = queueEntry.patient.person?.display || queueEntry.patient.display;
  const gender = queueEntry.patient.person?.gender || '';
  const patientAge = queueEntry.patient.person?.birthdate ? age(queueEntry.patient.person.birthdate) : null;
  const identifiers = queueEntry.patient.identifiers || [];
  const preferredIdentifier = getPreferredIdentifier(identifiers);
  const otherIdentifiers = identifiers.filter((id) => id.uuid !== preferredIdentifier?.uuid);

  const handleServe = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsSubmitting(true);
    setOpeningFailed(false);
    try {
      if (statusUpdatedFor.current !== queueEntry.uuid && queueEntry.status?.uuid !== queueStatuses.inService) {
        try {
          const response = await updateEmergencyQueueEntry(queueEntry.uuid, { statusUuid: queueStatuses.inService });
          // null means the resource reconciled the update as already applied.
          if (
            response !== null &&
            (!response || !Number.isFinite(response.status) || response.status < 200 || response.status >= 300)
          ) {
            throw new Error('Queue update was not confirmed.');
          }
          statusUpdatedFor.current = queueEntry.uuid;
        } catch (error) {
          if (activeEntry.current === queueEntry.uuid) {
            showSnackbar({
              title: t('errorServingPatient', 'Error al atender paciente'),
              kind: 'error',
              subtitle: getUserFacingErrorMessage(
                error,
                t('errorServingPatientMessage', 'No se pudo iniciar la atención. Intente nuevamente.'),
                { logContext: 'Serve emergency patient' },
              ),
            });
          }
          return;
        }
        // Refresh failure is independent of the confirmed update and workspace opening.
        void Promise.resolve()
          .then(() => mutateEmergencyQueueEntries())
          .catch(() => {
            if (activeEntry.current === queueEntry.uuid) {
              showSnackbar({
                kind: 'warning',
                title: t('emergencyQueueRefreshFailed', 'No se pudo actualizar la vista de la cola'),
                subtitle: t(
                  'emergencyQueueRefreshFailedMessage',
                  'El cambio se guardó. Actualice la cola para ver su estado actual.',
                ),
              });
            }
          });
      }
      if (activeEntry.current !== queueEntry.uuid) return;
      try {
        if (isTriageQueue) {
          const opened = await launchWorkspace2(
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
          if (!opened) throw new Error('Workspace opening was not completed.');
        } else {
          // The legacy launcher returns void; synchronous launch failures are recoverable here.
          launchWorkspace(WORKSPACES.ATTENTION_FORM, { queueEntry });
        }
      } catch {
        if (activeEntry.current === queueEntry.uuid) setOpeningFailed(true);
        return;
      }
      if (activeEntry.current !== queueEntry.uuid) return;
      showSnackbar({
        isLowContrast: true,
        title: t('patientServed', 'Paciente en atención'),
        kind: 'success',
        subtitle: t('patientServedSuccessfully', 'El paciente ha sido marcado como en atención'),
      });
      closeModal();
    } finally {
      pendingRef.current = false;
      if (activeEntry.current) setIsSubmitting(false);
    }
  }, [
    queueEntry,
    queueStatuses.inService,
    isTriageQueue,
    triageEncounter.encounterTypeUuid,
    emergencyLocationUuid,
    handleTriageVitalsSaved,
    mutateEmergencyQueueEntries,
    closeModal,
    t,
  ]);

  const closeWhenIdle = () => {
    if (!pendingRef.current) closeModal();
  };

  return (
    <div>
      <ModalHeader closeModal={closeWhenIdle} title={t('servePatient', 'Atender paciente')} />
      <ModalBody className={styles.modalBody}>
        {openingFailed && (
          <InlineNotification
            kind="warning"
            hideCloseButton
            title={t('emergencyWorkspaceOpeningFailed', 'No se pudo abrir el formulario')}
            subtitle={t(
              'emergencyWorkspaceOpeningFailedMessage',
              'El paciente permanece en atención. Reintente abrir el formulario para continuar.',
            )}
          />
        )}
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
            {t('patientAge', 'Edad')}: &nbsp; {patientAge ?? '-'}
          </p>
          <div>
            {identifiers.map((identifier) => (
              <Tag key={identifier.uuid}>{identifier.display}</Tag>
            ))}
          </div>
        </section>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeWhenIdle} disabled={isSubmitting}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button onClick={handleServe} disabled={isSubmitting}>
          {openingFailed ? t('emergencyWorkspaceRetry', 'Reintentar abrir formulario') : t('serve', 'Atender')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default ServePatientModal;
