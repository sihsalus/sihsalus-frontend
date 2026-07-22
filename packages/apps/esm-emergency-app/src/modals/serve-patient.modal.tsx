/**
 * Modal to confirm serving (attending) a patient from the queue.
 *
 * Changes the queue entry status to "In Service" and then:
 * - If in Triage Queue → opens the triage form workspace
 * - If in Attention Queue → opens the attention form workspace
 */

import { Button, ModalBody, ModalFooter, ModalHeader, Tag } from '@carbon/react';
import { age, launchWorkspace, launchWorkspace2, showSnackbar } from '@openmrs/esm-framework';
import { getPreferredIdentifier } from '@openmrs/esm-utils';
import React, { useCallback, useState } from 'react';
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
  const handleTriageVitalsSaved = useTriageVitalsSavedHandler(queueEntry);

  const isTriageQueue = queueEntry.queue?.uuid === emergencyTriageQueueUuid;

  const patientName = queueEntry.patient.person?.display || queueEntry.patient.display;
  const gender = queueEntry.patient.person?.gender || '';
  const patientAge = queueEntry.patient.person?.birthdate ? age(queueEntry.patient.person.birthdate) : null;
  const identifiers = queueEntry.patient.identifiers || [];
  const preferredIdentifier = getPreferredIdentifier(identifiers);
  const otherIdentifiers = identifiers.filter((id) => id.uuid !== preferredIdentifier?.uuid);

  const handleServe = useCallback(() => {
    setIsSubmitting(true);
    updateEmergencyQueueEntry(queueEntry.uuid, {
      statusUuid: queueStatuses.inService,
    })
      .then((response) => {
        // A null response means the update was reconciled as already applied
        if (response == null || (response.status >= 200 && response.status < 300)) {
          showSnackbar({
            isLowContrast: true,
            title: t('patientServed', 'Paciente en atención'),
            kind: 'success',
            subtitle: t('patientServedSuccessfully', 'El paciente ha sido marcado como en atención'),
          });
          void mutateEmergencyQueueEntries();
          closeModal();

          if (isTriageQueue) {
            // In triage queue: capture vitals with the shared vitals workspace
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
            // In attention queue: open attention form workspace directly
            launchWorkspace(WORKSPACES.ATTENTION_FORM, { queueEntry });
          }
        }
      })
      .catch((error) => {
        showSnackbar({
          title: t('errorServingPatient', 'Error al atender paciente'),
          kind: 'error',
          subtitle: error?.message,
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [
    queueEntry,
    queueStatuses.inService,
    isTriageQueue,
    emergencyLocationUuid,
    mutateEmergencyQueueEntries,
    closeModal,
    t,
    triageEncounter.encounterTypeUuid,
    handleTriageVitalsSaved,
  ]);

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={t('servePatient', 'Atender paciente')} />
      <ModalBody className={styles.modalBody}>
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
        <Button kind="secondary" onClick={closeModal} disabled={isSubmitting}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button onClick={handleServe} disabled={isSubmitting}>
          {t('serve', 'Atender')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default ServePatientModal;
