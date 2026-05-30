import { getQueueEntryCommunicationCondition, getQueueEntryResponsibleName } from '../emergency-queue-identity.utils';
import { type EmergencyQueueTableCellProps } from './emergency-queue-name-cell.component';

export const EmergencyQueueResponsibleCell = ({ queueEntry }: EmergencyQueueTableCellProps) => {
  const responsibleName = getQueueEntryResponsibleName(queueEntry);
  const communicationCondition = getQueueEntryCommunicationCondition(queueEntry);

  return (
    <span>
      {responsibleName || '-'}
      {communicationCondition ? ` (${communicationCondition})` : ''}
    </span>
  );
};
