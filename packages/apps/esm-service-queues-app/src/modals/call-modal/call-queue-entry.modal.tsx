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
  const ticketNumber = mappedQueueEntry.visitQueueNumber?.trim();
  const hasTicketNumber = Boolean(ticketNumber);

  const preferredIdentifiers = mappedQueueEntry.identifiers.filter((identifier) =>
    config.defaultIdentifierTypes.includes(identifier?.identifierType?.uuid),
  );

  const { mutateQueueEntries } = useMutateQueueEntries();

  const launchEditPriorityModal = useCallback(async () => {
    if (!ticketNumber) {
      return;
    }

    try {
      await updateQueueEntry(
        mappedQueueEntry.queueEntryUuid,
        mappedQueueEntry.queueUuid,
        mappedQueueEntry.priority?.uuid,
        defaultTransitionStatus,
      );
      await serveQueueEntry(mappedQueueEntry.queue.name, ticketNumber, 'serving');

      showSnackbar({
        isLowContrast: true,
        title: t('success', 'Success'),
        kind: 'success',
        subtitle: t('patientAttendingService', 'Patient attending service'),
      });
      closeModal();
      mutateQueueEntries();
      navigate({ to: `${globalThis.spaBase}/patient/${mappedQueueEntry.patientUuid}/chart` });
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
    t,
    ticketNumber,
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
            {!hasTicketNumber && (
              <p className={styles.p}>
                {t(
                  'callUnavailableWithoutQueueNumber',
                  'This queue entry has no queue number and cannot be sent to the calling screen.',
                )}
              </p>
            )}
          </section>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={() => handleRequeuePatient()}>
          {t('requeue', 'Requeue')}
        </Button>
        <Button disabled={!hasTicketNumber} onClick={() => void launchEditPriorityModal()}>
          {t('serve', 'Serve')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default CallQueueEntryModal;
