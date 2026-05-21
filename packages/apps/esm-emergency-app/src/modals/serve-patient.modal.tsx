/**
 * Modal to confirm serving (attending) a patient from the queue.
 *
 * Changes the queue entry status to "In Service" and then:
 * - If in Triage Queue → opens the triage form workspace
 * - If in Attention Queue → opens the attention form workspace
 */

import { Button, ModalBody, ModalFooter, ModalHeader, Tag } from '@carbon/react';
import { launchWorkspace, showSnackbar } from '@openmrs/esm-framework';
import { getPreferredIdentifier } from '@sihsalus/esm-sihsalus-shared';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { useEmergencyConfig } from '../hooks/usePriorityConfig';
import { type EmergencyQueueEntry, updateEmergencyQueueEntry } from '../resources/emergency.resource';
import styles from './serve-patient.modal.scss';

interface ServePatientModalProps {
  queueEntry: EmergencyQueueEntry;
  closeModal: () => void;
}

const ServePatientModal: React.FC<ServePatientModalProps> = ({ queueEntry, closeModal }) => {
  const { t } = useTranslation();
  const { queueStatuses, emergencyTriageQueueUuid } = useEmergencyConfig();
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTriageQueue = queueEntry.queue?.uuid === emergencyTriageQueueUuid;

  const patientName = queueEntry.patient.person?.display || queueEntry.patient.display;
  const gender = queueEntry.patient.person?.gender || '';
  const age = queueEntry.patient.person?.age;
  const identifiers = queueEntry.patient.identifiers || [];
  const preferredIdentifier = getPreferredIdentifier(identifiers);
  const otherIdentifiers = identifiers.filter((id) => id.uuid !== preferredIdentifier?.uuid);

  const handleServe = useCallback(() => {
    setIsSubmitting(true);
    updateEmergencyQueueEntry(queueEntry.uuid, {
      statusUuid: queueStatuses.inService,
    })
      .then(({ status }) => {
        if (status >= 200 && status < 300) {
          showSnackbar({
            isLowContrast: true,
            title: t('patientServed', 'Paciente en atención'),
            kind: 'success',
            subtitle: t('patientServedSuccessfully', 'El paciente ha sido marcado como en atención'),
          });
          mutate((key) => typeof key === 'string' && key.includes('/queue-entry'));
          closeModal();

          if (isTriageQueue) {
            // In triage queue: open triage form workspace directly
            launchWorkspace('triage-form-workspace', { queueEntry });
          } else {
            // In attention queue: open attention form workspace directly
            launchWorkspace('attention-form-workspace', { queueEntry });
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
  }, [queueEntry, queueStatuses.inService, isTriageQueue, mutate, closeModal, t]);

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
