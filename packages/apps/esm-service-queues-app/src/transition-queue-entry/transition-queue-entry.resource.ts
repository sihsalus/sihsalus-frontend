import { updateActiveQueueEntry } from '../modals/queue-entry-actions.resource';

export function requeueQueueEntry(priorityComment: string, _queueUuid: string, queueEntryUuid: string) {
  return updateActiveQueueEntry(queueEntryUuid, { priorityComment });
}
