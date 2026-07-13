import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getUserFacingErrorMessage, parseDate, showSnackbar, useVisit } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { startOfDay } from '../constants';
import { useMutateQueueEntries } from '../hooks/useQueueEntries';
import { type MappedQueueEntry } from '../types';

import { endQueueEntry, useCheckedInAppointments } from './remove-queue-entry.resource';
import styles from './remove-queue-entry.scss';

interface RemoveQueueEntryModalProps {
  queueEntry: MappedQueueEntry;
  closeModal: () => void;
}

const RemoveQueueEntryModal: React.FC<RemoveQueueEntryModalProps> = ({ queueEntry, closeModal }) => {
  const { t } = useTranslation();
  const { currentVisit } = useVisit(queueEntry.patientUuid);
  const { mutateQueueEntries } = useMutateQueueEntries();

  const { data: appointments } = useCheckedInAppointments(queueEntry.patientUuid, startOfDay);

  const removeQueueEntry = useCallback(() => {
    const endCurrentVisitPayload = {
      location: currentVisit?.location?.uuid,
      startDatetime: parseDate(currentVisit?.startDatetime),
      visitType: currentVisit?.visitType?.uuid,
      stopDatetime: new Date(),
    };

    const endedAt = new Date();

    endQueueEntry(
      queueEntry.queue.uuid,
      queueEntry.queueEntryUuid,
      endedAt,
      endCurrentVisitPayload,
      queueEntry.visitUuid,
      appointments,
    )
      .then(() => {
        closeModal();
        mutateQueueEntries();
        showSnackbar({
          isLowContrast: true,
          kind: 'success',
          subtitle: t('queueEntryRemovedSuccessfully', `Queue entry removed successfully`),
          title: t('queueEntryRemoved', 'Queue entry removed'),
        });
      })
      .catch((error) => {
        showSnackbar({
          title: t('removeQueueEntryError', 'Error removing queue entry'),
          kind: 'error',
          isLowContrast: false,
          subtitle: getUserFacingErrorMessage(
            error,
            t('queueEntryActionErrorMessage', 'The queue action could not be completed. Please try again.'),
            { logContext: 'Remove queue entry' },
          ),
        });
      });
  }, [
    appointments,
    closeModal,
    currentVisit?.location?.uuid,
    currentVisit?.startDatetime,
    currentVisit?.visitType?.uuid,
    mutateQueueEntries,
    queueEntry?.queue?.uuid,
    queueEntry?.queueEntryUuid,
    queueEntry?.visitUuid,
    t,
  ]);

  return (
    <>
      <ModalHeader
        className={styles.modalHeader}
        closeModal={closeModal}
        label={t('serviceQueue', 'Service queue')}
        title={t('removeFromQueueAndEndVisit', 'Remove patient from queue and end active visit?')}
      />
      <ModalBody>
        <p className={styles.subHeading} id="subHeading">
          {t(
            'endVisitWarningMessage',
            'Ending this visit will remove this patient from the queue and will not allow you to fill another encounter form for this patient',
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={removeQueueEntry}>
          {t('endVisit', 'End visit')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default RemoveQueueEntryModal;
