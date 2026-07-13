import { Button, DropdownSkeleton, InlineNotification, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getCoreTranslation } from '@openmrs/esm-framework';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutateQueueEntries } from '../hooks/useQueueEntries';
import { useQueueEntry } from '../hooks/useQueueEntry';
import { useUserFacingErrorMessage } from '../hooks/useUserFacingErrorMessage';
import { type QueueEntry } from '../types';
import { transitionQueueEntry } from './queue-entry-actions.resource';
import QueueEntryActionModal from './queue-entry-actions-modal.component';
import { convertTime12to24 } from './time-helpers';

interface TransitionQueueEntryModalProps {
  queueEntry: QueueEntry;
  closeModal: () => void;
}

const TransitionQueueEntryModal: React.FC<TransitionQueueEntryModalProps> = ({ queueEntry, closeModal }) => {
  const { t } = useTranslation();
  const { queueEntry: freshEntry, error, isLoading } = useQueueEntry(queueEntry.uuid);
  const errorMessage = useUserFacingErrorMessage(
    error,
    t('queueDataLoadErrorMessage', 'Queue information could not be loaded. Please try again.'),
    'Load queue entry for transition',
  );
  const { mutateQueueEntries } = useMutateQueueEntries();
  const isEnded = !isLoading && !error && (!freshEntry || Boolean(freshEntry.endedAt));

  useEffect(() => {
    if (isEnded) {
      mutateQueueEntries();
    }
  }, [isEnded, mutateQueueEntries]);

  if (isLoading) {
    return (
      <>
        <ModalHeader
          closeModal={closeModal}
          title={t('transitionPatient', 'Transition {{patient}}', { patient: queueEntry.display })}
        />
        <ModalBody>
          <DropdownSkeleton data-testid="transition-queue-entry-loading-skeleton" />
        </ModalBody>
      </>
    );
  }

  if (error) {
    return (
      <>
        <ModalHeader
          closeModal={closeModal}
          title={t('transitionPatient', 'Transition {{patient}}', { patient: queueEntry.display })}
        />
        <ModalBody>
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            title={t('errorLoadingQueueEntry', 'Error loading queue entry')}
            subtitle={errorMessage}
          />
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={closeModal}>
            {getCoreTranslation('close')}
          </Button>
        </ModalFooter>
      </>
    );
  }

  if (isEnded) {
    return (
      <>
        <ModalHeader
          closeModal={closeModal}
          title={t('transitionPatient', 'Transition {{patient}}', { patient: queueEntry.display })}
        />
        <ModalBody>
          <InlineNotification
            hideCloseButton
            kind="warning"
            lowContrast
            title={t('queueEntryAlreadyEnded', 'Queue entry is no longer active')}
            subtitle={t(
              'queueEntryAlreadyEndedMessage',
              'This queue entry has already been completed by another user. The queue has been refreshed.',
            )}
          />
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={closeModal}>
            {getCoreTranslation('close')}
          </Button>
        </ModalFooter>
      </>
    );
  }

  return (
    <QueueEntryActionModal
      queueEntry={freshEntry}
      closeModal={closeModal}
      modalParams={{
        modalTitle: t('transitionPatient', 'Transition {{patient}}', { patient: freshEntry.display }),
        submitButtonText: t('transition', 'Transition'),
        submitSuccessTitle: t('queueEntryTransitioned', 'Queue entry transitioned'),
        submitSuccessText: t('queueEntryTransitionedSuccessfully', 'Queue entry transitioned successfully'),
        submitFailureTitle: t('queueEntryTransitionFailed', 'Error transitioning queue entry'),
        submitAction: (queueEntry, formState) => {
          const transitionDate = new Date(formState.transitionDate);
          const [hour, minute] = convertTime12to24(formState.transitionTime, formState.transitionTimeFormat);
          transitionDate.setHours(hour, minute, 0, 0);

          return transitionQueueEntry({
            queueEntryToTransition: queueEntry.uuid,
            newQueue: formState.selectedQueue,
            newStatus: formState.selectedStatus,
            newPriority: formState.selectedPriority,
            newPriorityComment: formState.priorityComment,
            ...(formState.modifyDefaultTransitionDateTime ? { transitionDate: transitionDate.toISOString() } : {}),
          });
        },
        disableSubmit: (queueEntry, formState) =>
          formState.selectedQueue === queueEntry.queue.uuid && formState.selectedStatus === queueEntry.status.uuid,
        isEdit: false,
        showQueuePicker: false,
        showStatusPicker: true,
      }}
    />
  );
};

export default TransitionQueueEntryModal;
