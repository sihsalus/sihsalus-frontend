import { Tag } from '@carbon/react';
import { getQueueEntryIdentificationStatus } from '../emergency-queue-identity.utils';
import { type EmergencyQueueTableCellProps } from './emergency-queue-name-cell.component';

export const EmergencyQueueIdentificationStatusCell = ({ queueEntry }: EmergencyQueueTableCellProps) => {
  const identificationStatus = getQueueEntryIdentificationStatus(queueEntry);
  const tagType = /pendiente|parcial/i.test(identificationStatus) ? 'red' : 'green';

  return (
    <Tag type={tagType} size="sm">
      {identificationStatus}
    </Tag>
  );
};
