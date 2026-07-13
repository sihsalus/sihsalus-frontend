import { Button, ModalBody, ModalFooter, ModalHeader, Tag } from '@carbon/react';
import { getUserFacingErrorMessage, navigate, showSnackbar, useConfig } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type MappedVisitQueueEntry,
  serveQueueEntry,
  updateQueueEntry,
} from '../active-visits/active-visits-table.resource';
import { type ConfigObject } from '../config-schema';
import { useMutateQueueEntries } from '../hooks/useQueueEntries';

import { requeueQueueEntry } from './transition-queue-entry.resource';
import styles from './transition-queue-entry.scss';

interface TransitionQueueEntryModalProps {
  closeModal: () => void;
  queueEntry: MappedVisitQueueEntry;
}

enum priorityComment {
  REQUEUED = 'Requeued',
}

import { preferredIdentifierNames } from '@openmrs/esm-framework';

function getPreferredIdentifiers(
  identifiers: MappedVisitQueueEntry['identifiers'] = [],
  configuredIdentifierTypeUuids: Array<string>,
) {
  const configuredIdentifiers = identifiers.filter((identifier) =>
    configuredIdentifierTypeUuids.includes(identifier?.identifierType?.uuid),
  );

  const sortedIdentifiers = preferredIdentifierNames
    .map((identifierName) =>
      configuredIdentifiers.find(
        (identifier) => identifier?.identifierType?.display?.toLowerCase() === identifierName.toLowerCase(),
      ),
    )
    .filter(Boolean);

  return sortedIdentifiers.length ? sortedIdentifiers : configuredIdentifiers;
}

const TransitionQueueEntryModal: React.FC<TransitionQueueEntryModalProps> = ({ closeModal, queueEntry }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const defaultTransitionStatus = config.concepts.defaultTransitionStatus;

  const preferredIdentifiers = getPreferredIdentifiers(queueEntry?.identifiers, config.defaultIdentifierTypes);

  const { mutateQueueEntries } = useMutateQueueEntries();

  const launchEditPriorityModal = useCallback(async () => {
    const endedAt = new Date();
    try {
      await updateQueueEntry(
        queueEntry?.visitUuid,
        queueEntry?.queueUuid,
        queueEntry?.queueUuid,
        queueEntry?.queueEntryUuid,
        queueEntry?.patientUuid,
        queueEntry?.priority?.uuid,
        defaultTransitionStatus,
        endedAt,
        queueEntry?.sortWeight,
      );
      await serveQueueEntry(queueEntry?.queue.name, queueEntry?.visitQueueNumber, 'serving');

      showSnackbar({
        isLowContrast: true,
        title: t('success', 'Success'),
        kind: 'success',
        subtitle: t('patientAttendingService', 'Patient attending service'),
      });
      closeModal();
      mutateQueueEntries();
      navigate({ to: `${globalThis.spaBase}/patient/${queueEntry?.patientUuid}/chart` });
    } catch (error) {
      showSnackbar({
        title: t('queueEntryUpdateFailed', 'Error updating queue entry'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t('queueEntryActionErrorMessage', 'The queue action could not be completed. Please try again.'),
          { logContext: 'Serve queue entry' },
        ),
      });
    }
  }, [
    closeModal,
    defaultTransitionStatus,
    mutateQueueEntries,
    queueEntry?.patientUuid,
    queueEntry?.priority?.uuid,
    queueEntry?.queue.name,
    queueEntry?.queueEntryUuid,
    queueEntry?.queueUuid,
    queueEntry?.sortWeight,
    queueEntry?.visitQueueNumber,
    queueEntry?.visitUuid,
    t,
  ]);

  const handleRequeuePatient = useCallback(() => {
    requeueQueueEntry(priorityComment.REQUEUED, queueEntry?.queueUuid, queueEntry?.queueEntryUuid).then(
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
            { logContext: 'Requeue queue entry' },
          ),
        });
      },
    );
  }, [closeModal, mutateQueueEntries, queueEntry?.queueEntryUuid, queueEntry?.queueUuid, t]);

  return (
    <div>
      <ModalHeader className={styles.modalHeader} closeModal={closeModal} title={t('servePatient', 'Serve patient')} />
      <ModalBody className={styles.modalBody}>
        <div>
          <section className={styles.modalBody}>
            <p className={styles.p}>
              {t('patientName', 'Patient name')} : &nbsp; {queueEntry?.name}
            </p>
            {preferredIdentifiers?.length
              ? preferredIdentifiers.map((identifier) => (
                  <p key={identifier?.uuid ?? identifier?.identifier} className={styles.p}>
                    {identifier?.identifierType?.display} : &nbsp; {identifier?.identifier}
                  </p>
                ))
              : ''}
            <p className={styles.p}>
              {t('patientAge', 'Age')} : &nbsp; {queueEntry?.patientAge}
            </p>
            <div>
              {queueEntry.identifiers?.map((identifier) => (
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

export default TransitionQueueEntryModal;
