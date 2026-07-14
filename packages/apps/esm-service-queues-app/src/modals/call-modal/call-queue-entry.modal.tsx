import { Button, ModalBody, ModalFooter, ModalHeader, Tag } from '@carbon/react';
import { getUserFacingErrorMessage, navigate, showSnackbar, useConfig } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../../config-schema';
import { useMutateQueueEntries } from '../../hooks/useQueueEntries';
import { mapVisitQueueEntryProperties, serveQueueEntry, updateQueueEntry } from '../../service-queues.resource';
import { type QueueEntry } from '../../types';
import { requeueQueueEntry } from './call-queue-entry.resource';
import styles from './call-queue-entry.scss';

interface CallQueueEntryModalProps {
  closeModal: () => void;
  queueEntry: QueueEntry;
}

enum priorityComment {
  REQUEUED = 'Requeued',
}

const CallQueueEntryModal: React.FC<CallQueueEntryModalProps> = ({ closeModal, queueEntry }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const defaultTransitionStatus = config.concepts.defaultTransitionStatus;

  const mappedQueueEntry = mapVisitQueueEntryProperties(queueEntry, config.visitQueueNumberAttributeUuid);

  const preferredIdentifiers = mappedQueueEntry.identifiers.filter((identifier) =>
    config.defaultIdentifierTypes.includes(identifier?.identifierType?.uuid),
  );

  const { mutateQueueEntries } = useMutateQueueEntries();

  const launchEditPriorityModal = useCallback(async () => {
    const endedAt = new Date();
    try {
      await updateQueueEntry(
        mappedQueueEntry.visitUuid,
        mappedQueueEntry.queueUuid,
        mappedQueueEntry.queueUuid,
        mappedQueueEntry.queueEntryUuid,
        mappedQueueEntry.patientUuid,
        mappedQueueEntry.priority?.uuid,
        defaultTransitionStatus,
        endedAt,
        mappedQueueEntry.sortWeight,
      );
      await serveQueueEntry(mappedQueueEntry.queue.name, mappedQueueEntry.visitQueueNumber, 'serving');

      showSnackbar({
        isLowContrast: true,
        title: t('success', 'Success'),
        kind: 'success',
        subtitle: t('patientAttendingService', 'Patient attending service'),
      });
      closeModal();
      mutateQueueEntries();
      navigate({ to: `\${openmrsSpaBase}/patient/${mappedQueueEntry.patientUuid}/chart` });
    } catch (error) {
      showSnackbar({
        title: t('queueEntryUpdateFailed', 'Error updating queue entry'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t('queueEntryActionErrorMessage', 'The queue action could not be completed. Please try again.'),
          { logContext: 'Call queue entry' },
        ),
      });
    }
  }, [
    closeModal,
    defaultTransitionStatus,
    mutateQueueEntries,
    mappedQueueEntry.patientUuid,
    mappedQueueEntry.priority?.uuid,
    mappedQueueEntry.queue.name,
    mappedQueueEntry.queueEntryUuid,
    mappedQueueEntry.queueUuid,
    mappedQueueEntry.sortWeight,
    mappedQueueEntry.visitQueueNumber,
    mappedQueueEntry.visitUuid,
    t,
  ]);

  const handleRequeuePatient = useCallback(() => {
    requeueQueueEntry(priorityComment.REQUEUED, mappedQueueEntry.queueUuid, mappedQueueEntry.queueEntryUuid).then(
      () => {
        showSnackbar({
          isLowContrast: true,
          title: t('success', 'Success'),
          kind: 'success',
          subtitle: t('patientRequeued', 'Patient has been requeued'),
        });
        closeModal();
        mutateQueueEntries();
      },
      (error) => {
        showSnackbar({
          title: t('queueEntryUpdateFailed', 'Error updating queue entry'),
          kind: 'error',
          isLowContrast: false,
          subtitle: getUserFacingErrorMessage(
            error,
            t('queueEntryActionErrorMessage', 'The queue action could not be completed. Please try again.'),
            { logContext: 'Requeue called queue entry' },
          ),
        });
      },
    );
  }, [closeModal, mutateQueueEntries, mappedQueueEntry.queueEntryUuid, mappedQueueEntry.queueUuid, t]);

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={t('servePatient', 'Serve patient')} />
      <ModalBody className={styles.modalBody}>
        <div>
          <section className={styles.modalBody}>
            <p className={styles.p}>
              {t('patientName', 'Patient name')}: &nbsp; {mappedQueueEntry.name}
            </p>
            {preferredIdentifiers?.length
              ? preferredIdentifiers.map((identifier) => (
                  <p key={identifier.uuid} className={styles.p}>
                    {identifier?.identifierType?.display} : &nbsp; {identifier?.identifier}
                  </p>
                ))
              : ''}
            <p className={styles.p}>
              {t('patientGender', 'Gender')}: &nbsp; {mappedQueueEntry.patientGender}
            </p>
            <p className={styles.p}>
              {t('patientAge', 'Age')}: &nbsp; {mappedQueueEntry.patientAge}
            </p>
            <div>
              {mappedQueueEntry.identifiers?.map((identifier) => (
                <Tag key={identifier.uuid}>{identifier.display}</Tag>
              ))}
            </div>
          </section>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={() => handleRequeuePatient()}>
          {t('requeue', 'Requeue')}
        </Button>
        <Button onClick={() => void launchEditPriorityModal()}>{t('serve', 'Serve')}</Button>
      </ModalFooter>
    </div>
  );
};

export default CallQueueEntryModal;
