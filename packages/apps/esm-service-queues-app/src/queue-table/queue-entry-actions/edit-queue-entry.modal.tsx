import React from 'react';
import { useTranslation } from 'react-i18next';

import { convertTime12to24 } from '../../helpers/time-helpers';
import { useQueues } from '../../hooks/useQueues';
import { type QueueEntry } from '../../types';

import QueueEntryActionModal from './queue-entry-actions.modal';
import { transitionQueueEntry, updateQueueEntry } from './queue-entry-actions.resource';

interface EditQueueEntryModalProps {
  queueEntry: QueueEntry;
  closeModal: () => void;
}

const EditQueueEntryModal: React.FC<EditQueueEntryModalProps> = ({ queueEntry, closeModal }) => {
  const { t } = useTranslation();
  const { queues } = useQueues();

  return (
    <QueueEntryActionModal
      queueEntry={queueEntry}
      closeModal={closeModal}
      modalParams={{
        modalTitle: t('editQueueEntry', 'Edit queue entry'),
        modalInstruction: t('editQueueEntryInstruction', 'Edit fields of existing queue entry'),
        submitButtonText: t('editQueueEntry', 'Edit queue entry'),
        submitSuccessTitle: t('queueEntryEdited', 'Queue entry edited'),
        submitSuccessText: t('queueEntryEditedSuccessfully', 'Queue entry edited successfully'),
        submitFailureTitle: t('queueEntryEditingFailed', 'Error editing queue entry'),
        submitAction: (queueEntry, formState) => {
          const selectedQueue = queues.find((q) => q.uuid === formState.selectedQueue);
          const statuses = selectedQueue?.allowedStatuses;
          const priorities = selectedQueue?.allowedPriorities;

          if (!selectedQueue || !statuses?.length || !priorities?.length) {
            return Promise.reject(new Error('The selected queue configuration is not available.'));
          }

          const status = statuses.find((s) => s.uuid === formState.selectedStatus);
          const priority = priorities.find((p) => p.uuid === formState.selectedPriority);

          if (!status || !priority) {
            return Promise.reject(new Error('The selected queue configuration is not available.'));
          }

          const queueChanged = selectedQueue.uuid !== queueEntry.queue.uuid;
          const statusChanged = status.uuid !== queueEntry.status.uuid;
          const priorityChanged = priority.uuid !== queueEntry.priority.uuid;

          if (queueChanged || statusChanged || priorityChanged) {
            return transitionQueueEntry({
              queueEntryToTransition: queueEntry.uuid,
              newQueue: selectedQueue.uuid,
              newStatus: status.uuid,
              newPriority: priority.uuid,
              newPriorityComment: formState.prioritycomment,
            });
          }

          const startAtDate = new Date(formState.transitionDate);
          const [hour, minute] = convertTime12to24(formState.transitionTime, formState.transitionTimeFormat);
          startAtDate.setHours(hour, minute, 0, 0);

          return updateQueueEntry(queueEntry.uuid, {
            status,
            priority,
            priorityComment: formState.prioritycomment,
            ...(formState.modifyDefaultTransitionDateTime ? { startedAt: startAtDate.toISOString() } : {}),
          });
        },
        disableSubmit: () => false,
        isTransition: false,
      }}
    />
  );
};

export default EditQueueEntryModal;
